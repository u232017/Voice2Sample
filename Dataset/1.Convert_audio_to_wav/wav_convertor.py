import os
import shutil
from pathlib import Path
from collections import defaultdict
import librosa
import soundfile as sf

AUDIO_INPUT_FOLDER = './Dataset/audio' # Cambia esta ruta
AUDIO_OUTPUT_FOLDER = './Dataset/audio_processed'  # Cambia esta ruta

# Lista de extensiones soportadas para conversión
SUPPORTED_FORMATS = {
    '.flac': 'flac',
    '.mp3': 'mp3',
    '.aif': 'aiff',
    '.aiff': 'aiff',
    '.ogg': 'ogg',
    '.wav': 'wav'
}


# ==================== FUNCIONES DE CONVERSIÓN ====================

def convert_flac_to_wav(input_path, output_path):
    """Convierte FLAC a WAV"""
    try:
        audio_data, sr = librosa.load(str(input_path), sr=None)
        sf.write(str(output_path), audio_data, sr)
        return True
    except Exception as e:
        print(f"Error al convertir FLAC: {str(e)}")
        return False

def convert_mp3_to_wav(input_path, output_path):
    """Convierte MP3 a WAV"""
    try:
        audio_data, sr = librosa.load(str(input_path), sr=None)
        sf.write(str(output_path), audio_data, sr)
        return True
    except Exception as e:
        print(f"Error al convertir MP3: {str(e)}")
        return False

def convert_aiff_to_wav(input_path, output_path):
    """Convierte AIF/AIFF a WAV"""
    try:
        audio_data, sr = librosa.load(str(input_path), sr=None)
        sf.write(str(output_path), audio_data, sr)
        return True
    except Exception as e:
        print(f"Error al convertir AIF/AIFF: {str(e)}")
        return False

def convert_ogg_to_wav(input_path, output_path):
    """Convierte OGG a WAV"""
    try:
        audio_data, sr = librosa.load(str(input_path), sr=None)
        sf.write(str(output_path), audio_data, sr)
        return True
    except Exception as e:
        print(f"Error al convertir OGG: {str(e)}")
        return False

def convert_wav_to_wav(input_path, output_path):
    """Copia WAV a WAV (sin procesamiento, solo copia)"""
    try:
        shutil.copy2(str(input_path), str(output_path))
        return True
    except Exception as e:
        print(f"Error al copiar WAV: {str(e)}")
        return False

# Diccionario de funciones de conversión
CONVERTERS = {
    '.flac': convert_flac_to_wav,
    '.mp3': convert_mp3_to_wav,
    '.aif': convert_aiff_to_wav,
    '.aiff': convert_aiff_to_wav,
    '.ogg': convert_ogg_to_wav,
    '.wav': convert_wav_to_wav
}

# ==================== FUNCIÓN PRINCIPAL DE CONVERSIÓN ====================

def convert_all_to_wav(audio_folder, output_folder=None):
    """
    Recorre la carpeta de audio y convierte todos los archivos a WAV.
    Los archivos que ya son WAV se copian directamente.
    Si un formato no está soportado, muestra un error.
    Por defecto guarda en la carpeta 'audio_processed'
    """
    audio_path = Path(audio_folder)
    
    if not audio_path.exists():
        print(f"Error: La carpeta {audio_folder} no existe.")
        return
    
    # Si no se especifica carpeta de salida, usar 'audio_processed'
    if output_folder is None:
        output_folder = audio_path.parent / "audio_processed"
    else:
        output_folder = Path(output_folder)
    
    output_folder.mkdir(parents=True, exist_ok=True)
    
  
    # Mostrar formatos soportados
    print("\nFormatos soportados para conversión:")
    for fmt in sorted(SUPPORTED_FORMATS.keys()):
        print(f"  ✓ {fmt}")
    
    print(f"\n📁 Carpeta de salida: {output_folder}")
    print("\n" + "="*60)
    print("INICIANDO CONVERSIÓN Y COPIA DE ARCHIVOS")
    print("="*60 + "\n")
    
    converted_count = 0
    copied_count = 0
    error_count = 0
    unsupported_formats = set()
    
    # Procesar cada archivo
    for file in sorted(audio_path.iterdir()):
        if file.is_file():
            extension = file.suffix.lower()
            audio_id = file.stem
            
            # Verificar si la extensión es soportada
            if extension not in SUPPORTED_FORMATS:
                error_msg = f"❌ {file.name} - FORMATO NO SOPORTADO: {extension}"
                print(error_msg)
                unsupported_formats.add(extension)
                error_count += 1
                continue
            
            # Ruta de salida
            output_file = output_folder / f"{audio_id}.wav"
            
            # Si ya es WAV, solo copiar
            if extension == '.wav':
                print(f"📋 Copiando {file.name}...", end=" ")
                converter = CONVERTERS[extension]
                
                try:
                    if converter(file, output_file):
                        print("✓ Completado")
                        copied_count += 1
                    else:
                        print("✗ Error")
                        error_count += 1
                except Exception as e:
                    print(f"✗ Error: {str(e)}")
                    error_count += 1
            else:
                # Convertir a WAV
                print(f"⟳ Convirtiendo {file.name}...", end=" ")
                converter = CONVERTERS[extension]
                
                try:
                    if converter(file, output_file):
                        print("✓ Completado")
                        converted_count += 1
                    else:
                        print("✗ Error")
                        error_count += 1
                except Exception as e:
                    print(f"✗ Error: {str(e)}")
                    error_count += 1
    
    # Resumen final
    print("\n" + "="*60)
    print("RESUMEN DE PROCESAMIENTO")
    print("="*60)
    print(f"⟳ Convertidos:      {converted_count}")
    print(f"📋 Copiados (WAV):   {copied_count}")
    print(f"✗ Errores:          {error_count}")
    
    if unsupported_formats:
        print(f"\nFormatos no soportados encontrados: {', '.join(sorted(unsupported_formats))}")
    
    print("="*60 + "\n")

def main():

    print(f"Ubicación de audios: {AUDIO_INPUT_FOLDER}")
    print(f"Los archivos se guardarán en: {AUDIO_OUTPUT_FOLDER}\n")
    
    # Convertir todos los archivos a WAV en la carpeta audio_processed
    convert_all_to_wav(AUDIO_INPUT_FOLDER, AUDIO_OUTPUT_FOLDER)

if __name__ == "__main__":
    main()
