import pandas as pd
from pathlib import Path

INPUT_CSV_PATH = "../3.Clean_csv/metadata.csv" # CSV en el mismo directorio
OUTPUT_CSV_PATH = "../3.Clean_csv"  # CSV de salida en el mismo directorio
AUDIO_FOLDER = "E:/GitHub/technology-music-lab-s101/Dataset/audio_processed"  # Carpeta de audios

def filter_csv_by_columns(csv_path, columns_to_keep, output_path, audio_folder):
    """
    Filtra el CSV para quedarse solo con las columnas especificadas.

    Args:
        csv_path (str): Ruta al CSV de entrada
        columns_to_keep (list): Lista de nombres de columnas a mantener
        output_path (str): Ruta al CSV de salida filtrado
    """
    # Leer el CSV
    df = pd.read_csv(csv_path, encoding='utf-8')

    # Filtrar columnas
    df_filtered = df[columns_to_keep]

    # Agregar la columna 'audio_path' con la ruta al archivo de audio correspondiente
    df_filtered['audio_path'] = (
        audio_folder + "/" + df_filtered['id'].astype(str) + ".wav"
    )

    # Guardar el CSV filtrado
    df_filtered.to_csv(output_path, index=False, encoding='utf-8')
    print(f"CSV filtrado guardado en: {output_path}")
    print(f"Número de filas: {len(df_filtered)}")
    print(f"Número de columnas: {len(df_filtered.columns)}")
    print("\nColumnas finales:")
    print(df_filtered.columns.tolist())


def check_audio_files(csv_path, audio_folder):
    """
    Comprueba que cada ID del CSV tenga su archivo .wav.

    Args:
        csv_path (str): Ruta del CSV
        audio_folder (str): Carpeta donde están los audios
    """

    # Leer CSV
    df = pd.read_csv(csv_path)

    # Carpeta de audios
    audio_folder = Path(audio_folder)

    # Guardar IDs sin audio
    missing_files = []

    # Recorrer todos los IDs
    for audio_id in df['id']:

        # Crear ruta esperada
        audio_path = audio_folder / f"{audio_id}.wav"

        # Comprobar si existe
        if not audio_path.exists():
            missing_files.append(audio_id)

    # Resultado final
    if len(missing_files) == 0:
        print("✅ Todos los audios existen")
    else:
        print(f"❌ Faltan {len(missing_files)} audios:\n")

        for missing_id in missing_files:
            print(f"- {missing_id}.wav")
        
    print("Total de IDs en CSV:", len(df), " | Total de audios faltantes:", len(missing_files), " | Total de audios encontrados:", len(df) - len(missing_files))


# Ejemplo de uso
if __name__ == "__main__":
    columns = ['id', 'name', 'description', 'username', 'license', 'preview_url', 'bpm']  # Columnas a mantener (puedes modificar esta lista)
    # Filtrar para quedarse solo con algunos tags (puedes modificar la lista)
    output_path = OUTPUT_CSV_PATH + "/metadata_filtered.csv"
    filter_csv_by_columns(INPUT_CSV_PATH, columns, output_path, AUDIO_FOLDER)
    # Comprobar que cada ID tenga su audio correspondiente
    check_audio_files(output_path, AUDIO_FOLDER)