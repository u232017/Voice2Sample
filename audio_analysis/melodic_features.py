import os, json, time


def save_json(data, filename):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_log(message, log_file="reports/melodic_report.txt"):
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(message + "\n")


def extract_melodic_features(audio_file):

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
        # MELODÍA (solo mean + var reales)
        # ============================
        melodic = {

            # pitch salience (SOLO EXISTEN ESTOS 2)
            "pitch_mean": song.get("lowlevel.pitch_salience.mean"),
            "pitch_var": song.get("lowlevel.pitch_salience.var"),

            # HPCP (armonía)
            "hpcp_crest_mean": song.get("tonal.hpcp_crest.mean"),
            "hpcp_crest_var": song.get("tonal.hpcp_crest.var"),

            "hpcp_entropy_mean": song.get("tonal.hpcp_entropy.mean"),
            "hpcp_entropy_var": song.get("tonal.hpcp_entropy.var"),

            # tonalidad
            "key_strength_edma": song.get("tonal.key_edma.strength"),
            "key_strength_krumhansl": song.get("tonal.key_krumhansl.strength"),
            "key_strength_temperley": song.get("tonal.key_temperley.strength")
        }

        output_file = "descriptors/melodic_descriptors.json"

        if os.path.exists(output_file):
            with open(output_file, "r", encoding="utf-8") as f:
                all_data = json.load(f)
        else:
            all_data = {}

        all_data[filename] = melodic
        save_json(all_data, output_file)

        save_log(f"OK - {filename} melódico | time={time.time()-start_time:.2f}s")

        print(f"✓ Melódico extraído correctamente: {filename}")
        return melodic

    except Exception as e:
        save_log(f"ERROR - {filename}: {e}")
        print(f"ERROR - {filename}: {e}")
        return None
