import essentia.standard as es
import numpy as np
import os
import json


def save_json(data, filename):
    """Guarda un diccionario en JSON."""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def compute_stats(array):
    """
    Calcula estadísticas básicas de un array.
    
    Returns:
        dict con mean, std, min y max
    """
    return {
        "mean": float(np.mean(array)),
        "std": float(np.std(array)),
        "min": float(np.min(array)),
        "max": float(np.max(array))
    }


def compute_vector_stats(matrix):
    """
    Calcula estadísticas para vectores (MFCC/GFCC).
    
    Returns:
        dict con mean y std por coeficiente
    """
    return {
        "mean": np.mean(matrix, axis=0).tolist(),
        "std": np.std(matrix, axis=0).tolist()
    }


def compute_spectral_features(spec, freq_bins):
    """
    Calcula centroid, spread y rolloff.
    """

    normalized_spec = spec / (np.sum(spec) + 1e-8)

    # centroid
    centroid = np.sum(freq_bins * normalized_spec)

    # spread
    spread = np.sqrt(
        np.sum(normalized_spec * (freq_bins - centroid) ** 2)
    )

    # rolloff
    cumulative = np.cumsum(normalized_spec)
    rolloff_idx = np.argmax(cumulative >= 0.85)
    rolloff = freq_bins[min(rolloff_idx, len(freq_bins) - 1)]

    return centroid, spread, rolloff


def extract_timbre_descriptors(audio_file):
    """
    Extrae descriptores de timbre usando análisis frame-by-frame.

    Features:
    - MFCC
    - GFCC
    - Spectral Centroid
    - Spectral Spread
    - Spectral Rolloff
    - Spectral Flux
    - Zero Crossing Rate
    """

    # comprobar archivo
    if not os.path.exists(audio_file):
        raise FileNotFoundError(f"Archivo no encontrado: {audio_file}")

    # cargar audio
    audio = es.MonoLoader(filename=audio_file)()

    # parámetros
    frame_size = 2048
    hop_size = 1024
    sample_rate = 44100

    # algoritmos
    window = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=frame_size)

    mfcc = es.MFCC(numberCoefficients=13)
    gfcc = es.GFCC(numberCoefficients=13)

    zcr = es.ZeroCrossingRate()

    # almacenamiento temporal
    mfcc_frames = []
    gfcc_frames = []

    centroid_frames = []
    spread_frames = []
    rolloff_frames = []

    flux_frames = []
    zcr_frames = []

    prev_spec = None
    freq_bins = None

    # recorrer frames
    for frame in es.FrameGenerator(
        audio,
        frameSize=frame_size,
        hopSize=hop_size
    ):

        # ventana
        windowed = window(frame)

        # espectro
        spec = spectrum(windowed)

        # bins frecuencia
        if freq_bins is None:
            freq_bins = np.linspace(
                0,
                sample_rate / 2,
                len(spec)
            )

        # MFCC
        _, mfcc_coeffs = mfcc(spec)
        mfcc_frames.append(mfcc_coeffs)

        # GFCC
        _, gfcc_coeffs = gfcc(spec)
        gfcc_frames.append(gfcc_coeffs)

        # ZCR
        zcr_frames.append(zcr(frame))

        # spectral features
        centroid, spread, rolloff = compute_spectral_features(
            spec,
            freq_bins
        )

        centroid_frames.append(centroid)
        spread_frames.append(spread)
        rolloff_frames.append(rolloff)

        # spectral flux
        if prev_spec is not None:
            flux = np.sqrt(np.sum((spec - prev_spec) ** 2))
            flux_frames.append(flux)

        prev_spec = spec

    # convertir a arrays
    mfcc_array = np.array(mfcc_frames)
    gfcc_array = np.array(gfcc_frames)

    centroid_array = np.array(centroid_frames)
    spread_array = np.array(spread_frames)
    rolloff_array = np.array(rolloff_frames)

    flux_array = np.array(flux_frames)
    zcr_array = np.array(zcr_frames)

    # =========================
    # RESULTADO FINAL AGREGADO
    # =========================

    result = {

        # MFCC
        "mfcc": compute_vector_stats(mfcc_array),

        # GFCC
        "gfcc": compute_vector_stats(gfcc_array),

        # spectral centroid
        "spectral_centroid":
            compute_stats(centroid_array),

        # spectral spread
        "spectral_spread":
            compute_stats(spread_array),

        # spectral rolloff
        "spectral_rolloff":
            compute_stats(rolloff_array),

        # spectral flux
        "spectral_flux":
            compute_stats(flux_array),

        # zero crossing rate
        "zero_crossing_rate":
            compute_stats(zcr_array),

        # metadata
        "num_frames": len(mfcc_frames),
        "frame_size": frame_size,
        "hop_size": hop_size
    }

    # =========================
    # GUARDAR JSON
    # =========================

    output_dir = "descriptors"
    os.makedirs(output_dir, exist_ok=True)

    filename = os.path.splitext(
        os.path.basename(audio_file)
    )[0]

    output_file = os.path.join(
        output_dir,
        "timbre_descriptors.json"
    )

    # cargar existentes
    if os.path.exists(output_file):

        with open(output_file, "r", encoding="utf-8") as f:
            all_descriptors = json.load(f)

    else:
        all_descriptors = {}

    # guardar audio actual
    all_descriptors[filename] = result

    # escribir JSON
    save_json(all_descriptors, output_file)
    
    print("Extracción de descriptores de timbre completada y guardada en 'descriptors/timbre_descriptors.json'.")

    return result