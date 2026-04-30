from general_features import extract_music_descriptors
from timbre_features import extract_timbre_descriptors
from rhythmic_features import extract_rhythmic_descriptors
from melodic_features import extract_melodic_features


def main():
    audio_file = "pruebawa.wav"

    print("🎵 Extrayendo descriptores musicales...")
    extract_music_descriptors(audio_file)

    print("\n🎨 Extrayendo descriptores de timbre...")
    extract_timbre_descriptors(audio_file)

    print("\n🥁 Extrayendo descriptores rítmicos...")
    extract_rhythmic_descriptors(audio_file)

    print("\n🎼 Extrayendo descriptores melódicos...")
    extract_melodic_features(audio_file)

    print("\n✅ Todos los descriptores han sido extraídos y guardados en la carpeta 'descriptors/'.")


if __name__ == "__main__":
    main()