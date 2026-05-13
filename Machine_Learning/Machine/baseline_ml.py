"""
baseline_ml.py  —  Motor de búsqueda por similitud del Baseline Pipeline (DSP)
=======================================================================
Adaptado para leer los JSON maestros generados por el pipeline "Turbo".
"""

import os
import json
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Union, Optional, Dict

from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib

# ─── Configuración del logger ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("Voice2Sample.BaselineML")

# ─── Constantes de configuración ─────────────────────────────────────────────
DESCRIPTOR_FILE_MAP = {
    "timbre":   "timbre_descriptors.json",
    "rhythmic": "rhythmic_descriptors.json",
    "melodic":  "melodic_descriptors.json",
}

INDEX_FILENAME  = "baseline_index.csv"

# ─────────────────────────────────────────────────────────────────────────────
#  UTILIDADES DE CARGA
# ─────────────────────────────────────────────────────────────────────────────

def _cargar_json(ruta: str) -> dict:
    if os.path.exists(ruta):
        with open(ruta, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def extraer_features_de_diccionarios(audio_id, db_timbre, db_ritmo, db_melodia) -> Dict[str, np.ndarray]:
    """
    Extrae features de un audio desde los 3 diccionarios maestros.
    Usa TIMBRE como obligatorio y rellena RITMO/MELODÍA con ceros si faltan.
    """
    # ─── 1. TIMBRE (Obligatorio - siempre debe existir porque viene de la lista maestra)
    audio_id_str = str(audio_id)
    audio_id_int = int(audio_id) if isinstance(audio_id, (str, int)) and str(audio_id).isdigit() else None
    
    # Intentamos buscar por string primero, luego por int
    t_data = db_timbre.get(audio_id_str, None)
    if t_data is None and audio_id_int is not None:
        t_data = db_timbre.get(audio_id_int, None)
    if t_data is None:
        t_data = db_timbre.get(audio_id, {})
    if not isinstance(t_data, dict):
        t_data = {}
    
    v_timbre = []
    # MFCC y GFCC (13 coeficientes cada uno = 52 features)
    for k in ["mfcc", "gfcc"]:
        k_data = t_data.get(k, {})
        if isinstance(k_data, dict):
            mean_val = k_data.get("mean", None)
            std_val = k_data.get("std", None)
            if mean_val is None:
                mean_val = np.zeros(13).tolist()
            if std_val is None:
                std_val = np.zeros(13).tolist()
            v_timbre.extend(mean_val if isinstance(mean_val, (list, np.ndarray)) else [mean_val] * 13)
            v_timbre.extend(std_val if isinstance(std_val, (list, np.ndarray)) else [std_val] * 13)
        else:
            v_timbre.extend(np.zeros(26).tolist())  # 13 mean + 13 std
    
    # Espectrales (5 features * 2 = 10 features)
    for k in ["spectral_centroid", "spectral_spread", "spectral_rolloff", "spectral_flux", "zero_crossing_rate"]:
        k_data = t_data.get(k, {})
        if isinstance(k_data, dict):
            v_timbre.append(float(k_data.get("mean", 0.0)))
            v_timbre.append(float(k_data.get("std", 0.0)))
        else:
            v_timbre.extend([0.0, 0.0])

    # ─── 2. RITMO (Opcional - Si no está, rellena con 4 ceros)
    # Mismo sistema de búsqueda: string → int → raw
    r_data = db_ritmo.get(audio_id_str, None)
    if r_data is None and audio_id_int is not None:
        r_data = db_ritmo.get(audio_id_int, None)
    if r_data is None:
        r_data = db_ritmo.get(audio_id, {})
    if not isinstance(r_data, dict):
        r_data = {}
    
    v_ritmo = [
        float(r_data.get("bpm", 0.0)),
        float(r_data.get("beat_confidence", 0.0)),
        float(r_data.get("beat_intervals_stats", {}).get("mean", 0.0)) if isinstance(r_data.get("beat_intervals_stats"), dict) else 0.0,
        float(r_data.get("beat_intervals_stats", {}).get("std", 0.0)) if isinstance(r_data.get("beat_intervals_stats"), dict) else 0.0
    ]

    # ─── 3. MELODÍA (Opcional - Si no está, rellena con 16 ceros)
    # Mismo sistema de búsqueda: string → int → raw
    m_data = db_melodia.get(audio_id_str, None)
    if m_data is None and audio_id_int is not None:
        m_data = db_melodia.get(audio_id_int, None)
    if m_data is None:
        m_data = db_melodia.get(audio_id, {})
    if not isinstance(m_data, dict):
        m_data = {}
    
    v_melodia = []
    pitch_stats = m_data.get("pitch_stats", {})
    if isinstance(pitch_stats, dict):
        v_melodia.append(float(pitch_stats.get("mean", 0.0)))
        v_melodia.append(float(pitch_stats.get("std", 0.0)))
    else:
        v_melodia.extend([0.0, 0.0])
    
    pitch_conf = m_data.get("pitch_confidence_stats", {})
    if isinstance(pitch_conf, dict):
        v_melodia.append(float(pitch_conf.get("mean", 0.0)))
    else:
        v_melodia.append(0.0)
    
    hpcp = m_data.get("hpcp_mean", None)
    if hpcp is None:
        hpcp = np.zeros(12).tolist()
    elif isinstance(hpcp, np.ndarray):
        hpcp = hpcp.tolist()
    elif not isinstance(hpcp, list):
        hpcp = [float(hpcp)] * 12
    # Asegurar que hpcp tenga exactamente 12 elementos
    hpcp = hpcp[:12] + [0.0] * (12 - len(hpcp)) if len(hpcp) < 12 else hpcp[:12]
    v_melodia.extend(hpcp)
    
    v_melodia.append(float(m_data.get("key_strength", 0.0)))

    # Asegurar arrays con tamaños consistentes
    v_timbre = np.array(v_timbre[:62], dtype=np.float32)  # 52 + 10 = 62
    if len(v_timbre) < 62:
        v_timbre = np.concatenate([v_timbre, np.zeros(62 - len(v_timbre), dtype=np.float32)])
    
    v_ritmo = np.array(v_ritmo[:4], dtype=np.float32)
    if len(v_ritmo) < 4:
        v_ritmo = np.concatenate([v_ritmo, np.zeros(4 - len(v_ritmo), dtype=np.float32)])
    
    v_melodia = np.array(v_melodia[:16], dtype=np.float32)  # 2 + 1 + 12 + 1 = 16
    if len(v_melodia) < 16:
        v_melodia = np.concatenate([v_melodia, np.zeros(16 - len(v_melodia), dtype=np.float32)])

    return {
        "timbre": v_timbre,
        "ritmo": v_ritmo,
        "melodia": v_melodia
    }


# ─────────────────────────────────────────────────────────────────────────────
#  CLASE PRINCIPAL: MOTOR DE BÚSQUEDA
# ─────────────────────────────────────────────────────────────────────────────

class BaselineSearchEngine:
    def __init__(self, n_vecinos: int = 5, metrica: str = "cosine"):
        self.n_vecinos    = n_vecinos
        self.metrica      = metrica

        self.scaler_timbre = StandardScaler()
        self.scaler_ritmo = StandardScaler()
        self.scaler_melodia = StandardScaler()

        self.knn_timbre = NearestNeighbors(n_neighbors=n_vecinos, metric=metrica, algorithm="brute", n_jobs=-1)
        self.knn_ritmo = NearestNeighbors(n_neighbors=n_vecinos, metric=metrica, algorithm="brute", n_jobs=-1)
        self.knn_melodia = NearestNeighbors(n_neighbors=n_vecinos, metric=metrica, algorithm="brute", n_jobs=-1)
        self.knn_combinado = NearestNeighbors(n_neighbors=n_vecinos, metric=metrica, algorithm="brute", n_jobs=-1)

        self._indice_df = None
        self._matriz_X_timbre = None
        self._matriz_X_ritmo = None
        self._matriz_X_melodia = None
        self._matriz_X_combinado = None
        self._dim_timbre = None
        self._dim_ritmo = None
        self._dim_melodia = None
        self._entrenado  = False

    @property
    def entrenado(self) -> bool:
        return self._entrenado

    @property
    def n_audios(self) -> int:
        return len(self._indice_df) if self._indice_df is not None else 0

    def construir_indice(self, directorio_descriptores: str) -> "BaselineSearchEngine":
        dir_path = Path(directorio_descriptores)
        
        # CARGA DE ARCHIVOS
        db_timbre = _cargar_json(str(dir_path / DESCRIPTOR_FILE_MAP["timbre"]))
        db_ritmo = _cargar_json(str(dir_path / DESCRIPTOR_FILE_MAP["rhythmic"]))
        db_melodia = _cargar_json(str(dir_path / DESCRIPTOR_FILE_MAP["melodic"]))

        # === PRINTS DETECTIVES ===
        print(f"\n🔍 AUDITORÍA DE ARCHIVOS:")
        print(f"  - Audios en Timbre: {len(db_timbre)}")
        print(f"  - Audios en Ritmo:  {len(db_ritmo)}")
        print(f"  - Audios en Melodía: {len(db_melodia)}")
        # =========================

        # USAMOS EL TIMBRE COMO LISTA MAESTRA (LOS 3945)
        audio_ids = list(db_timbre.keys())
        
        registros = []
        for audio_id in audio_ids:
            # Llamamos a la función blindada (ya no hay 'if' que salte nada)
            vectores = extraer_features_de_diccionarios(audio_id, db_timbre, db_ritmo, db_melodia)
            
            registros.append({
                "audio_id": audio_id,
                "ruta_audio": f"../Dataset/audio_processed/{audio_id}.wav",
                "vectores": vectores
            })

        # Si llegamos aquí, 'registros' tiene que tener el tamaño de 'audio_ids'
        print(f"✅ Total registros creados en memoria: {len(registros)}")

        self._indice_df = pd.DataFrame([{"audio_id": r["audio_id"], "ruta_audio": r["ruta_audio"]} for r in registros])

        # Creamos las matrices
        X_timbre_raw = np.vstack([r["vectores"]["timbre"] for r in registros])
        X_ritmo_raw = np.vstack([r["vectores"]["ritmo"] for r in registros])
        X_melodia_raw = np.vstack([r["vectores"]["melodia"] for r in registros])

        # Normalización y entrenamiento
        self._matriz_X_timbre = self.scaler_timbre.fit_transform(np.nan_to_num(X_timbre_raw))
        self._matriz_X_ritmo = self.scaler_ritmo.fit_transform(np.nan_to_num(X_ritmo_raw))
        self._matriz_X_melodia = self.scaler_melodia.fit_transform(np.nan_to_num(X_melodia_raw))

        self.knn_timbre.fit(self._matriz_X_timbre)
        self.knn_ritmo.fit(self._matriz_X_ritmo)
        self.knn_melodia.fit(self._matriz_X_melodia)

        X_combinado_raw = np.hstack([X_timbre_raw, X_ritmo_raw, X_melodia_raw])
        self._matriz_X_combinado = StandardScaler().fit_transform(np.nan_to_num(X_combinado_raw))
        self.knn_combinado.fit(self._matriz_X_combinado)

        self._entrenado = True
        self._dim_timbre = X_timbre_raw.shape[1]
        self._dim_ritmo = X_ritmo_raw.shape[1]
        self._dim_melodia = X_melodia_raw.shape[1]

        logger.info(f"🚀 MOTOR LISTO: {len(registros)} audios indexados.")
        return self
    

    def buscar_audio_similar(self, dict_query: dict, n_resultados: Optional[int] = None, filtro_categoria: str = "todos") -> pd.DataFrame:
        """Busca usando los vectores de una query."""
        if not self._entrenado:
            raise RuntimeError("El motor no está entrenado.")

        k = n_resultados or self.n_vecinos
        vectores_query = extraer_features_de_diccionarios("query_temp", dict_query.get("timbre",{}), dict_query.get("ritmo",{}), dict_query.get("melodia",{}))

        if filtro_categoria == "timbre":
            vector_norm = self.scaler_timbre.transform(vectores_query["timbre"].reshape(1, -1))
            knn = self.knn_timbre
        elif filtro_categoria == "ritmo":
            vector_norm = self.scaler_ritmo.transform(vectores_query["ritmo"].reshape(1, -1))
            knn = self.knn_ritmo
        elif filtro_categoria == "melodia":
            vector_norm = self.scaler_melodia.transform(vectores_query["melodia"].reshape(1, -1))
            knn = self.knn_melodia
        else:
            vector_combinado = np.concatenate([vectores_query["timbre"], vectores_query["ritmo"], vectores_query["melodia"]])
            scaler_temp = StandardScaler()
            scaler_temp.fit(np.hstack([self.scaler_timbre.inverse_transform(self._matriz_X_timbre), 
                                       self.scaler_ritmo.inverse_transform(self._matriz_X_ritmo), 
                                       self.scaler_melodia.inverse_transform(self._matriz_X_melodia)]))
            vector_norm = scaler_temp.transform(vector_combinado.reshape(1, -1))
            knn = self.knn_combinado

        vector_norm = np.nan_to_num(vector_norm)
        distancias, indices = knn.kneighbors(vector_norm, n_neighbors=min(k, self.n_audios))

        resultados = self._indice_df.iloc[indices[0]].copy().reset_index(drop=True)
        resultados.insert(0, "rank", range(1, len(resultados) + 1))
        resultados["distancia"] = distancias[0]
        resultados["similitud"] = 1.0 - distancias[0]

        return resultados

    def guardar_modelo(self, directorio_salida: str = ".") -> None:
        if not self._entrenado:
            raise RuntimeError("No hay modelo entrenado.")
        salida = Path(directorio_salida)
        salida.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.scaler_timbre,     salida / "baseline_scaler_timbre.joblib")
        joblib.dump(self.scaler_ritmo,      salida / "baseline_scaler_ritmo.joblib")
        joblib.dump(self.scaler_melodia,    salida / "baseline_scaler_melodia.joblib")
        joblib.dump(self.knn_timbre,        salida / "baseline_knn_timbre.joblib")
        joblib.dump(self.knn_ritmo,         salida / "baseline_knn_ritmo.joblib")
        joblib.dump(self.knn_melodia,       salida / "baseline_knn_melodia.joblib")
        joblib.dump(self.knn_combinado,     salida / "baseline_knn_combinado.joblib")
        self._indice_df.to_csv(salida / INDEX_FILENAME, index=False)
        logger.info(f"💾 Modelo guardado en: {salida.resolve()}")

    def cargar_modelo(self, directorio_modelos: str = ".") -> "BaselineSearchEngine":
        origen = Path(directorio_modelos)
        self.scaler_timbre     = joblib.load(origen / "baseline_scaler_timbre.joblib")
        self.scaler_ritmo      = joblib.load(origen / "baseline_scaler_ritmo.joblib")
        self.scaler_melodia    = joblib.load(origen / "baseline_scaler_melodia.joblib")
        self.knn_timbre        = joblib.load(origen / "baseline_knn_timbre.joblib")
        self.knn_ritmo         = joblib.load(origen / "baseline_knn_ritmo.joblib")
        self.knn_melodia       = joblib.load(origen / "baseline_knn_melodia.joblib")
        self.knn_combinado     = joblib.load(origen / "baseline_knn_combinado.joblib")
        self._indice_df = pd.read_csv(origen / INDEX_FILENAME)
        
        self._dim_timbre = self.scaler_timbre.n_features_in_
        self._dim_ritmo = self.scaler_ritmo.n_features_in_
        self._dim_melodia = self.scaler_melodia.n_features_in_
        self._entrenado  = True
        self.n_vecinos = self.knn_timbre.n_neighbors
        self.metrica   = self.knn_timbre.metric
        return self

if __name__ == "__main__":
    # Script de prueba rápida
    motor = BaselineSearchEngine(n_vecinos=5)
    print("Construyendo índice desde 'descriptors/'...")
    motor.construir_indice("descriptors/")
    motor.guardar_modelo("modelos/")
    print("¡Listo para buscar!")