import os
from Convert_audio_to_wav import wav_convertor as wav_convertor
from Json_to_csv import json_to_csv as json_to_csv
from Clean_csv.csv_filter import filter_csv_by_columns as filter_csv_by_columns
from download_dataset.zenodo_downloader import download_dataset_via_tool as download_dataset
from audio_stats.extract_stats import analyze_audio_durations as analyze_audio_durations
from Clean_csv.csv_filter import check_audio_files as check_audio_files
from download_dataset.zenodo_downloader import unzip_dataset as unzip_dataset
from audio_stats.cleaning_audios import clean_out_of_bounds_audios as clean_out_of_bounds_audios

DATASET_FOLDER = "./Dataset_temp" #Donde se guardara el datset descargado de zenodo.
AUDIO_OUTPUT_FOLDER = "./audio_processed" #Donde queremos guardar los auidos procesados, no hace falta que exista.
COLUMNS = ['id', 'name', 'description', 'username', 'license', 'bpm']  # Columnas a mantener (puedes modificar esta lista)
OUTPUT_CSV_PATH = "./metadata_filtered.csv"  # donde quereos guardar el CSV filtrado.
TARGET_SAMPLE_RATE = 48000
MIN_DURATION_SECONDS = 1.5  # Duración mínima en segundos para mantener un audio
MAX_DURATION_SECONDS = 8.0  # Duración máxima en segundos para mantener un audio

def main():

    print("\n" + "="*60)
    print("INICIANDO PROCESO DE DATASET")
    print("="*60)

    # Paso 0: Descargar dataset de Zenodo
    print("\nPaso 0: Descargar dataset de Zenodo")
    download_dataset('3685832', DATASET_FOLDER)
    unzip_dataset(os.path.join(DATASET_FOLDER, "audio.zip"), "./audio_temp")
    
    # Paso 1: Convertir audios a WAV
    print("\nPaso 1: Convertir audios a WAV")
    wav_convertor.process_all_audios(os.path.join("./audio_temp", "audio", "original"), AUDIO_OUTPUT_FOLDER, TARGET_SAMPLE_RATE)

    # Paso 2: Convertir JSON a CSV
    print("\nPaso 2: Convertir JSON a CSV")
    json_to_csv.convert_metadata_to_csv(os.path.join(DATASET_FOLDER, "metadata"), './Clean_csv/metadata.csv')

    # Paso 3: Limpiar CSV
    print("\nPaso 3: Limpiar CSV")
    filter_csv_by_columns('./Clean_csv/metadata.csv', COLUMNS, OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER)

    # Paso 4: Verificar archivos de audio
    print("\nPaso 4: Verificar archivos de audio")
    check_audio_files(OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER)

    # Paso 5: Limpiar audios cortos
    print("\nPaso 5: Limpiar audios cortos")
    clean_out_of_bounds_audios(OUTPUT_CSV_PATH, AUDIO_OUTPUT_FOLDER, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS)

    print("\n" + "="*60)
    print("PROCESO COMPLETADO")
    print("Estadisticas finales de los audios procesados:")
    
    #Paso 6: Analizar duraciones de audio

    stats, df, outliers = analyze_audio_durations(AUDIO_OUTPUT_FOLDER)
    print("Durations summary:")
    for key, value in stats.items():
        print(f"  {key}: {value:.2f} s")
    print(f"Found {len(outliers)} outliers.")
    print(f"Audios procesados guardados en: {AUDIO_OUTPUT_FOLDER}")
    print(f"CSV filtrado guardado en: {OUTPUT_CSV_PATH}")
    print(f"Puedes borrar la carpetas temporales './audio_temp' y './Dataset_temp' si ya no la necesitas.")
    print("="*60)


if __name__ == "__main__":
    main()