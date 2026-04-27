"""
================================================================================
MÓDULO DE BÚSQUEDA DE SONIDOS POR IMITACIÓN VOCAL
================================================================================

Proyecto: Voice2Signal - Búsqueda de sonidos por imitación vocal
Universidad: Trabajo Fin de Grado
Descripción: Este módulo implementa un motor de búsqueda de audio basado en
             embeddings semánticos utilizando el modelo CLAP de Hugging Face.

Autor: Equipo de Machine Learning
Fecha: Abril 2026
Versión: 1.0

================================================================================
"""

# ==============================================================================
# IMPORTACIONES
# ==============================================================================

import os
import glob
import numpy as np
import torch
import librosa
from transformers import ClapProcessor, ClapModel
from sklearn.neighbors import NearestNeighbors

# ==============================================================================
# VARIABLES GLOBALES DEL MÓDULO
# ==============================================================================

# Variable global para almacenar el modelo CLAP cargado en memoria
_modelo_clap = None

# Variable global para almacenar el procesador de CLAP
_procesador_clap = None

# Variable global para almacenar el indexador KNN entrenado
_indexador_knn = None

# Variable global para almacenar las rutas de los archivos de audio de la base de datos
_rutas_archivos_bd = None

# Variable global para almacenar los embeddings de la base de datos
_embeddings_bd = None

# Ruta de la carpeta que contiene la base de datos de audios
RUTA_BASE_DATOS = os.path.join(os.path.dirname(__file__), "base_datos_audios")


# ==============================================================================
# FUNCIONES PÚBLICAS DEL MÓDULO
# ==============================================================================

def inicializar_modelo():
    """
    ==============================================================================
    FUNCIÓN: inicializar_modelo()
    ==============================================================================
    
    Descripción:
        Inicializa y carga el modelo CLAP y su procesador en memoria.
        Esta función debe llamarse antes de cualquier operación de búsqueda.
    
    Parámetros:
        Ninguno
    
    Retorna:
        None
    
    Efectos secundarios:
        - Carga las variables globales _modelo_clap y _procesador_clap
        - Descarga el modelo de Hugging Face si no está en caché local
    
    Ejemplo de uso:
        >>> inicializar_modelo()
        >>> print("Modelo cargado correctamente")
    ==============================================================================
    """
    global _modelo_clap, _procesador_clap
    
    print("=" * 70)
    print("INICIALIZANDO MODELO CLAP")
    print("=" * 70)
    
    # Verificar si el modelo ya está cargado para evitar recargas innecesarias
    if _modelo_clap is not None and _procesador_clap is not None:
        print("El modelo ya está cargado en memoria.")
        return
    
    try:
        # Nombre del modelo pre-entrenado de Hugging Face
        # Este modelo fue entrenado en AudioSet y es óptimo para tareas de audio
        nombre_modelo = "laion/clap-htatsc-audioset"
        
        print(f"Cargando procesador: {nombre_modelo}")
        # Cargar el procesador de CLAP
        # El procesador se encarga de tokenizar el audio y preparar las entradas
        _procesador_clap = ClapProcessor.from_pretrained(nombre_modelo)
        
        print(f"Cargando modelo: {nombre_modelo}")
        # Cargar el modelo CLAP pre-entrenado
        # Usamos torch.float16 para reducir el uso de memoria VRAM
        _modelo_clap = ClapModel.from_pretrained(nombre_modelo)
        
        # Configurar el modelo en modo evaluación
        # Esto desactiva capas como Dropout que solo se usan durante entrenamiento
        _modelo_clap.eval()
        
        # Mover el modelo a GPU si está disponible, si no usar CPU
        # GPU = más rápido para procesar múltiples audios
        dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
        _modelo_clap = _modelo_clap.to(dispositivo)
        
        # Desactivar cálculo de gradientes globalmente para el modelo
        for param in _modelo_clap.parameters():
            param.requires_grad = False
        
        print(f"Modelo cargado exitosamente en dispositivo: {dispositivo}")
        print("=" * 70)
        
    except Exception as e:
        # Manejo de errores durante la carga del modelo
        print(f"ERROR al cargar el modelo: {str(e)}")
        raise


def extraer_embedding(ruta_audio):
    """
    ==============================================================================
    FUNCIÓN: extraer_embedding(ruta_audio)
    ==============================================================================
    
    Descripción:
        Recibe la ruta de un archivo de audio .wav, lo procesa con librosa,
        lo pasa por el modelo CLAP y devuelve el vector de embedding (representación
        matemática) del audio.
    
    Parámetros:
        ruta_audio (str): Ruta absoluta o relativa al archivo .wav
    
    Retorna:
        numpy.ndarray: Vector de embedding de dimensiones (512,) con valores float32
    
    Efectos secundarios:
        - Utiliza torch.no_grad() para evitar el cálculo de gradientes (ahorro memoria)
    
    Ejemplo de uso:
        >>> embedding = extraer_embedding("mi_audio.wav")
        >>> print(f"Dimensiones del embedding: {embedding.shape}")
    ==============================================================================
    """
    global _modelo_clap, _procesador_clap
    
    # Verificar que el modelo haya sido inicializado
    if _modelo_clap is None or _procesador_clap is None:
        raise RuntimeError(
            "El modelo no ha sido inicializado. "
            "Debe llamar a inicializar_modelo() primero."
        )
    
    # Verificar que el archivo de audio existe
    if not os.path.exists(ruta_audio):
        raise FileNotFoundError(f"No se encontró el archivo de audio: {ruta_audio}")
    
    # Verificar que es un archivo
    if not os.path.isfile(ruta_audio):
        raise ValueError(f"La ruta no es un archivo válido: {ruta_audio}")
    
    # Determinar el dispositivo donde ejecutar el modelo
    dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
    
    try:
        # -----------------------------------------------------------------------------
        # Paso 1: Cargar el audio usando librosa
        # -----------------------------------------------------------------------------
        # librosa.load() lee archivos de audio y los convierte a un array numpy
        # sr=48000: Forzamos la frecuencia de muestreo a 48000 Hz según requisitos
        # mono=True: Convertimos a mono (un solo canal) para consistencia
        audio, tasa_muestreo = librosa.load(ruta_audio, sr=48000, mono=True)
        
        # Validar que el audio se cargó correctamente y tiene contenido
        if audio is None or len(audio) == 0:
            raise ValueError(f"No se pudo cargar el audio: {ruta_audio}")
        
        # Validar que la frecuencia de muestreo es correcta
        if tasa_muestreo != 48000:
            raise ValueError(f"Error al resamplear. Se obtuvo {tasa_muestreo} Hz en lugar de 48000 Hz")
        
        # -----------------------------------------------------------------------------
        # Paso 2: Procesar el audio con el procesador de CLAP
        # -----------------------------------------------------------------------------
        # El procesador tokeniza el audio y lo prepara para el modelo
        # return_tensors="pt": Devuelve tensores de PyTorch
        entradas = _procesador_clap(
            audios=audio,              # Array de audio de librosa
            sampling_rate=48000,       # Frecuencia de muestreo
            return_tensors="pt"        # Formato de salida PyTorch
        )
        
        # Mover las entradas al mismo dispositivo que el modelo
        entradas = {k: v.to(dispositivo) for k, v in entradas.items()}
        
        # -----------------------------------------------------------------------------
        # Paso 3: Ejecutar el modelo en modo inferencia
        # -----------------------------------------------------------------------------
        # torch.no_grad() desactiva el cálculo de gradientes
        # Esto ahorra memoria VRAM y acelera la inferencia
        with torch.no_grad():
            # Obtener las salidas del modelo CLAP
            # El modelo devuelve un objeto con los embeddings de audio
            salidas_modelo = _modelo_clap(**entradas)
            # Extraer los embeddings del audio desde el objeto de salida
            resultados = salidas_modelo.audio_embeds
        
        # -----------------------------------------------------------------------------
        # Paso 4: Convertir a numpy y aplanar el embedding
        # -----------------------------------------------------------------------------
        # Convertir el tensor de PyTorch a array de numpy
        embedding = resultados.cpu().numpy()
        
        # Aplanar el embedding a 1D en caso de que venga con dimensiones extra
        # El modelo puede devolver formas como (1, 512) o (512,)
        embedding = embedding.flatten()
        
        # Normalizar el embedding para usar correctamente con métrica coseno
        # Esto asegura que todos los vectores estén en la misma escala
        norma = np.linalg.norm(embedding)
        if norma > 0:
            embedding = embedding / norma
        
        return embedding
        
    except Exception as e:
        print(f"ERROR al procesar el audio {ruta_audio}: {str(e)}")
        raise


def inicializar_base_datos():
    """
    ==============================================================================
    FUNCIÓN: inicializar_base_datos()
    ==============================================================================
    
    Descripción:
        Lógica inicial que lee automáticamente todos los archivos .wav de la
        carpeta 'base_datos_audios', extrae sus embeddings utilizando el modelo
        CLAP, y entrena el buscador KNN (NearestNeighbors) con ellos.
    
    Parámetros:
        Ninguno
    
    Retorna:
        None
    
    Efectos secundarios:
        - Carga las variables globales _indexador_knn, _rutas_archivos_bd, _embeddings_bd
        - Imprime información del progreso del procesamiento
    
    Ejemplo de uso:
        >>> inicializar_modelo()
        >>> inicializar_base_datos()
        >>> print("Base de datos lista para búsquedas")
    ==============================================================================
    """
    global _indexador_knn, _rutas_archivos_bd, _embeddings_bd
    
    # Verificar que el modelo haya sido inicializado
    if _modelo_clap is None:
        raise RuntimeError(
            "El modelo no ha sido inicializado. "
            "Debe llamar a inicializar_modelo() primero."
        )
    
    print("=" * 70)
    print("INICIALIZANDO BASE DE DATOS DE AUDIOS")
    print("=" * 70)
    
    # -----------------------------------------------------------------------------
    # Paso 1: Buscar todos los archivos .wav en la carpeta de base de datos
    # -----------------------------------------------------------------------------
    # Usamos glob para encontrar todos los archivos .wav recursivamente
    # pattern: "**/*.wav" busca en todos los subdirectorios
    patron_busqueda = os.path.join(RUTA_BASE_DATOS, "**", "*.wav")
    archivos_wav = glob.glob(patron_busqueda, recursive=True)
    
    # Verificar que se encontraron archivos
    if len(archivos_wav) == 0:
        print(f"ADVERTENCIA: No se encontraron archivos .wav en: {RUTA_BASE_DATOS}")
        print("Verifique que la carpeta 'base_datos_audios' contenga archivos .wav")
        return
    
    print(f"Se encontraron {len(archivos_wav)} archivos de audio")
    
    # -----------------------------------------------------------------------------
    # Paso 2: Extraer embeddings para cada archivo de audio
    # -----------------------------------------------------------------------------
    lista_embeddings = []
    lista_rutas = []
    
    for indice, ruta_audio in enumerate(archivos_wav):
        try:
            print(f"Procesando audio {indice + 1}/{len(archivos_wav)}: {os.path.basename(ruta_audio)}")
            
            # Extraer el embedding del audio actual
            embedding = extraer_embedding(ruta_audio)
            
            # Almacenar el embedding y la ruta
            lista_embeddings.append(embedding)
            lista_rutas.append(ruta_audio)
            
        except Exception as e:
            # Si hay error en un archivo, lo saltamos pero continuamos con los demás
            print(f"  ADVERTENCIA: Error al procesar {ruta_audio}: {str(e)}")
            continue
    
    # Verificar que se procesaron al menos algunos archivos
    if len(lista_embeddings) == 0:
        raise RuntimeError(
            "No se pudo extraer ningún embedding de la base de datos. "
            "Verifique que los archivos .wav sean válidos."
        )
    
    # Convertir a arrays de numpy para eficiencia
    # np.array() crea una matriz de forma (num_archivos, 512)
    embeddings_matriz = np.array(lista_embeddings)
    
    # Almacenar en variables globales
    _embeddings_bd = embeddings_matriz
    _rutas_archivos_bd = lista_rutas
    
    print(f"\nEmbeddings extraídos exitosamente: {embeddings_matriz.shape}")
    
    # -----------------------------------------------------------------------------
    # Paso 3: Entrenar el indexador KNN
    # -----------------------------------------------------------------------------
    print("\nEntrenando el buscador KNN...")
    
    # Configurar NearestNeighbors con métrica cosine
    # n_neighbors=1: Buscaremos el vecino más cercano (el mejor match)
    # metric='cosine': Usamos similitud coseno que es óptima para embeddings
    _indexador_knn = NearestNeighbors(
        n_neighbors=1,        # Número de vecinos a buscar
        metric='cosine',     # Métrica de distancia coseno
        algorithm='brute'    # Algoritmo force (exacto) para máxima precisión
    )
    
    # Entrenar el indexador con los embeddings de la base de datos
    _indexador_knn.fit(embeddings_matriz)
    
    print("Buscador KNN entrenado exitosamente")
    print("=" * 70)


def encontrar_mejor_sample(ruta_audio_usuario):
    """
    ==============================================================================
    FUNCIÓN: encontrar_mejor_sample(ruta_audio_usuario)
    ==============================================================================
    
    Descripción:
        Función principal del módulo. Recibe la ruta del audio grabado por el
        usuario (imitación vocal), calcula su embedding, busca el vecino más
        cercano en el indexador KNN, y devuelve la ruta del archivo .wav
        ganador de la base de datos.
    
    Parámetros:
        ruta_audio_usuario (str): Ruta absoluta o relativa al audio del usuario
    
    Retorna:
        str: Ruta del archivo .wav de la base de datos que mejor coincide
    
    Efectos secundarios:
        - Imprime información de la búsqueda y resultados
    
    Ejemplo de uso:
        >>> inicializar_modelo()
        >>> inicializar_base_datos()
        >>> resultado = encontrar_mejor_sample("mi_imitacion.wav")
        >>> print(f"El mejor match es: {resultado}")
    ==============================================================================
    """
    global _indexador_knn, _rutas_archivos_bd
    
    # Verificar que la base de datos haya sido inicializada
    if _indexador_knn is None or _rutas_archivos_bd is None:
        raise RuntimeError(
            "La base de datos no ha sido inicializada. "
            "Debe llamar a inicializar_base_datos() primero."
        )
    
    # Verificar que el archivo del usuario existe
    if not os.path.exists(ruta_audio_usuario):
        raise FileNotFoundError(f"No se encontró el archivo del usuario: {ruta_audio_usuario}")
    
    print("=" * 70)
    print("BÚSQUEDA DE SONIDO SIMILAR")
    print("=" * 70)
    print(f"Audio del usuario: {ruta_audio_usuario}")
    
    try:
        # -----------------------------------------------------------------------------
        # Paso 1: Extraer embedding del audio del usuario
        # -----------------------------------------------------------------------------
        print("\nExtrayendo embedding del audio del usuario...")
        embedding_usuario = extraer_embedding(ruta_audio_usuario)
        print(f"Embedding calculado: forma {embedding_usuario.shape}")
        
        # -----------------------------------------------------------------------------
        # Paso 2: Buscar el vecino más cercano en la base de datos
        # -----------------------------------------------------------------------------
        print("\nBuscando el sonido más similar en la base de datos...")
        
        # Reformatear el embedding para que tenga forma (1, 512) para KNN
        embedding_para_buscar = embedding_usuario.reshape(1, -1)
        
        # Ejecutar la búsqueda KNN
        # distances: distancia al vecino más cercano
        # indices: índice del vecino más cercano en nuestro array
        distancias, indices = _indexador_knn.kneighbors(embedding_para_buscar)
        
        # -----------------------------------------------------------------------------
        # Paso 3: Obtener la ruta del archivo ganador
        # -----------------------------------------------------------------------------
        indice_ganador = indices[0][0]  # Primer (y único) vecino
        distancia = distancias[0][0]   # Distancia al vecino
        
        ruta_ganadora = _rutas_archivos_bd[indice_ganador]
        
        # -----------------------------------------------------------------------------
        # Paso 4: Mostrar resultados
        # -----------------------------------------------------------------------------
        print("\n" + "=" * 70)
        print("RESULTADOS DE LA BÚSQUEDA")
        print("=" * 70)
        print(f"Archivo más similar: {os.path.basename(ruta_ganadora)}")
        print(f"Ruta completa: {ruta_ganadora}")
        print(f"Distancia coseno: {distancia:.6f}")
        print("=" * 70)
        
        return ruta_ganadora
        
    except Exception as e:
        print(f"ERROR durante la búsqueda: {str(e)}")
        raise


# ==============================================================================
# BLOQUE DE PRUEBA (se ejecuta solo si se corre el script directamente)
# ==============================================================================

if __name__ == "__main__":
    """
    ==============================================================================
    BLOQUE PRINCIPAL DE EJECUCIÓN
    ==============================================================================
    
    Este bloque se ejecuta solo cuando el script se corre directamente
    (python modelo_ml.py). No se ejecuta cuando el módulo se importa.
    
    Uso típico:
        $ python modelo_ml.py
    ==============================================================================
    """
    print("\n" + "=" * 70)
    print("MÓDULO DE BÚSQUEDA DE SONIDOS POR IMITACIÓN VOCAL")
    print("=" * 70 + "\n")
    
    try:
        # Paso 1: Inicializar el modelo CLAP
        inicializar_modelo()
        
        # Paso 2: Inicializar la base de datos (procesar todos los audios)
        inicializar_base_datos()
        
        # Ejemplo de cómo usar la función de búsqueda
        # (Descomenta las siguientes líneas para probar con un audio real)
        # 
        # ruta_audio_ejemplo = "mi_imitacion.wav"
        # if os.path.exists(ruta_audio_ejemplo):
        #     resultado = encontrar_mejor_sample(ruta_audio_ejemplo)
        #     print(f"\nResultado final: {resultado}")
        
        print("\n✓ Módulo listo para usar")
        print("  Para buscar un sonido, llama a encontrar_mejor_sample(ruta_audio)")
        
    except Exception as e:
        print(f"\n✗ Error durante la inicialización: {str(e)}")
        raise