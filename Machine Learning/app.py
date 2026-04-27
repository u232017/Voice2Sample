import streamlit as st
import librosa
import torch
import numpy as np
import os
from transformers import ClapModel, ClapProcessor
from sklearn.neighbors import NearestNeighbors

# 1. CONFIGURACIÓN DE LA PÁGINA
st.set_page_config(page_title="Voice2Sample PoC", page_icon="🎤")
st.title("🎤 Voice2Sample - Prototipo IA")
st.write("Sube tu voz tarareando y la IA (CLAP) encontrará el sample más parecido.")

# 2. CARGAR EL CEREBRO DE LA IA (Se guarda en caché para no recargar cada vez)
@st.cache_resource
def cargar_ia():
    # Usamos un modelo CLAP optimizado
    model_id = "laion/clap-htatsc-audioset"
    processor = ClapProcessor.from_pretrained(model_id)
    model = ClapModel.from_pretrained(model_id)
    return processor, model

processor, model = cargar_ia()

# 3. FUNCIÓN PARA EXTRAER EL VECTOR MATEMÁTICO (EMBEDDING)
def extraer_embedding(audio_path):
    # Librosa carga el audio a 48000 Hz, que es lo que le gusta a CLAP
    audio_array, sr = librosa.load(audio_path, sr=48000)
    inputs = processor(audios=audio_array, return_tensors="pt", sampling_rate=sr)
    with torch.no_grad():
        audio_features = model.get_audio_features(**inputs)
    return audio_features.numpy()[0]

# 4. PREPARAR LA BASE DE DATOS LOCAL
carpeta_bd = "base_datos_audios"
rutas_bd = [os.path.join(carpeta_bd, f) for f in os.listdir(carpeta_bd) if f.endswith('.wav')]

if len(rutas_bd) == 0:
    st.error(f"⚠️ Por favor, mete algunos archivos .wav en la carpeta '{carpeta_bd}'")
else:
    # 5. ENTRENAR EL BUSCADOR (Se hace en caché para ir rápido)
    @st.cache_data
    def entrenar_buscador(rutas):
        vectores = []
        for ruta in rutas:
            vectores.append(extraer_embedding(ruta))
        
        knn = NearestNeighbors(n_neighbors=1, metric='cosine')
        knn.fit(np.array(vectores))
        return knn, vectores

    buscador_knn, vectores_bd = entrenar_buscador(rutas_bd)
    st.success(f"✅ Base de datos cargada: {len(rutas_bd)} sonidos disponibles.")

    st.divider()

    # 6. INTERFAZ DE USUARIO: SUBIR AUDIO
    st.subheader("1️⃣ Sube tu imitación vocal")
    audio_usuario = st.file_uploader("Sube un archivo .wav con tu voz", type=["wav"])

    if audio_usuario is not None:
        st.audio(audio_usuario, format='audio/wav')
        
        if st.button("🔍 Buscar Sonido Similar", type="primary"):
            with st.spinner('La IA está analizando tu voz...'):
                # Guardar el audio del usuario temporalmente
                with open("temp_voz.wav", "wb") as f:
                    f.write(audio_usuario.getbuffer())
                
                # Extraer vector y buscar
                vector_usuario = extraer_embedding("temp_voz.wav")
                distancias, indices = buscador_knn.kneighbors([vector_usuario])
                
                indice_ganador = indices[0][0]
                sonido_ganador = rutas_bd[indice_ganador]
                
                st.balloons()
                st.subheader("🎯 ¡Match Encontrado!")
                st.success(f"El sonido más parecido es: **{os.path.basename(sonido_ganador)}**")
                
                # Reproductor para el sonido ganador
                st.audio(sonido_ganador, format='audio/wav')