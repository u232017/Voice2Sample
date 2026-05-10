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

    # Inicializa extractores
    pitch_extractor = es.PitchYinFFT()
    spectrum = es.Spectrum()
    window = es.Windowing(type="hann")

    spectral_peaks = es.SpectralPeaks()
    hpcp = es.HPCP(size=12)

    key_extractor = es.KeyExtractor()

    # Parámetros
    frame_size = 2048
    hop_size = 4096

    # Almacenamiento temporal
    pitches = []
    confidences = []
    hpcp_vectors = []

    # Procesamiento frame a frame
    for frame in es.FrameGenerator(
        audio,
        frameSize=frame_size,
        hopSize=hop_size
    ):

        # ventana + espectro
        w = window(frame)
        spec = spectrum(w)

        # pitch
        pitch, conf = pitch_extractor(w)

        pitches.append(float(pitch))
        confidences.append(float(conf))

        # picos espectrales
        freqs, mags = spectral_peaks(spec)

        # HPCP
        h = hpcp(freqs, mags)
        hpcp_vectors.append(h.tolist())

    # tonalidad global
    key, scale, strength = key_extractor(audio)

    # =========================
    # ESTADÍSTICAS
    # =========================

    pitches_array = np.array(pitches)
    confidences_array = np.array(confidences)
    hpcp_array = np.array(hpcp_vectors)

    result = {

        # pitch
        "pitch_stats": {
            "mean": float(np.mean(pitches_array)),
            "std": float(np.std(pitches_array)),
            "min": float(np.min(pitches_array)),
            "max": float(np.max(pitches_array))
        },

        # confianza pitch
        "pitch_confidence_stats": {
            "mean": float(np.mean(confidences_array)),
            "std": float(np.std(confidences_array))
        },

        # HPCP promedio
        "hpcp_mean":
            np.mean(hpcp_array, axis=0).tolist(),

        # tonalidad
        "key": str(key),
        "scale": str(scale),
        "key_strength": float(strength),

        # metadata
        "num_frames": len(pitches),
        "frame_size": frame_size,
        "hop_size": hop_size
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
        "melodic_descriptors.json"
    )

    # cargar JSON existente
    if os.path.exists(output_file):

        with open(output_file, "r", encoding="utf-8") as f:
            all_descriptors = json.load(f)

    else:
        all_descriptors = {}

    # añadir audio actual
    all_descriptors[filename] = result

    # guardar JSON actualizado
    save_json(all_descriptors, output_file)
    print("Extracción de descriptores de timbre completada y guardada en 'descriptors/timbre_descriptors.json'.")

    return result