"""
inference.py
------------
Motor de inferencia de Voice2Sample.

Expone dos interfaces equivalentes:

    1. Función directa (más simple):
        from inference import buscar_similar
        resultados = buscar_similar("sample.wav", modo="timbre", top_k=5)

    2. Clase (mejor para múltiples búsquedas, cachea los modelos en RAM):
        from inference import BuscadorSimilitud
        buscador = BuscadorSimilitud(models_dir="./models")
        resultados = buscador.buscar("sample.wav", modo="ritmo", top_k=5)

FORMATO DE RETORNO
──────────────────
Lista de dicts ordenados de más a menos similar:

    [
      {
        "rank":       1,
        "nombre":     "kick_001",       # ID del audio en la BD
        "distancia":  0.1823,           # distancia euclídea normalizada
        "similitud":  0.8177,           # 1 - distancia_normalizada
      },
      ...
    ]
"""

import os
import numpy as np
import joblib

from feature_extractors import extraer_features

# ─────────────────────────────────────────────────────────────
#  Constantes
# ─────────────────────────────────────────────────────────────

MODOS_VALIDOS = ("ritmo", "melodia", "timbre", "general")


# ─────────────────────────────────────────────────────────────
#  Utilidad: alinear vector de query con columnas del modelo
# ─────────────────────────────────────────────────────────────

def _alinear_vector(feats_dict, columnas_modelo):
    """
    Construye un vector numpy de shape (1, D) alineado con las columnas
    del modelo KNN.

    - Features presentes en feats_dict pero no en el modelo → se ignoran.
    - Features del modelo ausentes en feats_dict           → se rellenan con 0.

    Esto garantiza compatibilidad aunque el audio de query tenga
    ligeras diferencias (p. ej. un frame menos de audio muy corto).

    Parameters
    ----------
    feats_dict      : dict { str: float }  — features extraídas del query
    columnas_modelo : list[str]            — orden de columnas del KNN

    Returns
    -------
    np.ndarray — shape (1, len(columnas_modelo)), dtype float32
    """
    vector = np.zeros(len(columnas_modelo), dtype=np.float32)
    for i, col in enumerate(columnas_modelo):
        if col in feats_dict:
            vector[i] = feats_dict[col]
    return vector.reshape(1, -1)


# ─────────────────────────────────────────────────────────────
#  Clase principal
# ─────────────────────────────────────────────────────────────

class BuscadorSimilitud:
    """
    Motor de búsqueda por similitud de audio.

    Cachea los modelos en RAM para evitar leer disco en cada búsqueda.
    Ideal cuando se hacen múltiples consultas seguidas.

    Parameters
    ----------
    models_dir : str
        Carpeta donde están los .joblib generados por train_models.py.
    """

    def __init__(self, models_dir="./models"):
        self.models_dir = models_dir
        self._cache = {}   # { modo: {"scaler": ..., "knn": ...,
                           #          "meta": [...], "columnas": [...]} }

    # ──────────────────────────────────────────────────────────
    #  Carga de modelos (con caché)
    # ──────────────────────────────────────────────────────────

    def _cargar_modelo(self, modo):
        """
        Carga en RAM (si no está cacheado) los artefactos de un modo.
        Lanza FileNotFoundError con mensaje claro si faltan los .joblib.
        """
        if modo in self._cache:
            return self._cache[modo]

        d = self.models_dir
        ruta_knn      = os.path.join(d, f"knn_{modo}.joblib")
        ruta_meta     = os.path.join(d, f"meta_{modo}.joblib")
        ruta_columnas = os.path.join(d, f"columnas_{modo}.joblib")

        for ruta in [ruta_knn, ruta_meta, ruta_columnas]:
            if not os.path.exists(ruta):
                raise FileNotFoundError(
                    f"Modelo '{modo}' no encontrado: {ruta}\n"
                    f"Ejecuta primero: python train_models.py "
                    f"--output_dir {self.models_dir}"
                )

        bundle   = joblib.load(ruta_knn)       # {"scaler": ..., "knn": ...}
        meta     = joblib.load(ruta_meta)      # list[str] de IDs de audio
        columnas = joblib.load(ruta_columnas)  # list[str] de nombres de feature

        self._cache[modo] = {
            "scaler":   bundle["scaler"],
            "knn":      bundle["knn"],
            "meta":     meta,
            "columnas": columnas,
        }
        return self._cache[modo]

    # ──────────────────────────────────────────────────────────
    #  Búsqueda
    # ──────────────────────────────────────────────────────────

    def buscar(self, ruta_audio, modo="general", top_k=5):
        """
        Busca los audios más similares al audio de query.

        Parameters
        ----------
        ruta_audio : str
            Ruta al archivo de audio (.wav, .mp3, .aiff, …).
        modo : str
            "ritmo" | "melodia" | "timbre" | "general"
        top_k : int
            Número de resultados a devolver.

        Returns
        -------
        list[dict]
            Lista ordenada de más a menos similar con claves:
            rank, nombre, distancia, similitud.

        Raises
        ------
        ValueError          — modo no reconocido
        FileNotFoundError   — audio o modelo no encontrado
        """
        # Validaciones
        if modo not in MODOS_VALIDOS:
            raise ValueError(f"Modo '{modo}' no válido. Opciones: {MODOS_VALIDOS}")

        if not os.path.exists(ruta_audio):
            raise FileNotFoundError(f"Audio no encontrado: {ruta_audio}")

        # 1. Extraer features del audio de query
        print(f"  Extrayendo features [{modo}] de: {os.path.basename(ruta_audio)}")
        feats_dict = extraer_features(ruta_audio, modo)

        # 2. Cargar modelo (con caché)
        modelo = self._cargar_modelo(modo)
        scaler   = modelo["scaler"]
        knn      = modelo["knn"]
        meta     = modelo["meta"]
        columnas = modelo["columnas"]

        # 3. Alinear vector con las columnas del modelo y normalizar
        vector_raw    = _alinear_vector(feats_dict, columnas)
        vector_scaled = scaler.transform(vector_raw)

        # 4. Ajustar top_k al máximo disponible en este modelo
        k_efectivo = min(top_k, len(meta))
        if k_efectivo < top_k:
            print(f"  ⚠  top_k reducido a {k_efectivo} "
                  f"(solo {len(meta)} audios en la BD del modo '{modo}')")

        # 5. Búsqueda KNN
        distancias, indices = knn.kneighbors(vector_scaled, n_neighbors=k_efectivo)
        distancias = distancias[0]  # shape (k,)
        indices    = indices[0]     # shape (k,)

        # 6. Normalizar distancias a similitud [0, 1]
        # Usamos 1 / (1 + d) para que distancia=0 → similitud=1
        # y la similitud sea siempre positiva sin importar la escala.
        similitudes = 1.0 / (1.0 + distancias)

        # 7. Construir resultado
        resultados = []
        for rank, (idx, dist, sim) in enumerate(
                zip(indices, distancias, similitudes), start=1):
            resultados.append({
                "rank":       rank,
                "nombre":     meta[idx],
                "distancia":  float(dist),
                "similitud":  float(sim),
            })

        return resultados

    def info(self):
        """Imprime un resumen de los modelos cargados en caché."""
        print("\n── BuscadorSimilitud — modelos en caché ──────────────────────")
        if not self._cache:
            print("  (ninguno cargado aún)")
        for modo, datos in self._cache.items():
            print(f"  [{modo:<8}]  {len(datos['meta'])} audios | "
                  f"{len(datos['columnas'])} features")
        print()


# ─────────────────────────────────────────────────────────────
#  Función de conveniencia (stateless)
# ─────────────────────────────────────────────────────────────

def buscar_similar(ruta_audio, modo="general", top_k=5, models_dir="./models"):
    """
    Interfaz funcional de alto nivel para Voice2Sample.

    Crea un BuscadorSimilitud temporal, ejecuta la búsqueda y devuelve
    los resultados. Para múltiples búsquedas, usa la clase directamente
    para aprovechar el caché.

    Parameters
    ----------
    ruta_audio  : str  — ruta al audio de query
    modo        : str  — "ritmo" | "melodia" | "timbre" | "general"
    top_k       : int  — número de resultados (default 5)
    models_dir  : str  — carpeta con los .joblib (default "./models")

    Returns
    -------
    list[dict]  — misma estructura que BuscadorSimilitud.buscar()

    Ejemplo
    -------
        from inference import buscar_similar

        resultados = buscar_similar("mi_sample.wav", modo="timbre", top_k=3)
        for r in resultados:
            print(r["rank"], r["nombre"], f"{r['similitud']:.3f}")
    """
    buscador = BuscadorSimilitud(models_dir=models_dir)
    return buscador.buscar(ruta_audio=ruta_audio, modo=modo, top_k=top_k)