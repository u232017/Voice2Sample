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
        # ============================
        # 1. Cargar temporal.json
        # ============================
        temporal_file = f"descriptors/music/{filename}.json"
        if not os.path.exists(temporal_file):
            raise FileNotFoundError(f"No existe: {temporal_file}")

        with open(temporal_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        # ============================
        # 2. Verificar ID
        # ============================
        if filename not in data:
            raise KeyError(f"La ID '{filename}' no está en temporal.json")

        song = data[filename]

        # ============================
        # 3. Descriptores melódicos REALES
        # ============================
        melodic = {
            # Pitch (salience = claridad del pitch)
            "pitch_mean": song.get("lowlevel.pitch_salience.mean"),
            "pitch_median": song.get("lowlevel.pitch_salience.median"),
            "pitch_max": song.get("lowlevel.pitch_salience.max"),
            "pitch_min": song.get("lowlevel.pitch_salience.min"),
            "pitch_confidence": song.get("lowlevel.pitch_salience.stdev"),

            # HPCP (armonía)
            "hpcp_crest_mean": song.get("tonal.hpcp_crest.mean"),
            "hpcp_crest_median": song.get("tonal.hpcp_crest.median"),
            "hpcp_crest_max": song.get("tonal.hpcp_crest.max"),
            "hpcp_crest_min": song.get("tonal.hpcp_crest.min"),
            "hpcp_entropy": song.get("tonal.hpcp_entropy.mean"),

            # Tonalidad
            "key_strength_edma": song.get("tonal.key_edma.strength"),
            "key_strength_krumhansl": song.get("tonal.key_krumhansl.strength"),
            "key_strength_temperley": song.get("tonal.key_temperley.strength")
        }

        # ============================
        # 4. Guardar JSON global
        # ============================
        output_file = "descriptors/melodic_descriptors.json"

        if os.path.exists(output_file):
            with open(output_file, "r", encoding="utf-8") as f:
                all_data = json.load(f)
        else:
            all_data = {}

        all_data[filename] = melodic
        save_json(all_data, output_file)

        elapsed = time.time() - start_time
        save_log(f"OK - {filename} melódico guardado | time={elapsed:.2f}s")

        print(f"✓ Melódico extraído desde temporal.json: {filename}")
        return melodic

    except Exception as e:
        elapsed = time.time() - start_time
        error = f"ERROR - {filename}: {str(e)} | time={elapsed:.2f}s"
        save_log(error)
        print(error)
        return None
