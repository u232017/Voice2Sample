import os
import json
import time
import traceback


def save_json(data, filename):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_log(message, log_file="reports/timbre_report.txt"):
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(message + "\n")


def extract_timbre_descriptors(audio_file):

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
        # SOLO mean + var (ACTUALIZADO)
        # ============================
        useful_keys = [

            # MFCC
            "lowlevel.mfcc.mean",
            "lowlevel.mfcc.var",

            # GFCC
            "lowlevel.gfcc.mean",
            "lowlevel.gfcc.var",

            # Spectral centroid
            "lowlevel.spectral_centroid.mean",
            "lowlevel.spectral_centroid.var",

            # Spectral spread
            "lowlevel.spectral_spread.mean",
            "lowlevel.spectral_spread.var",

            # Spectral rolloff
            "lowlevel.spectral_rolloff.mean",
            "lowlevel.spectral_rolloff.var",

            # Spectral flux
            "lowlevel.spectral_flux.mean",
            "lowlevel.spectral_flux.var",

            # Zero crossing rate
            "lowlevel.zerocrossingrate.mean",
            "lowlevel.zerocrossingrate.var"
        ]

        timbre = {k: song[k] for k in useful_keys if k in song}

        output_file = "descriptors/timbre_descriptors.json"

        if os.path.exists(output_file):
            with open(output_file, "r", encoding="utf-8") as f:
                all_data = json.load(f)
        else:
            all_data = {}

        all_data[filename] = timbre
        save_json(all_data, output_file)

        elapsed = time.time() - start_time
        save_log(f"OK - {filename} tímbrico guardado | time={elapsed:.2f}s")

        print(f"✓ Tímbrico extraído correctamente: {filename}")
        return timbre

    except Exception as e:
        elapsed = time.time() - start_time
        error = f"ERROR - {filename}: {str(e)} | time={elapsed:.2f}s"
        save_log(error)
        save_log(traceback.format_exc())
        print(error)
        return None
