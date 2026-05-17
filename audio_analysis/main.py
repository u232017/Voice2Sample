import os
import json
import shutil

from general_features import extract_music_descriptors
from melodic_features import extract_melodic_features
from rhythmic_features import extract_rhythmic_descriptors
from timbre_features import extract_timbre_descriptors


# ============================================================
#   PROCESAR UN SOLO ARCHIVO (4 DESCRIPTORES)
# ============================================================
def process_audio(audio_file, current, total):
    percent = (current / total) * 100
    filename = os.path.basename(audio_file)
    print(f"\n▶ [{current}/{total}] ({percent:.1f}%) Procesando {filename}")

    extract_music_descriptors(audio_file)
    extract_melodic_features(audio_file)
    extract_rhythmic_descriptors(audio_file)
    extract_timbre_descriptors(audio_file)

    print(f"✔ Completado: {filename}")


# ============================================================
#   FUSIONAR SOLO LOS JSON DE descriptors/music/
# ============================================================
def merge_music_jsons():
    folder = "descriptors/music"
    merged = {}

    if not os.path.exists(folder):
        print("⚠ No existe la carpeta descriptors/music")
        return

    files = [f for f in os.listdir(folder) if f.endswith(".json")]
    total_files = len(files)

    print(f"\n📦 Fusionando {total_files} archivos JSON...")

    for idx, file in enumerate(files, 1):
        file_id = file.replace(".json", "")
        path = os.path.join(folder, file)
        percent = (idx / total_files) * 100

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if file_id in data:
            merged[file_id] = data[file_id]
        else:
            merged[file_id] = data

        if idx % max(1, total_files // 10) == 0 or idx == total_files:
            print(f"   [{idx}/{total_files}] ({percent:.1f}%)")

    output_file = "descriptors/music_all.json"
    os.makedirs("descriptors", exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(f"\n✔ Archivo general creado: {output_file}")

    # BORRAR CARPETA MUSIC
    shutil.rmtree(folder)
    print(f"🗑 Carpeta eliminada: {folder}")


# ============================================================
#   MAIN (SECUENCIAL + MERGE FINAL + BORRADO)
# ============================================================
def main():
    audio_dir = "../Dataset/audio_processed"

    audio_files = [
        os.path.join(audio_dir, f)
        for f in os.listdir(audio_dir)
        if f.endswith(('.wav', '.mp3', '.aif', '.aiff'))
    ]

    total_files = len(audio_files)
    print(f"\n🎧 Archivos encontrados: {total_files}")
    print(f"📍 Carpeta: {audio_dir}\n")

    # PROCESAMIENTO SECUENCIAL (MÁS RÁPIDO PARA ESSENTIA)
    for current, audio_file in enumerate(audio_files, 1):
        process_audio(audio_file, current, total_files)

    print(f"\n✅ Procesamiento completado: {total_files} archivos")
    
    # FUSIÓN FINAL SOLO DE MUSIC + BORRADO
    merge_music_jsons()


if __name__ == "__main__":
    main()
