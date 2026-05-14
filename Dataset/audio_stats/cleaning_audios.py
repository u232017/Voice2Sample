import os
import pandas as pd
import librosa

def clean_out_of_bounds_audios(csv_path, audio_folder, min_duration=None, max_duration=None):
    """
    Elimina audios fuera del rango de duración especificado y actualiza el CSV.

    Args:
        csv_path (str): Ruta al archivo CSV con metadata
        audio_folder (str): Carpeta donde están los audios WAV
        min_duration (float, optional): Duración mínima en segundos. Si se especifica, elimina audios más cortos.
        max_duration (float, optional): Duración máxima en segundos. Si se especifica, elimina audios más largos.
    """
    # Cargar CSV
    df = pd.read_csv(csv_path)
    print(f"CSV cargado: {len(df)} filas")

    # Lista de IDs a eliminar
    ids_to_remove = []

    # Iterar sobre archivos en audio_folder
    for file_name in os.listdir(audio_folder):
        # Extraer ID del nombre del archivo
        try:
            audio_id = int(file_name.replace('.wav', ''))
        except ValueError:
            print(f"Nombre de archivo inválido: {file_name}")
            continue

        # Ruta completa del audio
        audio_path = os.path.join(audio_folder, file_name)

        # Calcular duración
        try:
            duration_seconds = librosa.get_duration(filename=audio_path)

            should_remove = False
            reason = ""
            if min_duration is not None and duration_seconds < min_duration:
                should_remove = True
                reason = f"demasiado corto ({duration_seconds:.2f}s < {min_duration}s)"
            elif max_duration is not None and duration_seconds > max_duration:
                should_remove = True
                reason = f"demasiado largo ({duration_seconds:.2f}s > {max_duration}s)"

            if should_remove:
                print(f"Eliminando {file_name} ({reason})")
                os.remove(audio_path)
                ids_to_remove.append(audio_id)
            '''else:
                print(f"Manteniendo {file_name} (duración: {duration_seconds:.2f}s)")
            '''
        except Exception as e:
            print(f"Error procesando {file_name}: {e}")

    # Filtrar CSV removiendo filas con IDs en ids_to_remove
    df_filtered = df[~df['id'].isin(ids_to_remove)]
    df_filtered.to_csv(csv_path, index=False)

    print(f"\nEliminados: {len(ids_to_remove)} audios")
    print(f"CSV actualizado: {len(df_filtered)} filas restantes")
