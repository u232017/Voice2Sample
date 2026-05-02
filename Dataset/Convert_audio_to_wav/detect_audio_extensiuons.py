import os
from pathlib import Path
from collections import defaultdict

AUDIO_PATH = './Dataset/audio'

def detect_audio_extensions(audio_folder):
    """
    Detecta todas las extensiones de audio en una carpeta
    y cuenta cuántos archivos hay de cada tipo.
    """
    extensions = defaultdict(list)
    
    # Asegurar que la ruta existe
    audio_path = Path(audio_folder)
    if not audio_path.exists():
        print(f"Error: La carpeta {audio_folder} no existe.")
        return extensions
    
    # Recorrer todos los archivos en la carpeta
    for file in audio_path.iterdir():
        if file.is_file():
            # Obtener la extensión
            extension = file.suffix.lower()  # ej: .aif, .aiff, .wav
            audio_id = file.stem  # ej: 101121 (sin extensión)
            extensions[extension].append(audio_id)
    
    return extensions

def print_summary(extensions):
    """
    Imprime un resumen de las extensiones encontradas.
    """
    print("\n" + "="*60)
    print("RESUMEN DE EXTENSIONES DE AUDIO")
    print("="*60 + "\n")
    
    if not extensions:
        print("No se encontraron archivos de audio.")
        return
    
    total_files = 0
    for ext in sorted(extensions.keys()):
        count = len(extensions[ext])
        total_files += count
        print(f"Extensión: {ext:8} | Cantidad: {count:4} archivos")
    
    print("\n" + "-"*60)
    print(f"Total de archivos: {total_files}")
    print("="*60 + "\n")
    
    return extensions

def main():
    print(f"Escaneando carpeta: {AUDIO_PATH}")
    extensions = detect_audio_extensions(AUDIO_PATH)
    print_summary(extensions)
    
    # Mostrar primeros ejemplos de cada extensión
    print("\nEjemplos de archivos por extensión:")
    for ext in sorted(extensions.keys()):
        examples = extensions[ext][:5]  # Primeros 5 ejemplos
        print(f"\n{ext}:")
        for audio_id in examples:
            print(f"  - {audio_id}{ext}")
        if len(extensions[ext]) > 5:
            print(f"  ... y {len(extensions[ext]) - 5} archivos más")

if __name__ == "__main__":
    main()
