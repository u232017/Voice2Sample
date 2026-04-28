import librosa
from transformers import ClapModel, ClapProcessor

print("1. Cargando IA...")
procesador = ClapProcessor.from_pretrained("laion/clap-htsat-fused")
modelo = ClapModel.from_pretrained("laion/clap-htsat-fused")

print("2. Cargando tu imitación...")
# Cargamos tu archivo directamente
audio, sr = librosa.load("mi_imitacion.wav", sr=48000, mono=True)

print("3. Procesando...")
entradas = procesador(audio=audio, sampling_rate=48000, return_tensors="pt")

print("\n--- RADIOGRAFÍA DE LOS DATOS ---")
# Vamos a ver qué basura nos está colando la librería
for clave, valor in entradas.items():
    print(f"Clave: {clave} | Tipo de dato: {type(valor)}")
print("--------------------------------\n")

print("4. Pasando los datos a la red neuronal...")
# Le pasamos a la fuerza SOLO la característica que nos interesa
features = entradas["input_features"]
resultados = modelo.get_audio_features(**entradas)
print("🎉 ¡ÉXITO! El vector se ha generado. Forma:", resultados.shape)