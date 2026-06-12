import os
import time
import numpy as np


def extract_timbre_descriptors(audio_file: str) -> dict | None:
    """
    Extrae descriptores de timbre en tiempo real usando librosa.
    Devuelve un dict con las mismas claves que el dataset entrenado:
    lowlevel.mfcc.mean (x13), lowlevel.gfcc.mean (x13), lowlevel.gfcc.cov (x13),
    lowlevel.spectral_centroid.mean, lowlevel.spectral_spread.mean,
    lowlevel.spectral_rolloff.mean, lowlevel.spectral_flux.mean,
    lowlevel.zerocrossingrate.mean
    """
    t0 = time.time()
    filename = os.path.splitext(os.path.basename(audio_file))[0]

    try:
        import librosa

        # sr fijo a 48000: el dataset está íntegramente a 48 kHz, pero las
        # grabaciones del navegador pueden llegar a 44.1 kHz. Sin remuestrear,
        # las features espectrales del query no serían comparables con la BD.
        y, sr = librosa.load(audio_file, sr=48000, mono=True)

        if y is None or len(y) == 0 or np.max(np.abs(y)) < 1e-6:
            raise ValueError(f"Audio silencioso o inválido: {audio_file}")

        # MFCC (13 coefficients)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfcc, axis=1)

        # GFCC proxy via Gammatone-like filterbank (use mel as proxy)
        mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=13)
        mel_db = librosa.power_to_db(mel, ref=np.max)
        gfcc_mean = np.mean(mel_db, axis=1)
        gfcc_cov = np.var(mel_db, axis=1)  # diagonal of covariance

        # Spectral features
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_centroid_mean = float(np.mean(spectral_centroids))

        spectral_bw = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        spectral_spread_mean = float(np.mean(spectral_bw))

        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        spectral_rolloff_mean = float(np.mean(spectral_rolloff))

        # Spectral flux
        stft = np.abs(librosa.stft(y))
        flux = np.sqrt(np.mean(np.diff(stft, axis=1) ** 2, axis=0))
        spectral_flux_mean = float(np.mean(flux))

        # ZCR
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zcr_mean = float(np.mean(zcr))

        result = {}

        # MFCC keys: lowlevel.mfcc.mean.0 ... lowlevel.mfcc.mean.12
        for i, v in enumerate(mfcc_mean):
            result[f"lowlevel.mfcc.mean.{i}"] = round(float(v), 4)

        # GFCC mean keys
        for i, v in enumerate(gfcc_mean):
            result[f"lowlevel.gfcc.mean.{i}"] = round(float(v), 4)

        # GFCC cov keys
        for i, v in enumerate(gfcc_cov):
            result[f"lowlevel.gfcc.cov.{i}"] = round(float(v), 4)

        result["lowlevel.spectral_centroid.mean"] = round(spectral_centroid_mean, 4)
        result["lowlevel.spectral_spread.mean"] = round(spectral_spread_mean, 4)
        result["lowlevel.spectral_rolloff.mean"] = round(spectral_rolloff_mean, 4)
        result["lowlevel.spectral_flux.mean"] = round(spectral_flux_mean, 4)
        result["lowlevel.zerocrossingrate.mean"] = round(zcr_mean, 4)

        print(f"Extrayendo features [timbre] de: {os.path.basename(audio_file)} | time={time.time()-t0:.2f}s")
        return result

    except Exception as e:
        print(f"ERROR - {filename}: {e} | time={time.time()-t0:.2f}s")
        return None