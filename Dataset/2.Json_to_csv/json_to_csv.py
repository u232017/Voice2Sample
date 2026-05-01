import pandas as pd
import json
import re

JSON_FILE = "E:/GitHub/technology-music-lab-s101/Dataset/2.Json_to_csv/metadata"  # Cambiar la ruta
CSV_FILE = "E:/GitHub/technology-music-lab-s101/Dataset/3.Clean_csv/metadata.csv"  # Cambiar la ruta

def clean_text(text):
    """
    Limpia el texto removiendo caracteres de control como \n, \t, \r.
    
    Args:
        text: Texto a limpiar
        
    Returns:
        str: Texto limpio
    """
    if isinstance(text, str):
        # Reemplazar \n, \t, \r con espacios
        text = re.sub(r'[\n\t\r]', ' ', text)
        # Remover espacios múltiples
        text = re.sub(r'\s+', ' ', text).strip()
    return text

def convert_metadata_to_csv(json_path, csv_path):
    """
    Convierte el archivo metadata JSON a formato CSV usando pandas.

    Args:
        json_path (str): Ruta al archivo JSON de metadata
        csv_path (str): Ruta donde guardar el archivo CSV resultante
    """
    # Cargar el JSON
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Convertir a DataFrame, normalizando la estructura anidada
    df = pd.json_normalize(data.values())

    # Limpiar columnas de texto para remover \n, \t, \r
    text_columns = ['description', 'name', 'username']  # Columnas que pueden contener texto con saltos de línea
    for col in text_columns:
        if col in df.columns:
            df[col] = df[col].apply(clean_text)

    if 'annotations.bpm' in df.columns:
        df = df.rename(columns={'annotations.bpm': 'bpm'})

    # Guardar como CSV
    df.to_csv(csv_path, index=False, encoding='utf-8')
    print(f"Archivo CSV guardado en: {csv_path}")
    print(f"Número de filas: {len(df)}")
    print(f"Columnas: {list(df.columns)}")

# Ejemplo de uso
if __name__ == "__main__":

    convert_metadata_to_csv(JSON_FILE, CSV_FILE)