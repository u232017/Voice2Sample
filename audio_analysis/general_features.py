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
        # MusicExtractor se crea aquí (como antes)
        extractor = es.MusicExtractor(
            lowlevelStats=['mean'],
            rhythmStats=['mean'],
            tonalStats=['mean'],
            mfccStats=['mean']
        )

        features, _ = extractor(audio_file)

        # Convertir a serializable
        features_dict = {
            key: to_serializable(features[key])
            for key in features.descriptorNames()
        }

        print(f"✓ Total de descriptores: {len(features_dict)}")

        # Estructura final
        final_json = {
            filename: features_dict
        }

        # Guardar JSON individual
        output_file = f"descriptors/music/{filename}.json"
        save_json(final_json, output_file)

        elapsed_time = time.time() - start_time

        # Guardar log
        save_log(
            f"OK - {filename} | time={elapsed_time:.2f}s | descriptors={len(features_dict)}"
        )

        print(f"✓ Guardado individual: {output_file}")

        return final_json

    except Exception as e:

        elapsed_time = time.time() - start_time
        error_msg = f"ERROR - {filename}: {e} | time={elapsed_time:.2f}s"

        print(error_msg)
        save_log(error_msg)
        save_log(traceback.format_exc())

        return None
