"""
================================================================================
MÓDULO DE BÚSQUEDA DE SONIDOS POR IMITACIÓN VOCAL
================================================================================
Descripción:
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
import sys
from datetime import datetime

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
# FUNCIONES DE FORMATEO PARA TERMINAL
# ==============================================================================

def _imprimir_encabezado(titulo):
    """Imprime un encabezado con formato."""
    print("\n" + "█" * 80)
    print(f"  ▶ {titulo}")
    print("█" * 80)

def _imprimir_linea_separadora():
    """Imprime una línea separadora."""
    print("─" * 80)

def _imprimir_exito(mensaje):
    """Imprime un mensaje de éxito con símbolo."""
    print(f"  ✓ {mensaje}")

def _imprimir_info(mensaje):
    """Imprime un mensaje informativo con símbolo."""
    print(f"  ⊙ {mensaje}")

def _imprimir_advertencia(mensaje):
    """Imprime un mensaje de advertencia con símbolo."""
    print(f"  ⚠ {mensaje}")

def _imprimir_error(mensaje):
    """Imprime un mensaje de error con símbolo."""
    print(f"  ✗ {mensaje}")

def _imprimir_progreso(actual, total, nombre_archivo=""):
    """Imprime una barra de progreso visual."""
    porcentaje = (actual / total) * 100
    barra_completa = 40
    barra_llena = int((actual / total) * barra_completa)
    barra_vacia = barra_completa - barra_llena
    
    barra = "█" * barra_llena + "░" * barra_vacia
    archivo_info = f" {nombre_archivo[:45]}" if nombre_archivo else ""
    print(f"  [{barra}] {actual}/{total} ({porcentaje:5.1f}%){archivo_info}")

def _imprimir_separador_final():
    """Imprime un separador al final."""
    print("█" * 80 + "\n")


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
    
    _imprimir_encabezado("INICIALIZANDO MODELO CLAP")
    
    # Verificar si el modelo ya está cargado para evitar recargas innecesarias
    if _modelo_clap is not None and _procesador_clap is not None:
        _imprimir_exito("Modelo ya cargado en memoria")
        _imprimir_separador_final()
        return
    
    try:
        # Nombre del modelo pre-entrenado de Hugging Face
        # Este modelo fue entrenado en AudioSet y es óptimo para tareas de audio
        nombre_modelo = "laion/clap-htsat-fused"
        
        _imprimir_info(f"Cargando procesador: {nombre_modelo}")
        # Cargar el procesador de CLAP
        # El procesador se encarga de tokenizar el audio y preparar las entradas
        _procesador_clap = ClapProcessor.from_pretrained(nombre_modelo)
        _imprimir_exito("Procesador cargado")
        
        _imprimir_info(f"Cargando modelo: {nombre_modelo}")
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
        
        _imprimir_exito(f"Modelo cargado exitosamente en: {dispositivo.upper()}")
        _imprimir_separador_final()
        
    except Exception as e:
        # Manejo de errores durante la carga del modelo
        _imprimir_error(f"Error al cargar el modelo: {str(e)}")
        _imprimir_separador_final()
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
        
        # -----------------------------------------------------------------------------
        # Paso 2: Procesar el audio con el procesador de CLAP
        # -----------------------------------------------------------------------------
        # El procesador tokeniza el audio y lo prepara para el modelo
        # return_tensors="pt": Devuelve tensores de PyTorch
        entradas = _procesador_clap(
            audio=audio,              # Array de audio de librosa
            sampling_rate=48000,       # Frecuencia de muestreo
            return_tensors="pt"        # Formato de salida PyTorch
        )
        
        # Mover las entradas al mismo dispositivo que el modelo (filtrando datos vacíos)
        entradas = {k: v.to(dispositivo) for k, v in entradas.items() if hasattr(v, 'to')}
        
        # -----------------------------------------------------------------------------
        # Paso 3: Ejecutar el modelo en modo inferencia
        # -----------------------------------------------------------------------------
        # torch.no_grad() desactiva el cálculo de gradientes
        # Esto ahorra memoria VRAM y acelera la inferencia
# 4. Ejecutar el modelo en modo inferencia
        with torch.no_grad():
            resultados = _modelo_clap.get_audio_features(**entradas)
        
        # 5. Convertir a numpy y aplanar (AQUÍ ABRIMOS LA CAJA CON pooler_output)
        tensor_matematico = resultados.pooler_output
        embedding = tensor_matematico.cpu().numpy().flatten()
        
        return embedding
        
    except Exception as e:
        _imprimir_error(f"Error procesando audio: {str(e)}")
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
    
    _imprimir_encabezado("INICIALIZANDO BASE DE DATOS DE AUDIOS")
    
    # Verificar que el modelo haya sido inicializado
    if _modelo_clap is None:
        _imprimir_error("El modelo no ha sido inicializado primero")
        raise RuntimeError("Debe llamar a inicializar_modelo() primero.")
    
    # -----------------------------------------------------------------------------
    # Paso 1: Buscar todos los archivos .wav en la carpeta de base de datos
    # -----------------------------------------------------------------------------
    # Usamos glob para encontrar todos los archivos .wav recursivamente
    # pattern: "**/*.wav" busca en todos los subdirectorios
    patron_busqueda = os.path.join(RUTA_BASE_DATOS, "**", "*.wav")
    archivos_wav = glob.glob(patron_busqueda, recursive=True)
    
    # Verificar que se encontraron archivos
    if len(archivos_wav) == 0:
        _imprimir_advertencia("No se encontraron archivos .wav")
        _imprimir_info(f"Ruta buscada: {RUTA_BASE_DATOS}")
        _imprimir_separador_final()
        return
    
    _imprimir_exito(f"Se encontraron {len(archivos_wav)} archivos de audio")
    _imprimir_linea_separadora()
    
    # -----------------------------------------------------------------------------
    # Paso 2: Extraer embeddings para cada archivo de audio
    # -----------------------------------------------------------------------------
    lista_embeddings = []
    lista_rutas = []
    
    _imprimir_info("Extrayendo embeddings de los archivos...")
    print()
    
    for indice, ruta_audio in enumerate(archivos_wav):
        try:
            _imprimir_progreso(indice + 1, len(archivos_wav), os.path.basename(ruta_audio))
            
            # Extraer el embedding del audio actual
            embedding = extraer_embedding(ruta_audio)
            
            # Almacenar el embedding y la ruta
            lista_embeddings.append(embedding)
            lista_rutas.append(ruta_audio)
            
        except Exception as e:
            # Si hay error en un archivo, lo saltamos pero continuamos con los demás
            _imprimir_advertencia(f"Error en {os.path.basename(ruta_audio)}: {str(e)[:50]}")
            continue
    
    print()
    _imprimir_linea_separadora()
    
    # Verificar que se procesaron al menos algunos archivos
    if len(lista_embeddings) == 0:
        _imprimir_error("No se pudo extraer ningún embedding de la base de datos")
        _imprimir_separador_final()
        raise RuntimeError("Los archivos .wav no son válidos")
    
    # Convertir a arrays de numpy para eficiencia
    embeddings_matriz = np.array(lista_embeddings)
    
    # Almacenar en variables globales
    _embeddings_bd = embeddings_matriz
    _rutas_archivos_bd = lista_rutas
    
    _imprimir_exito(f"Embeddings extraídos: {embeddings_matriz.shape[0]} archivos × {embeddings_matriz.shape[1]} dimensiones")
    _imprimir_linea_separadora()
    
    # -----------------------------------------------------------------------------
    # Entrenar el indexador KNN
    _imprimir_info("Entrenando buscador KNN...")
    
    _indexador_knn = NearestNeighbors(
        n_neighbors=1,
        metric='cosine',
        algorithm='brute'
    )
    
    # Entrenar el indexador con los embeddings de la base de datos
    _indexador_knn.fit(embeddings_matriz)
    
    _imprimir_exito("Buscador KNN entrenado exitosamente")
    _imprimir_separador_final()


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
        _imprimir_error("La base de datos no ha sido inicializada")
        raise RuntimeError("Debe llamar a inicializar_base_datos() primero.")
    
    # Verificar que el archivo del usuario existe
    if not os.path.exists(ruta_audio_usuario):
        _imprimir_error(f"No se encontró el archivo: {ruta_audio_usuario}")
        raise FileNotFoundError(f"No se encontró el archivo del usuario: {ruta_audio_usuario}")
    
    _imprimir_encabezado("BÚSQUEDA DE SONIDO SIMILAR")
    _imprimir_info(f"Audio a procesar: {os.path.basename(ruta_audio_usuario)}")
    _imprimir_linea_separadora()
    
    try:
        # -----------------------------------------------------------------------------
        # Paso 1: Extraer embedding del audio del usuario
        # -----------------------------------------------------------------------------
        _imprimir_info("Extrayendo embedding del audio...")
        embedding_usuario = extraer_embedding(ruta_audio_usuario)
        _imprimir_exito(f"Embedding calculado: {embedding_usuario.shape}")
        
        # -----------------------------------------------------------------------------
        # Paso 2: Buscar el vecino más cercano en la base de datos
        # -----------------------------------------------------------------------------
        _imprimir_info("Buscando el sonido más similar...")
        
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
        _imprimir_linea_separadora()
        print("\n  ╔════════════════════════════════════════════════════════════════════════════════╗")
        print("  ║                        🎵 RESULTADO ENCONTRADO                              ║")
        print("  ╚════════════════════════════════════════════════════════════════════════════════╝")
        print(f"  📁 Archivo: {os.path.basename(ruta_ganadora)}")
        print(f"  📍 Ruta: {ruta_ganadora}")
        print(f"  📊 Similitud: {(1 - distancia) * 100:.2f}% (distancia: {distancia:.6f})")
        print("  ╚════════════════════════════════════════════════════════════════════════════════╝\n")
        _imprimir_separador_final()
        
        return ruta_ganadora
        
    except Exception as e:
        _imprimir_error(f"Error durante la búsqueda: {str(e)}")
        _imprimir_separador_final()
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
    (python modelo_ml.py). 
    
    Uso típico:
        $ python modelo_ml.py
    ==============================================================================
    """
    _imprimir_encabezado("MÓDULO DE BÚSQUEDA DE SONIDOS POR IMITACIÓN VOCAL")
    
    try:
        # Paso 1: Inicializar el modelo CLAP
        inicializar_modelo()
        
        # Paso 2: Inicializar la base de datos (procesar todos los audios)
        inicializar_base_datos()
        
        # Ejemplo de cómo usar la función de búsqueda
        # (Descomenta las siguientes líneas para probar con un audio real)
        ruta_audio_ejemplo = "mi_imitacion.wav"
        if os.path.exists(ruta_audio_ejemplo):
            resultado = encontrar_mejor_sample(ruta_audio_ejemplo)
            _imprimir_exito(f"Resultado final: {resultado}")
        
        _imprimir_linea_separadora()
        _imprimir_exito("Módulo listo para usar")
        _imprimir_info("Para buscar un sonido, llama a encontrar_mejor_sample(ruta_audio)")
        _imprimir_separador_final()
        
    except Exception as e:
        _imprimir_error(f"Error durante la inicialización: {str(e)}")
        raise