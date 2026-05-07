"""
baseline_ml.py  —  Motor de búsqueda por similitud del Baseline Pipeline (DSP)
Proyecto: Voice2Sample — Query by Vocal Imitation
=======================================================================
Uso básico:
    from baseline_ml import BaselineSearchEngine

    motor = BaselineSearchEngine()
    motor.construir_indice("descriptors_db/")       # indexa toda la BD
    resultado = motor.buscar_audio_similar("descriptors_query/")
    print(resultado)

Flujo completo:
    1. construir_indice()   → carga JSONs de la BD, extrae features, normaliza, ajusta KNN
    2. buscar_audio_similar() → normaliza query con el MISMO scaler, busca vecinos, devuelve ranking
=======================================================================
Decisión de métrica de distancia
---------------------------------
Se usa **Similitud Coseno** (implementada como `metric='cosine'` en NearestNeighbors).

Justificación técnica:
  • Los MFCC y GFCC tienen magnitudes muy variables entre segmentos de distinta
    duración y nivel de grabación. La distancia Euclidiana castiga diferencias de
    escala global, mientras que la Similitud Coseno mide el ÁNGULO entre vectores,
    es decir, la forma del espectro, ignorando la amplitud absoluta.
  • En QVI (Query by Vocal Imitation) el usuario imita con la voz; su señal tendrá
    una amplitud y nivel de ruido completamente distintos al sample original.
    Con distancia coseno, lo que importa es el "perfil" tímbrico (pendiente de los
    coeficientes), no su magnitud.
  • Para descriptores del dominio espectral (centroide, flux, rolloff) la
    normalización via StandardScaler ya resuelve la disparidad de escala, así que
    coseno sigue siendo válido y consistente con los coeficientes MFCC/GFCC.
  • La distancia Euclidiana sería preferible solo si todos los features estuviesen
    en la misma unidad y escala, y la magnitud absoluta fuera semánticamente
    relevante (no es nuestro caso).
=======================================================================
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
import joblib

# ─── Configuración del logger ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("Voice2Sample.BaselineML")


# ─── Constantes de configuración ─────────────────────────────────────────────

# Número de coeficientes MFCC y GFCC extraídos por Essentia
N_MFCC = 13
N_GFCC = 13

# Features de nivel de frame que se reducen con estadísticas (mean + std)
FRAME_FEATURES = [
    "mfcc",              # timbre_descriptors.json  → 13 coefs × frame
    "gfcc",              # timbre_descriptors.json  → 13 coefs × frame
    "spectral_centroid", # timbre_descriptors.json  → scalar × frame
    "spectral_spread",   # timbre_descriptors.json  → scalar × frame
    "spectral_rolloff",  # timbre_descriptors.json  → scalar × frame
    "spectral_flux",     # timbre_descriptors.json  → scalar × frame
    "zero_crossing_rate",# timbre_descriptors.json  → scalar × frame
    "pitch",             # melodic_descriptors.json → scalar × frame
    "pitch_confidence",  # melodic_descriptors.json → scalar × frame
    "hpcp",              # melodic_descriptors.json → 12 bins × frame
]

# Features globales (escalares únicos por audio)
GLOBAL_FEATURES = [
    "bpm",               # rhythmic_descriptors.json
    "beat_confidence",   # rhythmic_descriptors.json
    "key_strength",      # melodic_descriptors.json
]

# Mapa: nombre del descriptor → archivo JSON fuente
DESCRIPTOR_FILE_MAP = {
    "timbre":   "timbre_descriptors.json",
    "rhythmic": "rhythmic_descriptors.json",
    "melodic":  "melodic_descriptors.json",
}

# Nombre del archivo de modelo persistido
MODEL_FILENAME  = "baseline_model.joblib"
SCALER_FILENAME = "baseline_scaler.joblib"
INDEX_FILENAME  = "baseline_index.csv"


# ─────────────────────────────────────────────────────────────────────────────
#  UTILIDADES DE CARGA Y REDUCCIÓN DE DESCRIPTORES
# ─────────────────────────────────────────────────────────────────────────────

def _cargar_json(ruta: str) -> dict:
    """Carga un archivo JSON y devuelve el diccionario."""
    with open(ruta, "r", encoding="utf-8") as f:
        return json.load(f)


def _reducir_frames(values, nombre: str) -> np.ndarray:
    """
    Reduce una lista de vectores de frames a un único vector de estadísticas.

    Para cada descriptor por frame aplicamos media (μ) y desviación estándar (σ),
    que es la representación estándar en MIR para capturar tanto el valor medio
    como la variabilidad temporal del timbre.

    Args:
        values: Lista de frames. Cada frame puede ser un float o una lista de floats.
        nombre: Nombre del descriptor (solo para logging).

    Returns:
        np.ndarray: Vector 1D con [μ_0, σ_0, μ_1, σ_1, ...] intercalados.
    """
    arr = np.array(values, dtype=np.float32)

    # Normalizar a 2D: (n_frames, n_features)
    if arr.ndim == 1:
        arr = arr.reshape(-1, 1)

    media = np.mean(arr, axis=0)   # (n_features,)
    std   = np.std(arr,  axis=0)   # (n_features,)

    # Intercalar μ y σ: [μ0, σ0, μ1, σ1, ...]
    resultado = np.empty(media.size * 2, dtype=np.float32)
    resultado[0::2] = media
    resultado[1::2] = std

    return resultado


def extraer_features_de_directorio(directorio: str) -> Optional[Dict[str, np.ndarray]]:
    """
    Carga los tres JSONs de descriptores de un directorio y ensambla los
    vectores de features separados para UN solo audio.

    Estructura esperada del directorio:
        directorio/
            timbre_descriptors.json
            rhythmic_descriptors.json
            melodic_descriptors.json

    Returns:
        Dict con claves "timbre", "ritmo", "melodia" y sus respectivos np.ndarray, o None si falta algún archivo.
    """
    directorio = Path(directorio)
    partes_timbre = []
    partes_ritmo = []
    partes_melodia = []

    # ── 1. Timbre (por frames) ──────────────────────────────────────────
    ruta_timbre = directorio / DESCRIPTOR_FILE_MAP["timbre"]
    if not ruta_timbre.exists():
        logger.warning(f"  ✗ Falta timbre_descriptors.json en {directorio}")
        return None
    timbre = _cargar_json(str(ruta_timbre))

    for key in ["mfcc", "gfcc", "spectral_centroid",
                "spectral_spread", "spectral_rolloff",
                "spectral_flux", "zero_crossing_rate"]:
        if key in timbre and len(timbre[key]) > 0:
            partes_timbre.append(_reducir_frames(timbre[key], key))
        else:
            logger.warning(f"  ✗ Descriptor '{key}' vacío en {ruta_timbre}")

    # ── 2. Rítmico (valores globales + beat_intervals como distribución) ─
    ruta_ritmo = directorio / DESCRIPTOR_FILE_MAP["rhythmic"]
    if not ruta_ritmo.exists():
        logger.warning(f"  ✗ Falta rhythmic_descriptors.json en {directorio}")
        return None
    ritmo = _cargar_json(str(ruta_ritmo))

    partes_ritmo.append(np.array([ritmo.get("bpm", 0.0)], dtype=np.float32))
    partes_ritmo.append(np.array([ritmo.get("beat_confidence", 0.0)], dtype=np.float32))

    # Beat intervals como distribución estadística (captura regularidad rítmica)
    beat_intervals = ritmo.get("beat_intervals", [])
    if len(beat_intervals) > 0:
        partes_ritmo.append(_reducir_frames(beat_intervals, "beat_intervals"))
    else:
        partes_ritmo.append(np.zeros(2, dtype=np.float32))

    # ── 3. Melódico ──────────────────────────────────────────────────────
    ruta_melodia = directorio / DESCRIPTOR_FILE_MAP["melodic"]
    if not ruta_melodia.exists():
        logger.warning(f"  ✗ Falta melodic_descriptors.json en {directorio}")
        return None
    melodia = _cargar_json(str(ruta_melodia))

    for key in ["pitch", "pitch_confidence", "hpcp"]:
        if key in melodia and len(melodia[key]) > 0:
            partes_melodia.append(_reducir_frames(melodia[key], key))
        else:
            logger.warning(f"  ✗ Descriptor '{key}' vacío en {ruta_melodia}")

    partes_melodia.append(np.array([melodia.get("key_strength", 0.0)], dtype=np.float32))

    # ── Concatenar por categoría ─────────────────────────────────────────
    vector_timbre = np.concatenate(partes_timbre) if partes_timbre else np.array([], dtype=np.float32)
    vector_ritmo = np.concatenate(partes_ritmo) if partes_ritmo else np.array([], dtype=np.float32)
    vector_melodia = np.concatenate(partes_melodia) if partes_melodia else np.array([], dtype=np.float32)

    return {
        "timbre": vector_timbre,
        "ritmo": vector_ritmo,
        "melodia": vector_melodia
    }


# ─────────────────────────────────────────────────────────────────────────────
#  CLASE PRINCIPAL: MOTOR DE BÚSQUEDA
# ─────────────────────────────────────────────────────────────────────────────

class BaselineSearchEngine:
    """
    Motor de búsqueda por similitud de audio basado en descriptores DSP de Essentia.

    Uso típico (primera vez):
        motor = BaselineSearchEngine()
        motor.construir_indice("mi_base_datos/")
        motor.guardar_modelo("modelos/")

    Uso en producción (cargando modelo pre-entrenado):
        motor = BaselineSearchEngine()
        motor.cargar_modelo("modelos/")
        resultados = motor.buscar_audio_similar("query_descriptors/")
    """

    def __init__(self, n_vecinos: int = 5, metrica: str = "cosine"):
        """
        Args:
            n_vecinos: Número de vecinos más cercanos a devolver.
            metrica:   Métrica de distancia. Por defecto 'cosine' (ver justificación
                       en la cabecera del módulo). Otras opciones: 'euclidean', 'manhattan'.
        """
        self.n_vecinos    = n_vecinos
        self.metrica      = metrica

        # Tres scalers separados
        self.scaler_timbre = StandardScaler()
        self.scaler_ritmo = StandardScaler()
        self.scaler_melodia = StandardScaler()

        # Tres modelos KNN separados
        self.knn_timbre = NearestNeighbors(
            n_neighbors=n_vecinos,
            metric=metrica,
            algorithm="brute",
            n_jobs=-1
        )
        self.knn_ritmo = NearestNeighbors(
            n_neighbors=n_vecinos,
            metric=metrica,
            algorithm="brute",
            n_jobs=-1
        )
        self.knn_melodia = NearestNeighbors(
            n_neighbors=n_vecinos,
            metric=metrica,
            algorithm="brute",
            n_jobs=-1
        )

        # KNN combinado para "todos"
        self.knn_combinado = NearestNeighbors(
            n_neighbors=n_vecinos,
            metric=metrica,
            algorithm="brute",
            n_jobs=-1
        )

        self._indice_df: Optional[pd.DataFrame] = None  # tabla audio_id → ruta
        self._matriz_X_timbre: Optional[np.ndarray] = None
        self._matriz_X_ritmo: Optional[np.ndarray] = None
        self._matriz_X_melodia: Optional[np.ndarray] = None
        self._matriz_X_combinado: Optional[np.ndarray] = None
        self._dim_timbre: Optional[int] = None
        self._dim_ritmo: Optional[int] = None
        self._dim_melodia: Optional[int] = None
        self._entrenado  = False

    # ── Propiedades de estado ─────────────────────────────────────────────

    @property
    def entrenado(self) -> bool:
        """True si el motor tiene un índice construido y listo para buscar."""
        return self._entrenado

    @property
    def n_audios(self) -> int:
        """Número de audios indexados."""
        return len(self._indice_df) if self._indice_df is not None else 0

    # ── Construcción del índice ───────────────────────────────────────────

    def construir_indice(self, directorio_bd: str) -> "BaselineSearchEngine":
        """
        Escanea `directorio_bd` buscando subdirectorios con descriptores de Essentia,
        extrae features, normaliza y ajusta los modelos KNN.

        Estructura esperada de `directorio_bd`:
            directorio_bd/
                audio_001/
                    timbre_descriptors.json
                    rhythmic_descriptors.json
                    melodic_descriptors.json
                audio_002/
                    ...

        Args:
            directorio_bd: Ruta a la carpeta raíz de la base de datos de descriptores.

        Returns:
            self (para encadenamiento fluente).
        """
        directorio_bd = Path(directorio_bd)
        if not directorio_bd.is_dir():
            raise FileNotFoundError(f"El directorio de BD no existe: {directorio_bd}")

        logger.info(f"📂 Escaneando base de datos en: {directorio_bd.resolve()}")

        registros = []   # Lista de (audio_id, ruta_audio_wav, dict_vectores)

        # Buscar subdirectorios que contengan los descriptores
        subdirs = sorted([d for d in directorio_bd.iterdir() if d.is_dir()])
        logger.info(f"  Encontrados {len(subdirs)} subdirectorios candidatos.")

        for subdir in subdirs:
            vectores = extraer_features_de_directorio(str(subdir))
            if vectores is None:
                logger.warning(f"  ⚠ Ignorando '{subdir.name}' (descriptores incompletos).")
                continue

            # Intentar encontrar el WAV asociado (mismo nombre de carpeta + .wav)
            posibles_wav = list(subdir.glob("*.wav")) + list(directorio_bd.glob(f"{subdir.name}*.wav"))
            ruta_wav = str(posibles_wav[0]) if posibles_wav else f"{subdir.name}.wav"

            registros.append({
                "audio_id":   subdir.name,
                "ruta_audio": ruta_wav,
                "vectores":   vectores
            })
            logger.debug(f"  ✓ {subdir.name}: timbre={len(vectores['timbre'])}, ritmo={len(vectores['ritmo'])}, melodia={len(vectores['melodia'])}")

        if len(registros) == 0:
            raise ValueError(
                "No se encontró ningún audio válido en la base de datos. "
                "Comprueba que los subdirectorios contienen los tres JSONs de descriptores."
            )

        logger.info(f"  ✅ {len(registros)} audios indexados correctamente.")

        # ── Construir DataFrame de índice ─────────────────────────────────
        self._indice_df = pd.DataFrame([
            {"audio_id": r["audio_id"], "ruta_audio": r["ruta_audio"]}
            for r in registros
        ])

        # ── Ensamblar las matrices de features ───────────────────────────
        X_timbre_raw = np.vstack([r["vectores"]["timbre"] for r in registros]).astype(np.float32)
        X_ritmo_raw = np.vstack([r["vectores"]["ritmo"] for r in registros]).astype(np.float32)
        X_melodia_raw = np.vstack([r["vectores"]["melodia"] for r in registros]).astype(np.float32)

        self._dim_timbre = X_timbre_raw.shape[1]
        self._dim_ritmo = X_ritmo_raw.shape[1]
        self._dim_melodia = X_melodia_raw.shape[1]

        logger.info(f"  📐 Dimensiones: timbre={self._dim_timbre}, ritmo={self._dim_ritmo}, melodia={self._dim_melodia}")

        # ── Reemplazar NaN/Inf por 0 (salvaguarda) ───────────────────────
        X_timbre_raw = np.nan_to_num(X_timbre_raw, nan=0.0, posinf=0.0, neginf=0.0)
        X_ritmo_raw = np.nan_to_num(X_ritmo_raw, nan=0.0, posinf=0.0, neginf=0.0)
        X_melodia_raw = np.nan_to_num(X_melodia_raw, nan=0.0, posinf=0.0, neginf=0.0)

        # ── Normalización con StandardScaler ─────────────────────────────
        self._matriz_X_timbre = self.scaler_timbre.fit_transform(X_timbre_raw)
        self._matriz_X_ritmo = self.scaler_ritmo.fit_transform(X_ritmo_raw)
        self._matriz_X_melodia = self.scaler_melodia.fit_transform(X_melodia_raw)
        logger.info("  🔧 Normalización StandardScaler ajustada para cada categoría.")

        # ── Entrenar KNN individuales ─────────────────────────────────────
        self.knn_timbre.fit(self._matriz_X_timbre)
        self.knn_ritmo.fit(self._matriz_X_ritmo)
        self.knn_melodia.fit(self._matriz_X_melodia)

        # ── Entrenar KNN combinado ───────────────────────────────────────
        X_combinado_raw = np.hstack([X_timbre_raw, X_ritmo_raw, X_melodia_raw])
        self._matriz_X_combinado = StandardScaler().fit_transform(X_combinado_raw)  # Nuevo scaler para combinado
        self.knn_combinado.fit(self._matriz_X_combinado)

        self._entrenado = True
        logger.info(f"  🤖 KNNs ({self.metrica}) entrenados con {self.n_audios} audios.")

        return self

    # ── Búsqueda ──────────────────────────────────────────────────────────

    def buscar_audio_similar(
        self,
        entrada: Union[str, Dict[str, np.ndarray], dict],
        n_resultados: Optional[int] = None,
        filtro_categoria: str = "todos"
    ) -> pd.DataFrame:
        """
        Función principal de búsqueda. Punto de entrada para la interfaz web.

        Args:
            entrada: Puede ser:
                - str:        Ruta a un directorio con los JSONs de la query.
                - Dict[str, np.ndarray]: Diccionario con "timbre", "ritmo", "melodia".
                - dict:       Diccionario con claves 'timbre_path', 'rhythmic_path',
                              'melodic_path' apuntando a los tres JSONs por separado.
            n_resultados: Número de resultados a devolver (por defecto self.n_vecinos).
            filtro_categoria: "todos", "timbre", "ritmo", "melodia".

        Returns:
            pd.DataFrame con columnas:
                - rank:        Posición en el ranking (1 = más similar).
                - audio_id:    Identificador del audio en la BD.
                - ruta_audio:  Ruta al archivo WAV.
                - distancia:   Distancia coseno (0 = idéntico, 2 = opuesto).
                - similitud:   1 - distancia coseno (0→1, más alto = más similar).

        Raises:
            RuntimeError: Si el motor no ha sido entrenado previamente.
        """
        if not self._entrenado:
            raise RuntimeError(
                "El motor no está entrenado. Llama a construir_indice() o cargar_modelo() primero."
            )

        k = n_resultados or self.n_vecinos

        # ── Obtener vectores de la query ───────────────────────────────────
        if isinstance(entrada, dict) and all(key in entrada for key in ["timbre", "ritmo", "melodia"]):
            vectores_query = entrada
            logger.info("  🎤 Query recibida como dict de vectores.")
        elif isinstance(entrada, str):
            logger.info(f"  🎤 Extrayendo features de query: {entrada}")
            vectores_query = extraer_features_de_directorio(entrada)
            if vectores_query is None:
                raise ValueError(f"No se pudieron extraer features del directorio: {entrada}")
        elif isinstance(entrada, dict):
            # Modo alternativo: diccionario con rutas individuales
            vectores_query = self._extraer_de_dict(entrada)
        else:
            raise TypeError(f"Tipo de entrada no soportado: {type(entrada)}")

        # ── Seleccionar KNN y normalizar según filtro ─────────────────────
        if filtro_categoria == "timbre":
            vector_query = vectores_query["timbre"]
            if vector_query.shape[0] != self._dim_timbre:
                raise ValueError(f"Dimensión del vector de timbre ({vector_query.shape[0]}) no coincide con BD ({self._dim_timbre}).")
            vector_norm = self.scaler_timbre.transform(vector_query.reshape(1, -1))
            knn = self.knn_timbre
        elif filtro_categoria == "ritmo":
            vector_query = vectores_query["ritmo"]
            if vector_query.shape[0] != self._dim_ritmo:
                raise ValueError(f"Dimensión del vector de ritmo ({vector_query.shape[0]}) no coincide con BD ({self._dim_ritmo}).")
            vector_norm = self.scaler_ritmo.transform(vector_query.reshape(1, -1))
            knn = self.knn_ritmo
        elif filtro_categoria == "melodia":
            vector_query = vectores_query["melodia"]
            if vector_query.shape[0] != self._dim_melodia:
                raise ValueError(f"Dimensión del vector de melodia ({vector_query.shape[0]}) no coincide con BD ({self._dim_melodia}).")
            vector_norm = self.scaler_melodia.transform(vector_query.reshape(1, -1))
            knn = self.knn_melodia
        elif filtro_categoria == "todos":
            vector_timbre = vectores_query["timbre"]
            vector_ritmo = vectores_query["ritmo"]
            vector_melodia = vectores_query["melodia"]
            vector_combinado = np.concatenate([vector_timbre, vector_ritmo, vector_melodia])
            # Usar un scaler temporal para combinado (no guardado)
            scaler_temp = StandardScaler()
            scaler_temp.fit(np.hstack([self._matriz_X_timbre, self._matriz_X_ritmo, self._matriz_X_melodia]))
            vector_norm = scaler_temp.transform(vector_combinado.reshape(1, -1))
            knn = self.knn_combinado
        else:
            raise ValueError(f"Filtro categoría '{filtro_categoria}' no válido. Usa 'todos', 'timbre', 'ritmo' o 'melodia'.")

        # ── Limpiar valores no finitos ─────────────────────────────────────
        vector_norm = np.nan_to_num(vector_norm, nan=0.0, posinf=0.0, neginf=0.0)

        # ── Búsqueda de vecinos más cercanos ──────────────────────────────
        distancias, indices = knn.kneighbors(
            vector_norm, n_neighbors=min(k, self.n_audios)
        )

        distancias = distancias[0]   # (k,)
        indices    = indices[0]      # (k,)

        # ── Construir DataFrame de resultados ─────────────────────────────
        resultados = self._indice_df.iloc[indices].copy().reset_index(drop=True)
        resultados.insert(0, "rank", range(1, len(resultados) + 1))
        resultados["distancia"] = distancias
        resultados["similitud"] = 1.0 - distancias   # coseno: 0→idéntico, 1→opuesto

        logger.info(
            f"  🏆 Top-1: '{resultados.iloc[0]['audio_id']}' "
            f"(similitud={resultados.iloc[0]['similitud']:.4f})"
        )
        return resultados

    def audio_ganador(
        self,
        entrada: Union[str, Dict[str, np.ndarray], dict],
        filtro_categoria: str = "todos"
    ) -> str:
        """
        Atajo que devuelve directamente la RUTA del audio más similar.

        Args:
            entrada: Igual que buscar_audio_similar().
            filtro_categoria: Igual que buscar_audio_similar().

        Returns:
            str: Ruta al archivo WAV ganador.
        """
        resultados = self.buscar_audio_similar(entrada, n_resultados=1, filtro_categoria=filtro_categoria)
        return resultados.iloc[0]["ruta_audio"]

    # ── Persistencia del modelo ───────────────────────────────────────────

    def guardar_modelo(self, directorio_salida: str = ".") -> None:
        """
        Serializa los scalers y los modelos KNN a disco.

        Genera archivos en `directorio_salida`:
            - baseline_scaler_timbre.joblib
            - baseline_scaler_ritmo.joblib
            - baseline_scaler_melodia.joblib
            - baseline_knn_timbre.joblib
            - baseline_knn_ritmo.joblib
            - baseline_knn_melodia.joblib
            - baseline_knn_combinado.joblib
            - baseline_index.csv

        Args:
            directorio_salida: Carpeta donde guardar los archivos.
        """
        if not self._entrenado:
            raise RuntimeError("No hay modelo entrenado para guardar.")

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
        """
        Carga los scalers, los modelos KNN y el índice previamente serializados.

        Args:
            directorio_modelos: Carpeta con los archivos del modelo guardado.

        Returns:
            self (para encadenamiento fluente).
        """
        origen = Path(directorio_modelos)

        self.scaler_timbre     = joblib.load(origen / "baseline_scaler_timbre.joblib")
        self.scaler_ritmo      = joblib.load(origen / "baseline_scaler_ritmo.joblib")
        self.scaler_melodia    = joblib.load(origen / "baseline_scaler_melodia.joblib")
        self.knn_timbre        = joblib.load(origen / "baseline_knn_timbre.joblib")
        self.knn_ritmo         = joblib.load(origen / "baseline_knn_ritmo.joblib")
        self.knn_melodia       = joblib.load(origen / "baseline_knn_melodia.joblib")
        self.knn_combinado     = joblib.load(origen / "baseline_knn_combinado.joblib")
        self._indice_df = pd.read_csv(origen / INDEX_FILENAME)

        # Recuperar dims desde los scalers
        self._dim_timbre = self.scaler_timbre.n_features_in_
        self._dim_ritmo = self.scaler_ritmo.n_features_in_
        self._dim_melodia = self.scaler_melodia.n_features_in_
        self._entrenado  = True

        self.n_vecinos = self.knn_timbre.n_neighbors
        self.metrica   = self.knn_timbre.metric

        logger.info(
            f"📦 Modelo cargado desde {origen.resolve()} "
            f"({self.n_audios} audios, dims: timbre={self._dim_timbre}, ritmo={self._dim_ritmo}, melodia={self._dim_melodia})"
        )
        return self

    # ── Método auxiliar ───────────────────────────────────────────────────

    def _extraer_de_dict(self, rutas: dict) -> Dict[str, np.ndarray]:
        """
        Carga descriptores cuando se pasan como un diccionario de rutas individuales.

        Args:
            rutas: Diccionario con claves opcionales:
                - "timbre_path":   ruta a timbre_descriptors.json
                - "rhythmic_path": ruta a rhythmic_descriptors.json
                - "melodic_path":  ruta a melodic_descriptors.json

        Returns:
            Dict con "timbre", "ritmo", "melodia".
        """
        import tempfile, shutil

        # Crear directorio temporal con los JSONs bajo los nombres esperados
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            mapeo = {
                "timbre_path":   "timbre_descriptors.json",
                "rhythmic_path": "rhythmic_descriptors.json",
                "melodic_path":  "melodic_descriptors.json",
            }
            for clave, nombre in mapeo.items():
                if clave in rutas:
                    shutil.copy(rutas[clave], tmpdir / nombre)

            vectores = extraer_features_de_directorio(str(tmpdir))

        if vectores is None:
            raise ValueError("No se pudo construir los vectores de features desde el diccionario de rutas.")
        return vectores

    # ── Utilidades de diagnóstico ─────────────────────────────────────────

    def info(self) -> None:
        """Imprime un resumen del estado del motor."""
        estado = "✅ Entrenado" if self._entrenado else "❌ No entrenado"
        print(f"\n{'='*55}")
        print(f"  Voice2Sample — Baseline Search Engine")
        print(f"{'='*55}")
        print(f"  Estado:          {estado}")
        print(f"  Audios en BD:    {self.n_audios}")
        print(f"  Dim. timbre:     {self._dim_timbre}")
        print(f"  Dim. ritmo:      {self._dim_ritmo}")
        print(f"  Dim. melodia:    {self._dim_melodia}")
        print(f"  Métrica:         {self.metrica}")
        print(f"  K vecinos:       {self.n_vecinos}")
        print(f"{'='*55}\n")


# ─────────────────────────────────────────────────────────────────────────────
#  FUNCIÓN DE CONVENIENCIA PARA INTEGRACIÓN WEB
# ─────────────────────────────────────────────────────────────────────────────

def crear_motor_desde_modelo(directorio_modelos: str = "modelos/") -> BaselineSearchEngine:
    """
    Carga un motor pre-entrenado desde disco. Pensado para ser llamado
    una sola vez al arrancar el servidor web (evita re-indexar en cada petición).

    Args:
        directorio_modelos: Carpeta con los archivos del modelo guardado.

    Returns:
        BaselineSearchEngine listo para buscar.

    Ejemplo en Flask/FastAPI:
        # Al arrancar el servidor:
        motor = crear_motor_desde_modelo("modelos/")

        # En el endpoint de búsqueda:
        @app.post("/buscar")
        def buscar(directorio_query: str, filtro: str = "todos"):
            resultados = motor.buscar_audio_similar(directorio_query, filtro_categoria=filtro)
            return resultados.to_dict(orient="records")
    """
    motor = BaselineSearchEngine()
    motor.cargar_modelo(directorio_modelos)
    return motor


# ─────────────────────────────────────────────────────────────────────────────
#  SCRIPT DE DEMOSTRACIÓN (ejecutar directamente: python baseline_ml.py)
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Voice2Sample — Baseline ML Search Engine"
    )
    subparsers = parser.add_subparsers(dest="comando")

    # Subcomando: indexar
    p_idx = subparsers.add_parser("indexar", help="Construir y guardar el índice desde la BD.")
    p_idx.add_argument("--bd",     required=True, help="Directorio raíz con subdirectorios de descriptores.")
    p_idx.add_argument("--salida", default="modelos/", help="Dónde guardar el modelo (default: modelos/).")
    p_idx.add_argument("--k",      type=int, default=5, help="Número de vecinos (default: 5).")

    # Subcomando: buscar
    p_bus = subparsers.add_parser("buscar", help="Buscar audios similares para una query.")
    p_bus.add_argument("--modelos", required=True, help="Directorio con el modelo guardado.")
    p_bus.add_argument("--query",   required=True, help="Directorio con los descriptores de la query.")
    p_bus.add_argument("--k",       type=int, default=5, help="Número de resultados (default: 5).")
    p_bus.add_argument("--filtro",  default="todos", choices=["todos", "timbre", "ritmo", "melodia"], help="Filtro de categoría (default: todos).")

    args = parser.parse_args()

    if args.comando == "indexar":
        motor = BaselineSearchEngine(n_vecinos=args.k)
        motor.construir_indice(args.bd)
        motor.guardar_modelo(args.salida)
        motor.info()
        print(f"\n✅ Índice construido y guardado en '{args.salida}'.")

    elif args.comando == "buscar":
        motor = BaselineSearchEngine(n_vecinos=args.k)
        motor.cargar_modelo(args.modelos)
        motor.info()
        resultados = motor.buscar_audio_similar(args.query, filtro_categoria=args.filtro)
        print("\n🔍 Resultados de búsqueda:")
        print(resultados.to_string(index=False))

    else:
        parser.print_help()