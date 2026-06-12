import os
import time
import numpy as np


def extract_rhythmic_descriptors(audio_file: str) -> dict | None:
    """
    Extrae descriptores rítmicos en tiempo real usando librosa.
    Devuelve un dict con las mismas claves que el dataset entrenado:
    bpm, beats, beat_confidence, onset_rate, danceability
    """
    t0 = time.time()
    filename = os.path.splitext(os.path.basename(audio_file))[0]

    try:
        import librosa

        y, sr = librosa.load(audio_file, sr=22050, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)

        if y is None or len(y) == 0 or np.max(np.abs(y)) < 1e-6:
            raise ValueError(f"Audio silencioso o inválido: {audio_file}")

        # BPM rápido: onset_strength + tempo (mucho más rápido que beat_track)
        hop_length = 512
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
        tempo = librosa.feature.tempo(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
        bpm = float(tempo[0]) if hasattr(tempo, '__len__') else float(tempo)

        # Beats aproximados desde el tempo
        beat_interval_frames = int(round((60.0 / bpm) * sr / hop_length))
        total_frames = len(onset_env)
        beat_frames = np.arange(0, total_frames, beat_interval_frames)
        beats = len(beat_frames)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)

        # Beat confidence
        if len(beat_times) > 1:
            intervals = np.diff(beat_times)
            beat_confidence = float(1.0 - (np.std(intervals) / (np.mean(intervals) + 1e-9)))
            beat_confidence = float(np.clip(beat_confidence, 0.0, 1.0))
        else:
            beat_confidence = 0.5

        # Onset rate
        onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
        onset_rate = float(len(onset_frames) / max(duration, 0.001))

        # Danceability proxy
        danceability = float(np.clip(beat_confidence * 0.7 + min(onset_rate / 10.0, 1.0) * 0.3, 0.0, 1.0))

        result = {
            "bpm": round(bpm, 4),
            "beats": beats,
            "beat_confidence": round(beat_confidence, 4),
            "onset_rate": round(onset_rate, 4),
            "danceability": round(danceability, 4),
        }

        print(f"Extrayendo features [ritmo] de: {os.path.basename(audio_file)} | time={time.time()-t0:.2f}s")
        return result

    except Exception as e:
        print(f"ERROR - {filename}: {e} | time={time.time()-t0:.2f}s")
        return None