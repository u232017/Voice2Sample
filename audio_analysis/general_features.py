import essentia.standard as es
import numpy as np
import os
import json


def save_json(data, filename):
    """Guarda un diccionario en JSON con indentación."""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def to_serializable(val):
    """Convierte valores de Essentia/numpy a tipos serializables."""
    if hasattr(val, "tolist"):
        return val.tolist()
    if isinstance(val, (list, tuple)):
        return list(val)
    if isinstance(val, (int, float)):
        return float(val)
    return str(val)


def extract_music_descriptors(audio_file):
    """
    Extrae TODOS los descriptores usando Essentia MusicExtractor
    y los guarda en formato JSON estructurado por audio.
    """

    # verificar archivo
    if not os.path.exists(audio_file):
        raise FileNotFoundError(
            f"Audio file not found: {audio_file}"
        )

    # ejecutar extractor
    extractor = es.MusicExtractor()
    features, features_frames = extractor(audio_file)

    # convertir Pool → dict serializable
    features_dict = {}

    for key in features.descriptorNames():
        features_dict[key] = to_serializable(features[key])

    print(f"✓ Total de descriptores extraídos: {len(features_dict)}")

    # =========================
    # GUARDAR JSON ESTRUCTURADO
    # =========================

    output_dir = "descriptors"
    os.makedirs(output_dir, exist_ok=True)

    filename = os.path.splitext(
        os.path.basename(audio_file)
    )[0]

    output_file = os.path.join(
        output_dir,
        "music_descriptors.json"
    )

    # cargar existentes
    if os.path.exists(output_file):

        with open(output_file, "r", encoding="utf-8") as f:
            all_descriptors = json.load(f)

    else:
        all_descriptors = {}

    # guardar por canción
    all_descriptors[filename] = features_dict

    save_json(all_descriptors, output_file)
    print("Extracción de descriptores de timbre completada y guardada en 'descriptors/timbre_descriptors.json'.")

    return features_dict