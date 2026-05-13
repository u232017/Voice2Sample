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
        # 3. Descriptores tímbricos reales
        # ============================
        useful_keys = [
            # MFCC
            "lowlevel.mfcc.mean", "lowlevel.mfcc.cov",

            # GFCC
            "lowlevel.gfcc.mean", "lowlevel.gfcc.cov",

            # Spectral centroid
            "lowlevel.spectral_centroid.mean",
            "lowlevel.spectral_centroid.median",
            "lowlevel.spectral_centroid.max",
            "lowlevel.spectral_centroid.min",
            "lowlevel.spectral_centroid.stdev",

            # Spectral spread
            "lowlevel.spectral_spread.mean",
            "lowlevel.spectral_spread.median",
            "lowlevel.spectral_spread.max",
            "lowlevel.spectral_spread.min",
            "lowlevel.spectral_spread.stdev",

            # Spectral rolloff
            "lowlevel.spectral_rolloff.mean",
            "lowlevel.spectral_rolloff.median",
            "lowlevel.spectral_rolloff.max",
            "lowlevel.spectral_rolloff.min",
            "lowlevel.spectral_rolloff.stdev",

            # Spectral flux
            "lowlevel.spectral_flux.mean",
            "lowlevel.spectral_flux.median",
            "lowlevel.spectral_flux.max",
            "lowlevel.spectral_flux.min",
            "lowlevel.spectral_flux.stdev",

            # Zero crossing rate
            "lowlevel.zerocrossingrate.mean",
            "lowlevel.zerocrossingrate.median",
            "lowlevel.zerocrossingrate.max",
            "lowlevel.zerocrossingrate.min",
            "lowlevel.zerocrossingrate.stdev"
        ]

        timbre = {k: song[k] for k in useful_keys if k in song}

        # ============================
        # 4. Guardar JSON global
        # ============================
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

        print(f"✓ Tímbrico extraído correctamente y temporal.json eliminado")
        return timbre

    except Exception as e:
        elapsed = time.time() - start_time
        error = f"ERROR - {filename}: {str(e)} | time={elapsed:.2f}s"
        save_log(error)
        print(error)
        return None
