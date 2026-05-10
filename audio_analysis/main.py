from general_features import extract_music_descriptors
from timbre_features import extract_timbre_descriptors
from rhythmic_features import extract_rhythmic_descriptors
from melodic_features import extract_melodic_features
import os

def main():
    audio_dir = "../Dataset/audio_processed_prueba"
    audio_files = [os.path.join(audio_dir, f) for f in os.listdir(audio_dir) 
                   if f.endswith(('.wav', '.mp3', '.aif', '.aiff'))]
    
    for audio_file in audio_files:
        print("🎵 Extrayendo descriptores musicales...")
        extract_music_descriptors(audio_file)

        print("\n🎨 Extrayendo descriptores de timbre...")
        extract_timbre_descriptors(audio_file)

        print("\n🥁 Extrayendo descriptores rítmicos...")
        extract_rhythmic_descriptors(audio_file)

        print("\n🎼 Extrayendo descriptores melódicos...")
        extract_melodic_features(audio_file)

        print("\n✅ Todos los descriptores han sido extraídos y guardados en la carpeta 'descriptors/'." )
        
if __name__ == "__main__":
    main()