from features import extract_features

audio_file = "prueba.mp3"

features = extract_features(audio_file)

print("✅ Features extraídas")
print("Dimensión:", len(features))
print(features)