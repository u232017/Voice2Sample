from Convert_audio_to_wav import wav_convertor as wav_convertor
from Json_to_csv import json_to_csv as json_to_csv
from Clean_csv.csv_filter import filter_csv_by_columns as filter_csv_by_columns
from Clean_csv.csv_filter import check_audio_files as check_audio_files

AUDIO_INPUT_FOLDER = "./audio"
AUDIO_OUTPUT_FOLDER = "./audio_processed"
INPUT_CSV_PATH = "./Clean_csv/metadata.csv" # CSV en el mismo directorio
OUTPUT_CSV_PATH = "./Clean_csv/metadata_filtered.csv"  # CSV de salida en el mismo directorio
COLUMNS = ['id', 'name', 'description', 'username', 'license', 'bpm']  # Columnas a mantener (puedes modificar esta lista)
JSON_FILE = "./Json_to_csv/metadata"  # Cambiar la ruta
CSV_FILE = "./Clean_csv/metadata.csv"  # Cambiar la ruta

def main():

    print("\n" + "="*60)
    print("INICIANDO PROCESO DE DATASET")
    print("="*60)

    # Paso 1: Convertir audios a WAV
    print("\nPaso 1: Convertir audios a WAV")
    wav_convertor.process_all_audios(AUDIO_INPUT_FOLDER, AUDIO_OUTPUT_FOLDER)

    # Paso 2: Convertir JSON a CSV
    print("\nPaso 2: Convertir JSON a CSV")
    json_to_csv.convert_metadata_to_csv(JSON_FILE, CSV_FILE)

    # Paso 3: Limpiar CSV
    print("\nPaso 3: Limpiar CSV")
    filter_csv_by_columns(INPUT_CSV_PATH, COLUMNS, OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER)

    # Paso 4: Verificar archivos de audio
    print("\nPaso 4: Verificar archivos de audio")
    check_audio_files(OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER)

    print("\n" + "="*60)
    print("PROCESO COMPLETADO")
    print("="*60)


if __name__ == "__main__":
    main()