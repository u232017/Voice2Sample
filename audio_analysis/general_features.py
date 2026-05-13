import essentia.standard as es
import os
import json
import time
import traceback


def save_json(data, filename):

    os.makedirs(os.path.dirname(filename), exist_ok=True)

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_log(message, log_file="reports/music_report.txt"):

    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {message}\n")


def to_serializable(val):

    if hasattr(val, "tolist"):
        return val.tolist()

    if isinstance(val, (list, tuple)):
        return list(val)

    if isinstance(val, (int, float)):
        return float(val)

    return str(val)


def extract_music_descriptors(audio_file):

    start_time = time.time()

    if not os.path.exists(audio_file):
        raise FileNotFoundError(f"Audio file not found: {audio_file}")

    filename = os.path.splitext(os.path.basename(audio_file))[0]

    print(f"\n🎵 Procesando: {filename}")

    try:

        extractor = es.MusicExtractor()

        features, _ = extractor(audio_file)

        features_dict = {
            key: to_serializable(features[key])
            for key in features.descriptorNames()
        }

        print(f"✓ Total de descriptores: {len(features_dict)}")

        # =========================
        # JSON GLOBAL
        # =========================
        global_json = "descriptors/music_descriptors.json"

        if os.path.exists(global_json):

            with open(global_json, "r", encoding="utf-8") as f:
                all_descriptors = json.load(f)

        else:
            all_descriptors = {}

        all_descriptors[filename] = features_dict

        save_json(all_descriptors, global_json)

        # =========================
        # JSON TEMPORAL
        # =========================        
        temporal_json = f"descriptors/temporal.json"

        if os.path.exists(temporal_json):

            with open(temporal_json, "r", encoding="utf-8") as f:
                all_descriptors = json.load(f)

        else:
            all_descriptors = {}

        all_descriptors[filename] = features_dict

        save_json(all_descriptors, temporal_json)
        

        elapsed_time = time.time() - start_time

        save_log(
            f"OK - {filename} | "
            f"time={elapsed_time:.2f}s | "
            f"descriptors={len(features_dict)}"
        )

        print(f"✓ JSON global guardado")
        print(f"✓ JSON temporal guardado")

        return features_dict

    except Exception as e:

        elapsed_time = time.time() - start_time

        error_msg = (
            f"ERROR - {filename}: "
            f"{str(e)} | "
            f"time={elapsed_time:.2f}s"
        )

        print(error_msg)

        save_log(error_msg)
        save_log(traceback.format_exc())

        return None