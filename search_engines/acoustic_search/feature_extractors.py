"""
feature_extractors.py
---------------------
Módulo integrador para Voice2Sample.

Es el eslabón perdido entre audio_analysis/ y Machine_Learning/.
inference.py lo importa así:

    from feature_extractors import extraer_features

CONTRATO
────────
Devuelve un dict plano { str: float } con exactamente los mismos
nombres de clave que generan los scripts de extracción durante el
entrenamiento, para que _alinear_vector() en inference.py funcione.
"""

import hashlib
import os
import sys
import threading
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

# Apunta a audio_analysis/ desde Machine_learning/machine/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../audio_analysis')))

from rhythmic_features import extract_rhythmic_descriptors
from melodic_features import extract_melodic_features
from timbre_features import extract_timbre_descriptors


# ─────────────────────────────────────────────────────────────
#  Caché de features por contenido del audio
#
#  Cada búsqueda en la interfaz sube el mismo audio varias veces
#  (recomendaciones + mapa, o el usuario cambia de focus). Extraer
#  features es caro (pyin tarda segundos), así que cacheamos por
#  hash del CONTENIDO del archivo — la ruta temporal cambia en cada
#  subida, el contenido no. La clave incluye la categoría para que
#  "general" reutilice lo ya calculado por ritmo/melodía/timbre.
# ─────────────────────────────────────────────────────────────

_CACHE_MAX = 16
_feature_cache: "OrderedDict[tuple[str, str], dict]" = OrderedDict()
_cache_lock = threading.Lock()


def _file_sha1(path: str) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _extraer_con_cache(categoria: str, extractor, audio_file: str) -> dict:
    key = (_file_sha1(audio_file), categoria)
    with _cache_lock:
        cached = _feature_cache.get(key)
        if cached is not None:
            _feature_cache.move_to_end(key)
            return dict(cached)

    result = extractor(audio_file)
    if result is None:
        raise ValueError(f"Audio silencioso o inválido: {audio_file}")

    with _cache_lock:
        _feature_cache[key] = result
        if len(_feature_cache) > _CACHE_MAX:
            _feature_cache.popitem(last=False)
    return dict(result)


# ─────────────────────────────────────────────────────────────
#  Mapa de modo → función extractora
# ─────────────────────────────────────────────────────────────

def _extraer_ritmo(audio_file: str) -> dict:
    return _extraer_con_cache("ritmo", extract_rhythmic_descriptors, audio_file)


def _extraer_melodia(audio_file: str) -> dict:
    return _extraer_con_cache("melodia", extract_melodic_features, audio_file)


def _extraer_timbre(audio_file: str) -> dict:
    return _extraer_con_cache("timbre", extract_timbre_descriptors, audio_file)


def _extraer_general(audio_file: str) -> dict:
    """
    Concatena ritmo + melodía + timbre en un único dict.
    Replica exactamente lo que hace combinar_descriptores() en train_models.py
    durante el entrenamiento, pero para un solo audio en inferencia.
    """
    # Los tres extractores son independientes entre sí: lanzarlos en paralelo
    # reduce el tiempo del modo general al del extractor más lento (pyin).
    with ThreadPoolExecutor(max_workers=3) as pool:
        futuro_ritmo   = pool.submit(_extraer_ritmo, audio_file)
        futuro_melodia = pool.submit(_extraer_melodia, audio_file)
        futuro_timbre  = pool.submit(_extraer_timbre, audio_file)
        ritmo   = futuro_ritmo.result()
        melodia = futuro_melodia.result()
        timbre  = futuro_timbre.result()

    # Los tres dicts no tienen claves solapadas, pero por si acaso
    # damos prioridad en orden: ritmo < melodia < timbre
    combined = {}
    combined.update(ritmo)
    combined.update(melodia)
    combined.update(timbre)
    return combined


# ─────────────────────────────────────────────────────────────
#  Función pública (único punto de entrada)
# ─────────────────────────────────────────────────────────────

_EXTRACTORES = {
    "ritmo":    _extraer_ritmo,
    "melodia":  _extraer_melodia,
    "timbre":   _extraer_timbre,
    "general":  _extraer_general,
}


def extraer_features(audio_file: str, modo: str) -> dict:
    """
    Extrae las features de un audio para el modo indicado.

    Parameters
    ----------
    audio_file : str
        Ruta al archivo de audio (.wav, .mp3, .aiff, …).
    modo : str
        "ritmo" | "melodia" | "timbre" | "general"

    Returns
    -------
    dict { str: float }
        Features listas para pasarle a _alinear_vector() en inference.py.

    Raises
    ------
    ValueError          — modo no reconocido o audio silencioso
    FileNotFoundError   — archivo no encontrado
    """
    if not os.path.exists(audio_file):
        raise FileNotFoundError(f"Audio no encontrado: {audio_file}")

    if modo not in _EXTRACTORES:
        raise ValueError(
            f"Modo '{modo}' no válido. Opciones: {list(_EXTRACTORES.keys())}"
        )

    return _EXTRACTORES[modo](audio_file)
