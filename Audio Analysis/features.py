import essentia
import essentia.standard as es
import numpy as np

#windows: wsl
#python3 -m venv .venv
#source .venv/bin/activate
#pip install --upgrade pip
#pip install essentia

# Essentia a veces devuelve arrays tipo [123.4] en vez de 123.4
# Esta función los convierte siempre a float normal de Python
def safe_scalar(x):
    return float(np.asarray(x).reshape(-1)[0])


def extract_features(audio_file):
    # CARGA DEL AUDIO
    # Convierte el archivo mp3 en una señal numérica (array de amplitudes)
    audio = es.MonoLoader(filename=audio_file)()

    # CONFIGURACIÓN DE FRAMES
    # Dividimos el audio en pequeñas ventanas para analizarlo por partes
    frame_size = 1024  # tamaño de cada fragmento
    hop_size = 512     # salto entre fragmentos

    # Herramientas de análisis espectral
    window = es.Windowing(type='hann')  # ventana para suavizar edges
    spectrum = es.Spectrum()            # convierte audio → frecuencia

    
    # DESCRIPTORES ESPECTRALES
    centroid_alg = es.Centroid(range=22050)  # “centro de masa” del sonido
    rolloff_alg = es.RollOff()               # energía acumulada del espectro
    flux_alg = es.Flux()                     # cambio entre frames (dinámica)

    # MFCC = “huella del timbre del sonido”
    mfcc_alg = es.MFCC(inputSize=513)

    # listas donde guardamos valores por frame
    centroid_list = []
    rolloff_list = []
    flux_list = []
    mfcc_list = []

    
    # BUCLE POR FRAMES 
    for frame in es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size):

        # aplicar ventana (reduce artefactos)
        w = window(frame)

        # convertir a espectro (frecuencias)
        spec = spectrum(w)

        # extraer características espectrales
        centroid_list.append(centroid_alg(spec))  # brillo del sonido
        rolloff_list.append(rolloff_alg(spec))    # energía acumulada
        flux_list.append(flux_alg(spec))          # cambio entre frames

        # MFCC: descripción del timbre
        _, mfcc_coeffs = mfcc_alg(spec)

        # guardamos como vector plano
        mfcc_list.append(np.asarray(mfcc_coeffs).reshape(-1))

    
    # RÍTMICA GLOBAL (TODA LA CANCIÓN) 
    rhythm = es.RhythmExtractor2013(method="multifeature")

    # devuelve:
    # bpm → tempo
    # beats → tiempos de golpes
    # confidence → confianza del resultado
    # onset_rate → actividad rítmica
    bpm, beats, confidence, onset_rate, _ = rhythm(audio)

    # convertir a escalares seguros
    bpm = safe_scalar(bpm)
    confidence = safe_scalar(confidence)
    onset_rate = safe_scalar(onset_rate)

    
    # FEATURES BÁSICAS (RESUMEN DEL AUDIO)
    ftr_basic = np.array([
        np.mean(centroid_list),   # brillo medio del audio
        np.mean(rolloff_list),    # distribución de energía
        np.mean(flux_list),       # variación temporal
        onset_rate,               # actividad rítmica
        bpm,                      # tempo (BPM)
        confidence,               # fiabilidad del tempo
        float(len(beats))         # número de beats detectados
    ], dtype=float)

    
    # MFCC (TEXURA DEL SONIDO)
    # convertimos lista de vectores en matriz
    mfcc_array = np.array(mfcc_list)

    # promedio de todos los frames → resumen global del timbre
    mfcc_mean = np.mean(mfcc_array, axis=0)

    
    # VECTOR FINAL DE FEATURES
    # combinamos:
    # - características globales
    # - + MFCC (timbre)
    features = np.concatenate([ftr_basic, mfcc_mean])

    # Vector: [centroid(brillo), rolloff(energía), flux(cambios), 
    # onset_rate(actividad rítmica), bpm(tempo), confidence(fiabilidad), 
    # beat_count + 13 MFCC(timbre del sonido)]
    return features


