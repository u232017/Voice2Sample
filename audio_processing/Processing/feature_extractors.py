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

import os
import sys

# Apunta a audio_analysis/ desde Machine_learning/machine/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../audio_analysis')))

from rhythmic_features import extract_rhythmic_descriptors
from melodic_features import extract_melodic_features
from timbre_features import extract_timbre_descriptors


# ─────────────────────────────────────────────────────────────
#  Mapa de modo → función extractora
# ─────────────────────────────────────────────────────────────

def _extraer_ritmo(audio_file: str) -> dict:
    result = extract_rhythmic_descriptors(audio_file)
    if result is None:
        raise ValueError(f"Audio silencioso o inválido: {audio_file}")
    return result


def _extraer_melodia(audio_file: str) -> dict:
    result = extract_melodic_features(audio_file)
    if result is None:
        raise ValueError(f"Audio silencioso o inválido: {audio_file}")
    return result


def _extraer_timbre(audio_file: str) -> dict:
    result = extract_timbre_descriptors(audio_file)
    if result is None:
        raise ValueError(f"Audio silencioso o inválido: {audio_file}")
    return result


def _extraer_essentia(audio_file: str) -> dict:
    """
    Usa los descriptores de Essentia (music_all.json) directamente.
    Solo se aplana el JSON ya extraído por Essentia; no requiere
    llamar a ninguna función de audio_analysis/.

    Si el audio de query no está en music_all.json (caso típico en
    producción), lanza ValueError con instrucción de cómo añadirlo.
    """
    import json

    json_essentia = os.path.join(
        os.path.dirname(__file__), "descriptors", "music_all.json"
    )
    if not os.path.exists(json_essentia):
        raise FileNotFoundError(
            f"No se encontró music_all.json en {json_essentia}. "
            "Genera primero los descriptores de Essentia."
        )

    with open(json_essentia, "r", encoding="utf-8") as f:
        datos = json.load(f)

    audio_id = os.path.splitext(os.path.basename(audio_file))[0]

    if audio_id not in datos:
        raise ValueError(
            f"El audio '{audio_id}' no está en music_all.json. "
            "Añádelo ejecutando el pipeline de Essentia sobre este archivo."
        )

    def _aplanar(valor, prefijo=""):
        resultado = {}
        if isinstance(valor, dict):
            for k, v in valor.items():
                sub = f"{prefijo}{k}_" if prefijo else f"{k}_"
                resultado.update(_aplanar(v, prefijo=sub))
        elif isinstance(valor, (list, tuple)):
            for i, v in enumerate(valor):
                resultado.update(_aplanar(v, prefijo=f"{prefijo}{i}_"))
        elif isinstance(valor, (int, float)) and not isinstance(valor, bool):
            resultado[prefijo.rstrip("_")] = float(valor)
        return resultado

    return _aplanar(datos[audio_id])


def _extraer_general(audio_file: str) -> dict:
    """
    Concatena ritmo + melodía + timbre en un único dict.
    Replica exactamente lo que hace combinar_descriptores() en train_models.py
    durante el entrenamiento, pero para un solo audio en inferencia.
    """
    ritmo   = _extraer_ritmo(audio_file)
    melodia = _extraer_melodia(audio_file)
    timbre  = _extraer_timbre(audio_file)

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
    "essentia": _extraer_essentia,
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
