import essentia
import essentia.standard as es
import numpy as np
import os
import json


def save_json(data, filename):
    """Guarda un diccionario en un archivo JSON con indentación."""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

#music extractor de freesound utiles para musica

def to_serializable(val):
    """Convierte valores numpy/escalares a tipos serializables."""
    if hasattr(val, 'tolist'):
        return val.tolist()
    elif isinstance(val, (list, tuple)):
        return list(val)
    else:
        return float(val) if isinstance(val, (int, float)) else str(val)


def extract_music_descriptors(audio_file):
    """
    Extract music descriptors from an audio file using Essentia.
    
    Args:
        audio_file (str): Path to the audio file
        
    Returns:
        dict: Dictionary containing music descriptors
    """
    # Validate file exists
    if not os.path.exists(audio_file):
        raise FileNotFoundError(f"Audio file not found: {audio_file}")
    
    # Create and run extractor
    extractor = es.MusicExtractor()
    features, features_frames = extractor(audio_file)
    
    # Convert Pool to dictionary
    features_dict = {}
    for key in features.descriptorNames():
        features_dict[key] = to_serializable(features[key])
    
    print(f"✓ Total de descriptores extraídos: {len(features_dict)}")
    
    # Crear directorio descriptors si no existe
    output_dir = "descriptors"
    os.makedirs(output_dir, exist_ok=True)
    
    # Guardar en JSON
    output_file = os.path.join(output_dir, "music_descriptors.json")
    save_json(features_dict, output_file)
    print(f"✓ Descriptores guardados en: {output_file}")
    
    return features_dict