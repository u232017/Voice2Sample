import os
import time
import numpy as np


def extract_melodic_features(audio_file: str) -> dict | None:
    """
    Extrae descriptores melódicos en tiempo real usando librosa.
    Devuelve un dict con las mismas claves que el dataset entrenado:
    pitch_mean, pitch_median, pitch_max, pitch_min, pitch_confidence,
    hpcp_crest_mean, hpcp_crest_median, hpcp_crest_max, hpcp_crest_min,
    hpcp_entropy, key_strength_edma, key_strength_krumhansl, key_strength_temperley
    """
    t0 = time.time()
    filename = os.path.splitext(os.path.basename(audio_file))[0]

    try:
        import librosa

        # sr fijo a 48000: el dataset está a 48 kHz; las grabaciones del
        # navegador pueden venir a 44.1 kHz (ver nota en timbre_features.py).
        y, sr = librosa.load(audio_file, sr=48000, mono=True)

        if y is None or len(y) == 0 or np.max(np.abs(y)) < 1e-6:
            raise ValueError(f"Audio silencioso o inválido: {audio_file}")

        # Pitch via pyin
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr
        )
        voiced_f0 = f0[voiced_flag] if voiced_flag is not None else np.array([])

        if len(voiced_f0) > 0:
            pitch_mean = float(np.mean(voiced_f0))
            pitch_median = float(np.median(voiced_f0))
            pitch_max = float(np.max(voiced_f0))
            pitch_min = float(np.min(voiced_f0))
            pitch_confidence = float(np.mean(voiced_probs)) if voiced_probs is not None else 0.0
        else:
            pitch_mean = pitch_median = pitch_max = pitch_min = 0.0
            pitch_confidence = 0.0

        # HPCP (Harmonic Pitch Class Profile) via chroma
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)  # shape (12, T)
        hpcp_crest = np.max(chroma, axis=0) / (np.sum(chroma, axis=0) + 1e-9)  # crest per frame

        hpcp_crest_mean = float(np.mean(hpcp_crest))
        hpcp_crest_median = float(np.median(hpcp_crest))
        hpcp_crest_max = float(np.max(hpcp_crest))
        hpcp_crest_min = float(np.min(hpcp_crest))

        # HPCP entropy: how spread the energy is across pitch classes
        chroma_mean = np.mean(chroma, axis=1)  # (12,)
        chroma_norm = chroma_mean / (np.sum(chroma_mean) + 1e-9)
        hpcp_entropy = float(-np.sum(chroma_norm * np.log2(chroma_norm + 1e-9)))

        # Key strength — use three different profiles as proxies
        # All three use the chroma correlation with major/minor templates
        major_template = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                                   2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_template = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                                   2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

        def _key_corr(chroma_avg, template):
            best = 0.0
            for shift in range(12):
                rolled = np.roll(template, shift)
                c = float(np.corrcoef(chroma_avg, rolled)[0, 1])
                if c > best:
                    best = c
            return max(0.0, best)

        key_strength_edma = _key_corr(chroma_mean, major_template)
        key_strength_krumhansl = _key_corr(chroma_mean, minor_template)
        # temperley: average of best major and minor
        key_strength_temperley = (key_strength_edma + key_strength_krumhansl) / 2.0

        result = {
            "pitch_mean": round(pitch_mean, 4),
            "pitch_median": round(pitch_median, 4),
            "pitch_max": round(pitch_max, 4),
            "pitch_min": round(pitch_min, 4),
            "pitch_confidence": round(pitch_confidence, 4),
            "hpcp_crest_mean": round(hpcp_crest_mean, 4),
            "hpcp_crest_median": round(hpcp_crest_median, 4),
            "hpcp_crest_max": round(hpcp_crest_max, 4),
            "hpcp_crest_min": round(hpcp_crest_min, 4),
            "hpcp_entropy": round(hpcp_entropy, 4),
            "key_strength_edma": round(key_strength_edma, 4),
            "key_strength_krumhansl": round(key_strength_krumhansl, 4),
            "key_strength_temperley": round(key_strength_temperley, 4),
        }

        print(f"Extrayendo features [melodia] de: {os.path.basename(audio_file)} | time={time.time()-t0:.2f}s")
        return result

    except Exception as e:
        print(f"ERROR - {filename}: {e} | time={time.time()-t0:.2f}s")
        return None