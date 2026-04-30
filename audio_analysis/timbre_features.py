import essentia.standard as es
import numpy as np
import os
import json


def save_json(data, filename):
    """Guarda un diccionario en un archivo JSON con indentación."""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _compute_spectral_features(spec, freq_bins):
    """
    Calcula características espectrales a partir de un espectro.
    
    Args:
        spec: Espectro de magnitud
        freq_bins: Array de frecuencias correspondientes
        
    Returns:
        tuple: (centroid, spread, rolloff)
    """
    # Normalizar espectro para obtener distribución de probabilidad
    normalized_spec = spec / (np.sum(spec) + 1e-8)
    
    # Centroide espectral: frecuencia promedio ponderada
    centroid = np.sum(freq_bins * normalized_spec)
    
    # Spread espectral: desviación respecto al centroide
    spread = np.sqrt(np.sum(normalized_spec * (freq_bins - centroid) ** 2))
    
    # Rolloff: frecuencia bajo la cual está el 85% de energía
    cumsum = np.cumsum(normalized_spec)
    rolloff_idx = np.argmax(cumsum >= 0.85)
    rolloff = freq_bins[min(rolloff_idx, len(freq_bins) - 1)]
    
    return float(centroid), float(spread), float(rolloff)


def extract_timbre_descriptors(audio_file):
    """
    Extrae descriptores de timbre de un archivo de audio.
    
    Descriptores extraídos:
    - MFCC (13 coeficientes)
    - GFCC (13 coeficientes)
    - Centroide espectral
    - Spread espectral
    - Rolloff espectral
    - Flux espectral
    - Zero crossing rate
    
    Args:
        audio_file (str): Ruta al archivo de audio
        
    Returns:
        dict: Diccionario con todos los descriptores
    """
    # Validar que el archivo existe
    if not os.path.exists(audio_file):
        raise FileNotFoundError(f"Archivo no encontrado: {audio_file}")
    
    # Cargar audio en mono
    audio = es.MonoLoader(filename=audio_file)()
    
    # Parámetros de procesamiento
    frame_size = 2048
    hop_size = 1024
    sample_rate = 44100
    
    # Inicializar procesadores
    window = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=frame_size)
    mfcc = es.MFCC(numberCoefficients=13)
    gfcc = es.GFCC(numberCoefficients=13)
    zcr = es.ZeroCrossingRate()
    
    # Almacenamiento de características
    descriptors = {
        "mfcc": [],
        "gfcc": [],
        "spectral_centroid": [],
        "spectral_spread": [],
        "spectral_rolloff": [],
        "spectral_flux": [],
        "zero_crossing_rate": []
    }
    
    prev_spectrum = None
    freq_bins = None
    
    # Procesar audio frame por frame
    for frame in es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size):
        # Aplicar ventana y calcular espectro
        windowed_frame = window(frame)
        spec = spectrum(windowed_frame)
        
        # Inicializar bins de frecuencia en la primera iteración
        if freq_bins is None:
            freq_bins = np.linspace(0, sample_rate / 2, len(spec))
        
        # MFCC y GFCC
        _, mfcc_coeffs = mfcc(spec)
        descriptors["mfcc"].append(mfcc_coeffs.tolist())
        
        _, gfcc_coeffs = gfcc(spec)
        descriptors["gfcc"].append(gfcc_coeffs.tolist())
        
        # Zero crossing rate
        descriptors["zero_crossing_rate"].append(float(zcr(frame)))
        
        # Características espectrales
        centroid, spread, rolloff = _compute_spectral_features(spec, freq_bins)
        descriptors["spectral_centroid"].append(centroid)
        descriptors["spectral_spread"].append(spread)
        descriptors["spectral_rolloff"].append(rolloff)
        
        # Flux espectral: cambio de energía entre frames consecutivos
        if prev_spectrum is not None:
            flux = float(np.sqrt(np.sum((spec - prev_spectrum) ** 2)))
            descriptors["spectral_flux"].append(flux)
        
        prev_spectrum = spec
    
    # Guardar en JSON
    output_dir = "descriptors"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "timbre_descriptors.json")
    save_json(descriptors, output_file)
    print(f"✓ Descriptores de timbre guardados en: {output_file}")
    
    return descriptors