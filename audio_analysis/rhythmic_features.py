import essentia.standard as es
import numpy as np
import os
import json


def save_json(data, filename):
    """Guarda un diccionario en un archivo JSON con indentación."""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def to_serializable(val):
    """
    Convierte valores de Essentia/numpy a tipos serializables.
    """
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

    # verificar archivo
    if not os.path.exists(audio_file):
        raise FileNotFoundError(
            f"Archivo no encontrado: {audio_file}"
        )

    # cargar audio
    audio = es.MonoLoader(filename=audio_file)()

    # extractor rítmico
    rhythm_extractor = es.RhythmExtractor2013()

    # extracción
    bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)

    # arrays numpy
    beats_array = np.array(beats)
    intervals_array = np.array(beats_intervals)

    # =========================
    # RESULTADO AGREGADO
    # =========================

    result = {

        # BPM
        "bpm": float(bpm),

        # beats
        "beats_count": int(len(beats_array)),

        # intervalos entre beats
        "beat_intervals_stats": {

            "mean": float(np.mean(intervals_array))
            if len(intervals_array) > 0 else 0.0,

            "std": float(np.std(intervals_array))
            if len(intervals_array) > 0 else 0.0,

            "min": float(np.min(intervals_array))
            if len(intervals_array) > 0 else 0.0,

            "max": float(np.max(intervals_array))
            if len(intervals_array) > 0 else 0.0
        },

        # confianza
        "beat_confidence":
            to_serializable(beats_confidence)
    }

    # =========================
    # GUARDAR JSON
    # =========================

    output_dir = "descriptors"
    os.makedirs(output_dir, exist_ok=True)

    # nombre del audio
    filename = os.path.splitext(
        os.path.basename(audio_file)
    )[0]

    output_file = os.path.join(
        output_dir,
        "rhythmic_descriptors.json"
    )

    # cargar JSON existente
    if os.path.exists(output_file):

        with open(output_file, "r", encoding="utf-8") as f:
            all_descriptors = json.load(f)

    else:
        all_descriptors = {}

    # añadir nuevo audio
    all_descriptors[filename] = result

    # guardar JSON actualizado
    save_json(all_descriptors, output_file)
    print("Extracción de descriptores de timbre completada y guardada en 'descriptors/timbre_descriptors.json'.")

    return result