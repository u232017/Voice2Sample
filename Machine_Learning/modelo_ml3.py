"""
================================================================================
MÓDULO DE BÚSQUEDA DE SONIDOS POR IMITACIÓN VOCAL
================================================================================

Proyecto: Voice2Signal - Búsqueda de sonidos por imitación vocal
Universidad: Trabajo Fin de Grado
Versión: 1.0
Fecha: Abril 2026

Descripción:
    Este módulo implementa un motor de búsqueda de audio basado en embeddings
    semánticos utilizando el modelo CLAP de Hugging Face. Permite encontrar
    audios similares en una base de datos comparando sus representaciones
    matemáticas (embeddings).

Uso básico:
    >>> import modelo_ml
    >>> modelo_ml.inicializar_modelo()
    >>> modelo_ml.inicializar_base_datos()
    >>> resultado = modelo_ml.encontrar_mejor_sample("mi_audio.wav")

================================================================================
"""

# ┌─────────────────────────────────────────────────────────────────────────┐
# │ SECCIÓN 1: IMPORTACIONES                                                │
# └─────────────────────────────────────────────────────────────────────────┘

import os
import glob
import numpy as np
import torch
import librosa
from transformers import ClapProcessor, ClapModel
from sklearn.neighbors import NearestNeighbors


# ┌─────────────────────────────────────────────────────────────────────────┐
# │ SECCIÓN 2: CONFIGURACIÓN GLOBAL                                         │
# └─────────────────────────────────────────────────────────────────────────┘

# Modelo CLAP cargado en memoria
_modelo_clap = None

# Procesador de CLAP para preparar audios
_procesador_clap = None

# Indexador KNN entrenado con embeddings
_indexador_knn = None

# Lista de rutas de archivos de audio en la base de datos
_rutas_archivos_bd = None

# Matriz de embeddings de la base de datos
_embeddings_bd = None

# Ruta de la carpeta con los audios
RUTA_BASE_DATOS = os.path.join(os.path.dirname(__file__), "base_datos_audios")


# ┌─────────────────────────────────────────────────────────────────────────┐
# │ SECCIÓN 3: FUNCIONES DE INICIALIZACIÓN                                  │
# └─────────────────────────────────────────────────────────────────────────┘

def inicializar_modelo():
    """
    Inicializa y carga el modelo CLAP en memoria.
    
    Esta función debe llamarse ANTES de usar cualquier otra función del módulo.
    
    Retorna:
        None
    
    Errores:
        RuntimeError: Si hay problema al descargar el modelo
    """
    global _modelo_clap, _procesador_clap
    
    print("\n" + "=" * 70)
    print("INICIALIZANDO MODELO CLAP")
    print("=" * 70)
    
    # Verificar si ya está cargado
    if _modelo_clap is not None and _procesador_clap is not None:
        print("✓ El modelo ya está cargado en memoria")
        return
    
    try:
        nombre_modelo = "laion/clap-htsat-fused"
        
        # Cargar el procesador (prepara audios para el modelo)
        print(f"\n[1/3] Descargando procesador de: {nombre_modelo}")
        _procesador_clap = ClapProcessor.from_pretrained(nombre_modelo)
        
        # Cargar el modelo
        print(f"[2/3] Descargando modelo de: {nombre_modelo}")
        _modelo_clap = ClapModel.from_pretrained(nombre_modelo)
        
        # Configurar modelo para inferencia
        print("[3/3] Configurando modelo...")
        _modelo_clap.eval()  # Modo evaluación (no entrenar)
        
        # Seleccionar dispositivo (GPU si disponible)
        dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
        _modelo_clap = _modelo_clap.to(dispositivo)
        
        print(f"\n✓ Modelo cargado exitosamente en: {dispositivo.upper()}")
        print("=" * 70 + "\n")
        
    except Exception as e:
        print(f"\n✗ ERROR al cargar el modelo:")
        print(f"  {str(e)}")
        raise


# ┌─────────────────────────────────────────────────────────────────────────┐
# │ SECCIÓN 4: FUNCIONES DE PROCESAMIENTO DE AUDIO                          │
# └─────────────────────────────────────────────────────────────────────────┘

def extraer_embedding(ruta_audio):
    """
    Extrae el embedding (representación matemática) de un audio.
    
    El embedding es un vector de números que representa las características
    principales del audio en un espacio de 512 dimensiones.
    
    Parámetros:
        ruta_audio (str): Ruta al archivo .wav
    
    Retorna:
        numpy.ndarray: Vector de embedding normalizado
    
    Errores:
        RuntimeError: Si el modelo no está inicializado
        FileNotFoundError: Si el archivo no existe
        Exception: Si hay problema al procesar el audio
    """
    global _modelo_clap, _procesador_clap
    
    # Validación previa
    if _modelo_clap is None or _procesador_clap is None:
        raise RuntimeError(
            "El modelo no está inicializado.\n"
            "Llame a inicializar_modelo() primero."
        )
    
    if not os.path.exists(ruta_audio):
        raise FileNotFoundError(f"No existe el archivo: {ruta_audio}")
    
    # Determinar dispositivo
    dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
    
    try:
        # ─────────────────────────────────────────────────────────────────
        # PASO 1: Cargar audio con librosa
        # ─────────────────────────────────────────────────────────────────
        # - Leer el archivo .wav
        # - Resamplear a 48000 Hz (requisito del modelo)
        # - Convertir a mono (1 canal)
        audio, sr = librosa.load(ruta_audio, sr=48000, mono=True)
        
        # ─────────────────────────────────────────────────────────────────
        # PASO 2: Procesar audio con el procesador CLAP
        # ─────────────────────────────────────────────────────────────────
        # El procesador prepara el audio para que el modelo lo entienda
        entradas = _procesador_clap(
            audio=audio,
            sampling_rate=48000,
            return_tensors="pt"
        )
        
        # Mover tensores al dispositivo correcto (GPU o CPU)
        entradas = {
            k: v.to(dispositivo) 
            for k, v in entradas.items() 
            if hasattr(v, 'to')
        }
        
        # ─────────────────────────────────────────────────────────────────
        # PASO 3: Pasar audio por el modelo CLAP
        # ─────────────────────────────────────────────────────────────────
        # torch.no_grad() = no calcular gradientes (ahorra memoria)
        with torch.no_grad():
            salidas = _modelo_clap.get_audio_features(**entradas)
        
        # ─────────────────────────────────────────────────────────────────
        # PASO 4: Extraer y procesar el embedding
        # ─────────────────────────────────────────────────────────────────
        # Obtener el embedding del objeto de salida
        embedding = salidas.pooler_output
        
        # Convertir a numpy y aplanar
        embedding = embedding.cpu().numpy().flatten()
        
        # Normalizar para que funcione bien con métrica coseno
        norma = np.linalg.norm(embedding)
        if norma > 0:
            embedding = embedding / norma
        
        return embedding
        
    except Exception as e:
        print(f"\n✗ Error al procesar {ruta_audio}:")
        print(f"  {str(e)}\n")
        raise


# ┌─────────────────────────────────────────────────────────────────────────┐
# │ SECCIÓN 5: FUNCIONES DE BASE DE DATOS                                   │
# └─────────────────────────────────────────────────────────────────────────┘

def inicializar_base_datos():
    """
    Carga todos los audios de la base de datos y entrena el buscador KNN.
    
    Esta función:
    1. Busca todos los .wav en la carpeta base_datos_audios
    2. Extrae el embedding de cada uno
    3. Entrena el algoritmo KNN para búsquedas rápidas
    
    Debe llamarse DESPUÉS de inicializar_modelo()
    
    Retorna:
        None
    
    Errores:
        RuntimeError: Si el modelo no está inicializado o sin archivos válidos
    """
    global _indexador_knn, _rutas_archivos_bd, _embeddings_bd
    
    # Validación
    if _modelo_clap is None:
        raise RuntimeError(
            "El modelo no está inicializado.\n"
            "Llame a inicializar_modelo() primero."
        )
    
    print("\n" + "=" * 70)
    print("INICIALIZANDO BASE DE DATOS")
    print("=" * 70)
    
    # ─────────────────────────────────────────────────────────────────────
    # PASO 1: Buscar archivos .wav
    # ─────────────────────────────────────────────────────────────────────
    print(f"\n[1/3] Buscando archivos .wav en:\n       {RUTA_BASE_DATOS}")
    
    patron = os.path.join(RUTA_BASE_DATOS, "**", "*.wav")
    archivos_wav = glob.glob(patron, recursive=True)
    
    if len(archivos_wav) == 0:
        print(f"\n✗ ADVERTENCIA: No se encontraron archivos .wav")
        print(f"  Carpeta buscada: {RUTA_BASE_DATOS}")
        return
    
    print(f"✓ Se encontraron {len(archivos_wav)} archivos")
    
    # ─────────────────────────────────────────────────────────────────────
    # PASO 2: Extraer embeddings de cada archivo
    # ─────────────────────────────────────────────────────────────────────
    print("\n[2/3] Extrayendo embeddings...")
    
    lista_embeddings = []
    lista_rutas = []
    contador_error = 0
    
    for indice, ruta_audio in enumerate(archivos_wav, 1):
        nombre_archivo = os.path.basename(ruta_audio)
        
        try:
            print(f"  {indice:3d}/{len(archivos_wav)} - {nombre_archivo}")
            
            # Extraer embedding
            embedding = extraer_embedding(ruta_audio)
            
            # Guardar
            lista_embeddings.append(embedding)
            lista_rutas.append(ruta_audio)
            
        except Exception as e:
            contador_error += 1
            print(f"       ⚠ Error: {str(e)}")
            continue
    
    # Validar que se procesaron archivos
    if len(lista_embeddings) == 0:
        raise RuntimeError(
            "No se pudo procesar ningún archivo.\n"
            "Verifique que los archivos .wav sean válidos."
        )
    
    print(f"✓ Se procesaron {len(lista_embeddings)} archivos")
    if contador_error > 0:
        print(f"⚠ Se saltaron {contador_error} archivos con error")
    
    # ─────────────────────────────────────────────────────────────────────
    # PASO 3: Entrenar el buscador KNN
    # ─────────────────────────────────────────────────────────────────────
    print("\n[3/3] Entrenando buscador KNN...")
    
    # Convertir a matriz numpy
    embeddings_matriz = np.array(lista_embeddings)
    
    # Guardar globalmente
    _embeddings_bd = embeddings_matriz
    _rutas_archivos_bd = lista_rutas
    
    # Configurar y entrenar KNN
    _indexador_knn = NearestNeighbors(
        n_neighbors=1,
        metric='cosine',
        algorithm='brute'
    )
    _indexador_knn.fit(embeddings_matriz)
    
    print(f"✓ Buscador entrenado con {embeddings_matriz.shape[0]} vectores")
    print("=" * 70 + "\n")


# ┌─────────────────────────────────────────────────────────────────────────┐
# │ SECCIÓN 6: FUNCIÓN PRINCIPAL DE BÚSQUEDA                                │
# └─────────────────────────────────────────────────────────────────────────┘

def encontrar_mejor_sample(ruta_audio_usuario):
    """
    Busca el audio más similar en la base de datos.
    
    Esta es la función PRINCIPAL del módulo. Recibe un audio del usuario
    y devuelve la ruta del archivo de la base de datos que mejor coincide.
    
    Parámetros:
        ruta_audio_usuario (str): Ruta al archivo .wav del usuario
    
    Retorna:
        str: Ruta del archivo .wav ganador de la base de datos
    
    Errores:
        RuntimeError: Si la base de datos no está inicializada
        FileNotFoundError: Si el archivo del usuario no existe
    
    Ejemplo:
        >>> resultado = encontrar_mejor_sample("mi_imitacion.wav")
        >>> print(f"Mejor match: {resultado}")
    """
    global _indexador_knn, _rutas_archivos_bd
    
    # Validación
    if _indexador_knn is None or _rutas_archivos_bd is None:
        raise RuntimeError(
            "La base de datos no está inicializada.\n"
            "Llame a inicializar_base_datos() primero."
        )
    
    if not os.path.exists(ruta_audio_usuario):
        raise FileNotFoundError(f"No existe: {ruta_audio_usuario}")
    
    print("\n" + "=" * 70)
    print("BÚSQUEDA DE SONIDO SIMILAR")
    print("=" * 70)
    print(f"\nAudio del usuario: {ruta_audio_usuario}")
    
    try:
        # ─────────────────────────────────────────────────────────────────
        # PASO 1: Extraer embedding del audio del usuario
        # ─────────────────────────────────────────────────────────────────
        print("\n[1/3] Extrayendo embedding del usuario...")
        embedding_usuario = extraer_embedding(ruta_audio_usuario)
        print(f"✓ Embedding extraído (dimensiones: {embedding_usuario.shape})")
        
        # ─────────────────────────────────────────────────────────────────
        # PASO 2: Buscar vecino más cercano
        # ─────────────────────────────────────────────────────────────────
        print("\n[2/3] Buscando en la base de datos...")
        
        # Reformatear para KNN (forma: 1 x 512)
        embedding_para_buscar = embedding_usuario.reshape(1, -1)
        
        # Búsqueda
        distancias, indices = _indexador_knn.kneighbors(embedding_para_buscar)
        
        # ─────────────────────────────────────────────────────────────────
        # PASO 3: Preparar y mostrar resultados
        # ─────────────────────────────────────────────────────────────────
        indice_ganador = indices[0][0]
        distancia_coseno = distancias[0][0]
        ruta_ganadora = _rutas_archivos_bd[indice_ganador]
        
        print(f"✓ Búsqueda completada")
        
        # Mostrar resultados
        print("\n" + "=" * 70)
        print("RESULTADOS")
        print("=" * 70)
        print(f"\n[3/3] Audio más similar encontrado:")
        print(f"  Archivo: {os.path.basename(ruta_ganadora)}")
        print(f"  Ruta:    {ruta_ganadora}")
        print(f"  Score:   {distancia_coseno:.6f} (más bajo = mejor match)")
        print("\n" + "=" * 70 + "\n")
        
        return ruta_ganadora
        
    except Exception as e:
        print(f"\n✗ Error durante la búsqueda:")
        print(f"  {str(e)}\n")
        raise


# ┌─────────────────────────────────────────────────────────────────────────┐
# │ SECCIÓN 7: BLOQUE PRINCIPAL (prueba del módulo)                         │
# └─────────────────────────────────────────────────────────────────────────┘

if __name__ == "__main__":
    """
    Este código se ejecuta solo si corres el archivo directamente:
        $ python modelo_ml.py
    
    No se ejecuta si importas el módulo en otro archivo.
    """
    
    print("\n" + "=" * 70)
    print("PRUEBA DEL MÓDULO: Voice2Signal")
    print("=" * 70)
    
    try:
        # Paso 1: Cargar modelo
        inicializar_modelo()
        
        # Paso 2: Cargar base de datos
        inicializar_base_datos()
        
        # Paso 3: Información de uso
        print("\n✓ Módulo listo para usar\n")
        print("Ejemplo de uso en tu código:")
        print("  from modelo_ml import encontrar_mejor_sample")
        print("  resultado = encontrar_mejor_sample('mi_audio.wav')")
        print()
        
    except Exception as e:
        print(f"\n✗ Error durante la inicialización:\n  {str(e)}\n")
        raise
