import os
import json
import time
import traceback


def save_json(data, filename):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_log(message, log_file="reports/rhythmic_report.txt"):
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(message + "\n")

def extract_rhythmic_descriptors(audio_file):

    start_time = time.time()
    filename = os.path.splitext(os.path.basename(audio_file))[0]

    try:
        temporal_file = f"descriptors/music/{filename}.json"

        if not os.path.exists(temporal_file):
            raise FileNotFoundError(f"No existe: {temporal_file}")

        with open(temporal_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        if filename not in data:
            raise KeyError(f"La ID '{filename}' no está en temporal.json")

        song = data[filename]

        # ============================
        # 1. Descriptores rítmicos reales
        # ============================
        bpm = song.get("rhythm.bpm", 0.0)
        beats_count = song.get("rhythm.beats_count", 0)

        beat_conf = song.get("rhythm.beats_loudness.mean", None)

        # NUEVOS DESCRIPTORES ÚTILES
        onset_rate = song.get("rhythm.onset_rate", None)
        danceability = song.get("rhythm.danceability", None)

        # ============================
        # 2. Formato final
        # ============================
        result = {
            "bpm": bpm,
            "beats": beats_count,
            "beat_confidence": beat_conf,
            "onset_rate": onset_rate,
            "danceability": danceability
        }

        # ============================
        # 3. Guardar JSON global
        # ============================
        output_file = "descriptors/rhythmic_descriptors.json"

        if os.path.exists(output_file):
            with open(output_file, "r", encoding="utf-8") as f:
                all_data = json.load(f)
        else:
            all_data = {}

        all_data[filename] = result
        save_json(all_data, output_file)

        elapsed = time.time() - start_time
        save_log(f"OK - {filename} rítmico guardado | time={elapsed:.2f}s")

        print(f"✓ Rítmico extraído desde temporal.json: {filename}")
        return result

    except Exception as e:
        elapsed = time.time() - start_time
        error = f"ERROR - {filename}: {str(e)} | time={elapsed:.2f}s"
        save_log(error)
        save_log(traceback.format_exc())
        print(error)
        return None
