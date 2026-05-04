import essentia.standard as es
import numpy as np
import os
import json


def save_json(data, filename):
    """Guarda un diccionario en un archivo JSON con indentación."""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def extract_melodic_features(audio_file):

    # Verifica que el archivo exista antes de procesarlo
    if not os.path.exists(audio_file):
        raise FileNotFoundError(f"Archivo no encontrado: {audio_file}")

    # Carga el audio en mono
    audio = es.MonoLoader(filename=audio_file)()

    # Inicializa los extractores de Essentia necesarios
    pitch_extractor = es.PitchYinFFT()      # detección de pitch en cada frame
    spectrum = es.Spectrum()               # espectro de magnitudes
    window = es.Windowing(type="hann")    # ventana para suavizar cada frame

    spectral_peaks = es.SpectralPeaks()     # detección de picos espectrales
    hpcp = es.HPCP(size=12)                 # Harmonic Pitch Class Profile
    key_extractor = es.KeyExtractor()       # detección de tonalidad global

    # Parámetros de frame
    frame_size = 2048
    hop_size = 1024

    # Listas para guardar los descriptores por frame
    pitches = []
    confidences = []
    hpcp_vectors = []

    # Recorre el audio en frames
    for frame in es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size):

        # Aplica ventana y calcula el espectro de magnitud
        w = window(frame)
        spec = spectrum(w)

        # Extrae pitch y su confianza para cada frame
        pitch, conf = pitch_extractor(w)
        pitches.append(float(pitch))
        confidences.append(float(conf))

        # Encuentra los picos espectrales necesarios para HPCP
        freqs, mags = spectral_peaks(spec)

        # Calcula HPCP usando frecuencias y magnitudes de los picos
        h = hpcp(freqs, mags)
        hpcp_vectors.append(h.tolist())

    # Extrae la tonalidad global a partir de todo el audio
    key, scale, strength = key_extractor(audio)

    result = {
        "pitch": pitches,
        "pitch_confidence": confidences,
        "hpcp": hpcp_vectors,
        "key": str(key),
        "scale": str(scale),
        "key_strength": float(strength)
    }
    
    # Guardar en JSON
    output_dir = "descriptors"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "melodic_descriptors.json")
    save_json(result, output_file)
    print(f"✓ Descriptores melódicos guardados en: {output_file}")
    
    return result