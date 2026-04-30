import essentia.standard as es
import numpy as np
import os
import json


def save_json(data, filename):
    """Guarda un diccionario en un archivo JSON con indentación."""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def to_serializable(val):
    # Convierte valores de Essentia / numpy a tipos básicos de Python
    # para que el resultado se pueda usar fácilmente en JSON, CSV o impresión.
    if val is None:
        return []
    if hasattr(val, "tolist"):
        return val.tolist()
    if isinstance(val, (list, tuple)):
        return list(val)
    if isinstance(val, (int, float)):
        return float(val)
    return str(val)


def extract_rhythmic_descriptors(audio_file):
    # Verifica que el archivo de audio exista antes de procesarlo
    if not os.path.exists(audio_file):
        raise FileNotFoundError(f"Archivo no encontrado: {audio_file}")

    # Carga el audio en mono con Essentia
    audio = es.MonoLoader(filename=audio_file)()

    # Crea el extractor rítmico de Essentia
    rhythm_extractor = es.RhythmExtractor2013()

    # Ejecuta el extractor y obtiene los valores rítmicos
    bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)

    # Devuelve los descriptores en tipos serializables
    result = {
        "bpm": float(bpm),
        "beats": to_serializable(beats),
        "beat_confidence": to_serializable(beats_confidence),
        "beat_intervals": to_serializable(beats_intervals)
    }
    
    # Guardar en JSON
    output_dir = "descriptors"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "rhythmic_descriptors.json")
    save_json(result, output_file)
    print(f"✓ Descriptores rítmicos guardados en: {output_file}")
    
    return result