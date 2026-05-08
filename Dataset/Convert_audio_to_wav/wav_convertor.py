from pathlib import Path
import subprocess



# ==================== CONFIG ====================

AUDIO_INPUT_FOLDER = "./Dataset/audio"
AUDIO_OUTPUT_FOLDER = "./Dataset/audio_processed"

TARGET_SAMPLE_RATE = 16000


SUPPORTED_FORMATS = {
    ".wav",
    ".mp3",
    ".flac",
    ".ogg",
    ".aif",
    ".aiff"
}


# ==================== PROCESS AUDIO ====================

def process_audio(input_path, output_path):
    """
    Pipeline:
    1. Cargar audio
    2. Quitar silencio inicial
    3. Resamplear
    4. Guardar WAV
    """

    try:

        # ========= CARGAR CON PYDUB =========
        subprocess.run([
            "ffmpeg",
            "-y",
            "-i", str(input_path),
            "-af", "silenceremove=start_periods=1:start_duration=0.2:start_threshold=-35dB",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(output_path)
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True)

        return True

    except Exception as e:

        print(f"\n❌ Error procesando {input_path.name}")
        print(e)

        return False
    

# ==================== MAIN ====================

def process_all_audios(input_folder, output_folder):

    input_folder = Path(input_folder)
    output_folder = Path(output_folder)

    output_folder.mkdir(parents=True, exist_ok=True)

    processed = 0
    errors = 0

    print("\n" + "="*60)
    print("PROCESANDO AUDIOS")
    print("="*60)

    for file in sorted(input_folder.iterdir()):

        if not file.is_file():
            continue

        extension = file.suffix.lower()

        if extension not in SUPPORTED_FORMATS:
            print(f"Formato no soportado: {file.name}")
            continue

        output_path = output_folder / f"{file.stem}.wav"

        print(f"⟳ Procesando {file.name}...", end=" ")

        success = process_audio(file, output_path)

        if success:
            print("✓")
            processed += 1
        else:
            print("✗")
            errors += 1

    print("\n" + "="*60)
    print("RESUMEN")
    print("="*60)
    print(f"✓ Procesados: {processed}")
    print(f"✗ Errores:    {errors}")
    print("="*60)
