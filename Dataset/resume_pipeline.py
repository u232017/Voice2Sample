"""Resume dataset processing without re-downloading from Zenodo."""
import os
from pathlib import Path

from Json_to_csv import json_to_csv
from Clean_csv.csv_filter import filter_csv_by_columns, check_audio_files
from audio_stats.cleaning_audios import clean_out_of_bounds_audios
from audio_stats.extract_stats import analyze_audio_durations
from Convert_audio_to_wav import wav_convertor

COLUMNS = ["id", "name", "description", "username", "license", "bpm"]
OUTPUT_CSV_PATH = "./metadata_filtered.csv"
AUDIO_OUTPUT_FOLDER = "./audio_processed"
INPUT_FOLDER = "./audio_temp/audio/original"
TARGET_SAMPLE_RATE = 48000
MIN_DURATION_SECONDS = 1.5
MAX_DURATION_SECONDS = 8.0


def resume_wav_conversion() -> None:
    input_folder = Path(INPUT_FOLDER)
    output_folder = Path(AUDIO_OUTPUT_FOLDER)
    output_folder.mkdir(parents=True, exist_ok=True)

    files = sorted(f for f in input_folder.iterdir() if f.is_file())
    todo = [f for f in files if not (output_folder / f"{f.stem}.wav").exists()]
    print(f"WAV: {len(files)} originales, {len(files) - len(todo)} ya listos, {len(todo)} pendientes")

    processed = errors = 0
    for index, file in enumerate(todo, start=1):
        out = output_folder / f"{file.stem}.wav"
        if index % 50 == 0 or index == 1:
            print(f"  [{index}/{len(todo)}] {file.name}")
        if wav_convertor.process_audio(file, out, TARGET_SAMPLE_RATE):
            processed += 1
        else:
            errors += 1

    print(f"WAV terminado: +{processed} ok, {errors} errores, total {len(list(output_folder.glob('*.wav')))}")


def run_metadata_steps() -> None:
    print("JSON -> CSV")
    json_to_csv.convert_metadata_to_csv("./Dataset_temp/metadata", "./Clean_csv/metadata.csv")

    print("Filtrar CSV")
    filter_csv_by_columns("./Clean_csv/metadata.csv", COLUMNS, OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER)

    print("Verificar archivos")
    check_audio_files(OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER)

    print("Limpiar duraciones fuera de rango")
    clean_out_of_bounds_audios(
        OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS
    )

    stats, _, outliers = analyze_audio_durations(AUDIO_OUTPUT_FOLDER)
    print("Estadisticas:")
    for key, value in stats.items():
        print(f"  {key}: {value:.2f} s")
    print(f"Outliers: {len(outliers)}")
    print(f"CSV: {OUTPUT_CSV_PATH} ({os.path.getsize(OUTPUT_CSV_PATH)} bytes)")


if __name__ == "__main__":
    import sys

    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    if step in ("wav", "all"):
        resume_wav_conversion()
    if step in ("meta", "all"):
        run_metadata_steps()
