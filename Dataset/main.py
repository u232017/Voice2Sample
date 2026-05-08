from Convert_audio_to_wav import wav_convertor as wav_convertor
from Json_to_csv import json_to_csv as json_to_csv
from Clean_csv.csv_filter import filter_csv_by_columns as filter_csv_by_columns
from Clean_csv.csv_filter import check_audio_files as check_audio_files

AUDIO_INPUT_FOLDER = "./audio_prueba" # Cambiar la ruta de donde queremos leer los audios originales.
AUDIO_OUTPUT_FOLDER = "./audio_processed_prueba" #Donde queremos guardar los auidos procesados, no hace falta que exista.
JSON_FILE = "./metadata_prueba"  # Donde esta el archivo de metadata.
COLUMNS = ['id', 'name', 'description', 'username', 'license', 'bpm']  # Columnas a mantener (puedes modificar esta lista)
CSV_FILE = "./Clean_csv/metadata.csv"  # Donde queremos guardar el CSV intermedio después de convertir el JSON a CSV.
OUTPUT_CSV_PATH = "./metadata_filtered.csv"  # donde quereos guardar el CSV filtrado.

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
    filter_csv_by_columns(CSV_FILE, COLUMNS, OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER)

    # Paso 4: Verificar archivos de audio
    print("\nPaso 4: Verificar archivos de audio")
    check_audio_files(OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER)

    print("\n" + "="*60)
    print("PROCESO COMPLETADO")
    print("="*60)


if __name__ == "__main__":
    main()