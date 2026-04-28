# 🎵 Módulo de Machine Learning - Voice2Signal

**Búsqueda de sonidos por imitación vocal utilizando embeddings semánticos**

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Requisitos Técnicos](#requisitos-técnicos)
3. [Instalación](#instalación)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Flujo de Ejecución](#flujo-de-ejecución)
6. [Funciones del Módulo](#funciones-del-módulo)
7. [Cómo Usar](#cómo-usar)
8. [Arquitectura Técnica](#arquitectura-técnica)
9. [Ejemplo Completo](#ejemplo-completo)
10. [Solución de Problemas](#solución-de-problemas)

---

## 🎯 Descripción General

### ¿Qué es este módulo?

Este módulo implementa un **motor de búsqueda de audio inteligente** basado en inteligencia artificial. Permite encontrar sonidos similares en una base de datos comparando sus **representaciones matemáticas** (embeddings).

### ¿Cómo funciona?

```
Audio del usuario → Extraer representación matemática → Comparar con base de datos → Encontrar más similar
```

### Tecnologías utilizadas

| Tecnología | Propósito |
|-----------|-----------|
| **CLAP (Hugging Face)** | Extraer embeddings de audio |
| **Librosa** | Cargar y procesar archivos de audio |
| **scikit-learn KNN** | Buscar el vecino más cercano |
| **PyTorch** | Inferencia del modelo de IA |
| **NumPy** | Operaciones matemáticas |

---

## 🔧 Requisitos Técnicos

### Python
- **Versión:** 3.8 o superior
- **Gestor de paquetes:** pip

### Dependencias (en `requeriments.txt`)
```
torch
librosa
transformers
scikit-learn
numpy
scipy
```

### Requisitos del Sistema
- **RAM:** Mínimo 8 GB (recomendado 16 GB)
- **GPU:** Opcional (NVIDIA con CUDA para mayor velocidad)
- **Espacio en disco:** ~3 GB para descargar el modelo

---

## 📦 Instalación

### Paso 1: Instalar dependencias

```bash
pip install -r requeriments.txt
```

### Paso 2: Crear carpeta de base de datos

```bash
mkdir "base_datos_audios"
```

### Paso 3: Agregar archivos de audio

Coloca tus archivos `.wav` en la carpeta `base_datos_audios/`:

```
Machine Learning/
├── modelo_ml.py
├── base_datos_audios/
│   ├── sonido_1.wav
│   ├── sonido_2.wav
│   ├── sonido_3.wav
│   └── ... más audios
```

---

## 🗂️ Estructura del Proyecto

```
Machine Learning/
│
├── modelo_ml.py              ← Módulo principal
├── README.md                 ← Este archivo
├── base_datos_audios/        ← Carpeta con audios (crear manualmente)
│   ├── sonido_1.wav
│   ├── sonido_2.wav
│   └── ...
│
└── requeriments.txt          ← Dependencias del proyecto
```

---

## 🔄 Flujo de Ejecución

### Flujo General (Vista Alta)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Inicializar Modelo CLAP                              │
│    - Descargar modelo de Hugging Face                   │
│    - Cargar en memoria (GPU/CPU)                        │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Inicializar Base de Datos                            │
│    - Buscar archivos .wav                               │
│    - Extraer embeddings de cada uno                     │
│    - Entrenar buscador KNN                              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Buscar Audio Similar                                 │
│    - Recibir audio del usuario                          │
│    - Extraer embedding del usuario                      │
│    - Buscar vecino más cercano                          │
│    - Devolver resultado                                 │
└─────────────────────────────────────────────────────────┘
```

### Flujo Detallado: Extraer Embedding

```
Audio .wav
    ↓
┌────────────────────────────────────────┐
│ Cargar con librosa                     │
│ - Lee el archivo                       │
│ - Resamplea a 48000 Hz                 │
│ - Convierte a mono                     │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ Procesar con ClapProcessor             │
│ - Tokeniza el audio                    │
│ - Prepara tensores PyTorch             │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ Pasar por modelo CLAP                  │
│ - Sin calcular gradientes (rápido)     │
│ - Obtiene embedding de 512 dimensiones │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ Procesar embedding                     │
│ - Convertir a numpy                    │
│ - Normalizar (L2)                      │
│ - Aplanar a 1D                         │
└────────────────────────────────────────┘
    ↓
Embedding normalizado [512 números]
```

### Flujo Detallado: Búsqueda KNN

```
Embedding del usuario [512 números]
    ↓
┌────────────────────────────────────────┐
│ Base de datos de embeddings:           │
│ - Audio 1: [512 números]               │
│ - Audio 2: [512 números]               │
│ - Audio 3: [512 números]               │
│ - ... N audios                         │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ Calcular similitud COSENO              │
│ - Comparar usuario vs Audio 1          │
│ - Comparar usuario vs Audio 2          │
│ - Comparar usuario vs Audio 3          │
│ - ... vs todos                         │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ Encontrar MÍNIMO (más similar)         │
│ - Audio 2: 0.15 ← GANADOR              │
│ - Audio 1: 0.45                        │
│ - Audio 3: 0.68                        │
└────────────────────────────────────────┘
    ↓
Devolver: ruta/a/audio_2.wav
```

---

## 🔧 Funciones del Módulo

### 1️⃣ `inicializar_modelo()`

**Propósito:** Cargar el modelo CLAP en memoria

**Parámetros:** Ninguno

**Retorna:** None

**Acciones:**
- Descarga modelo `laion/clap-htsat-fused` de Hugging Face
- Carga procesador de audio
- Configura para inferencia
- Detecta GPU/CPU automáticamente

**Debe llamarse:** **PRIMERO** (antes que cualquier otra función)

**Ejemplo:**
```python
inicializar_modelo()
# ✓ Modelo cargado exitosamente en: GPU
```

---

### 2️⃣ `extraer_embedding(ruta_audio)`

**Propósito:** Obtener el embedding de un archivo de audio

**Parámetros:**
- `ruta_audio` (str): Ruta al archivo .wav

**Retorna:** 
- numpy.ndarray: Vector de 512 números normalizados

**Proceso interno:**
1. Carga audio con librosa a 48000 Hz
2. Procesa con ClapProcessor
3. Pasa por modelo CLAP
4. Normaliza el embedding

**Ejemplo:**
```python
embedding = extraer_embedding("mi_audio.wav")
print(embedding.shape)  # (512,)
print(embedding)        # [0.123, -0.456, 0.789, ...]
```

---

### 3️⃣ `inicializar_base_datos()`

**Propósito:** Procesar todos los audios y entrenar el buscador

**Parámetros:** Ninguno

**Retorna:** None

**Acciones:**
1. Busca todos los .wav en `base_datos_audios/`
2. Extrae embedding de cada uno
3. Entrena KNN con los embeddings
4. Almacena rutas en memoria

**Debe llamarse:** **SEGUNDO** (después de inicializar_modelo)

**Ejemplo:**
```python
inicializar_base_datos()
# ✓ Se encontraron 150 archivos
# ✓ Se procesaron 150 archivos
# ✓ Buscador entrenado
```

---

### 4️⃣ `encontrar_mejor_sample(ruta_audio_usuario)` ⭐

**Propósito:** FUNCIÓN PRINCIPAL - Buscar el audio más similar

**Parámetros:**
- `ruta_audio_usuario` (str): Ruta al audio del usuario

**Retorna:** 
- str: Ruta del archivo .wav ganador

**Proceso:**
1. Extrae embedding del audio del usuario
2. Busca el vecino más cercano en KNN
3. Devuelve la ruta del mejor match

**Ejemplo:**
```python
resultado = encontrar_mejor_sample("mi_imitacion.wav")
print(resultado)
# Machine Learning/base_datos_audios/sonido_22.wav
```

---

## 📖 Cómo Usar

### Uso Básico (3 líneas)

```python
import modelo_ml

modelo_ml.inicializar_modelo()        # Paso 1: Cargar modelo
modelo_ml.inicializar_base_datos()    # Paso 2: Cargar base de datos
resultado = modelo_ml.encontrar_mejor_sample("mi_audio.wav")  # Paso 3: Buscar
print(f"Mejor match: {resultado}")
```

### Uso Completo (con manejo de errores)

```python
import modelo_ml
import os

def buscar_sonido_similar(ruta_audio):
    """Busca un sonido similar en la base de datos."""
    
    try:
        # Verificar que el archivo existe
        if not os.path.exists(ruta_audio):
            print(f"ERROR: No existe {ruta_audio}")
            return None
        
        # Inicializar (solo necesario una vez)
        print("Inicializando...")
        modelo_ml.inicializar_modelo()
        modelo_ml.inicializar_base_datos()
        
        # Buscar
        print(f"\nBuscando audio similar a: {ruta_audio}")
        resultado = modelo_ml.encontrar_mejor_sample(ruta_audio)
        
        return resultado
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return None

# Usar
if __name__ == "__main__":
    resultado = buscar_sonido_similar("mi_imitacion.wav")
    if resultado:
        print(f"\n✓ Encontrado: {resultado}")
```

### Uso desde otro módulo

```python
# archivo: interfaz.py
from Machine_Learning import modelo_ml

# Inicializar una sola vez al iniciar la aplicación
def iniciar_aplicacion():
    modelo_ml.inicializar_modelo()
    modelo_ml.inicializar_base_datos()

# Usar cuando el usuario busca
def procesar_busqueda(audio_usuario):
    return modelo_ml.encontrar_mejor_sample(audio_usuario)
```

---

## 🏗️ Arquitectura Técnica

### Componentes del Sistema

```
┌──────────────────────────────────────────────────────────┐
│                  MÓDULO modelo_ml.py                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ MODELO CLAP (Red Neuronal)                          │ │
│  │ - 512 dimensiones de salida                         │ │
│  │ - Entrenado en AudioSet                             │ │
│  │ - Genera embeddings semánticos                      │ │
│  └─────────────────────────────────────────────────────┘ │
│                         ↕                                │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ALMACENAMIENTO DE EMBEDDINGS                        │ │
│  │ - Matriz (N, 512) donde N = número de audios       │ │
│  │ - Almacenado en RAM durante ejecución              │ │
│  └─────────────────────────────────────────────────────┘ │
│                         ↕                                │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ÍNDICE KNN (k-Nearest Neighbors)                   │ │
│  │ - Métrica: Similitud Coseno                        │ │
│  │ - Algoritmo: Brute Force (exacto)                  │ │
│  │ - Busca el embedding más similar                   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Variables Globales

| Variable | Tipo | Contenido |
|----------|------|----------|
| `_modelo_clap` | ClapModel | Red neuronal CLAP cargada |
| `_procesador_clap` | ClapProcessor | Procesador de audio |
| `_indexador_knn` | NearestNeighbors | Índice de búsqueda |
| `_rutas_archivos_bd` | list | Rutas de audios |
| `_embeddings_bd` | numpy.ndarray | Matriz (N, 512) de embeddings |

### Parámetros de Configuración

```python
# Modelo
MODELO = "laion/clap-htsat-fused"
FRECUENCIA_MUESTREO = 48000  # Hz
DIMENSIONES_EMBEDDING = 512

# KNN
N_NEIGHBORS = 1              # Buscar 1 vecino (el más similar)
METRICA = 'cosine'          # Similitud coseno
ALGORITMO = 'brute'         # Búsqueda exacta (no aproximada)

# Base de datos
RUTA_BASE_DATOS = "base_datos_audios/"
EXTENSION_AUDIO = "*.wav"
```

---

## 💡 Ejemplo Completo

### Escenario: Usuario graba una imitación vocal

```python
import modelo_ml

# ═══════════════════════════════════════════════════════════
# INICIO: Usuario abre la aplicación
# ═══════════════════════════════════════════════════════════

print("Iniciando Voice2Signal...")

# Paso 1: Cargar modelo (una sola vez)
print("\n[1/4] Cargando modelo IA...")
modelo_ml.inicializar_modelo()
# → Descarga ~500 MB del modelo CLAP
# → Carga en GPU (si disponible)

# Paso 2: Cargar base de datos (una sola vez)
print("\n[2/4] Cargando base de datos...")
modelo_ml.inicializar_base_datos()
# → Busca 150 archivos .wav
# → Extrae embeddings (150 × 512)
# → Entrena KNN

# ═══════════════════════════════════════════════════════════
# DURANTE USO: Usuario graba imitación vocal
# ═══════════════════════════════════════════════════════════

print("\n[3/4] Usuario graba imitación: 'miau'")
# → La aplicación graba audio en: temp_grabacion.wav

# Paso 3: Buscar sonido similar
print("\n[4/4] Buscando sonido similar...")
resultado = modelo_ml.encontrar_mejor_sample("temp_grabacion.wav")

# ═══════════════════════════════════════════════════════════
# SALIDA: Resultado
# ═══════════════════════════════════════════════════════════

print(f"\n✓ RESULTADO: {resultado}")
# ✓ RESULTADO: base_datos_audios/gato_miando_1.wav

# Internamente, ¿qué pasó?
# 1. Cargó temp_grabacion.wav
# 2. Resampleó a 48000 Hz
# 3. Pasó por modelo CLAP → embedding [512 números]
# 4. Comparó con todos los 150 audios
# 5. Encontró que gato_miando_1.wav es el más similar
# 6. Devolvió su ruta
```

---

## 🆘 Solución de Problemas

### Problema 1: "El modelo no está inicializado"

**Síntoma:**
```
RuntimeError: El modelo no está inicializado.
```

**Solución:**
```python
modelo_ml.inicializar_modelo()  # Agregar esta línea PRIMERO
modelo_ml.inicializar_base_datos()
resultado = modelo_ml.encontrar_mejor_sample("audio.wav")
```

---

### Problema 2: "No se encontraron archivos .wav"

**Síntoma:**
```
ADVERTENCIA: No se encontraron archivos .wav
```

**Solución:**
1. Verifica que la carpeta `base_datos_audios/` existe
2. Verifica que contiene archivos `.wav`
3. Verifica los nombres: `imagen.wav` ✓, `imagen.mp3` ✗

```bash
# Linux/Mac
ls -la base_datos_audios/

# Windows PowerShell
dir base_datos_audios\
```

---

### Problema 3: "No hay espacio en disco"

**Síntoma:**
```
ERROR: No hay espacio suficiente
```

**Solución:**
- El modelo CLAP ocupa ~500 MB
- Descarga datos una sola vez
- Se almacena en: `~/.cache/huggingface/`

```bash
# Ver espacio disponible
df -h

# Liberar espacio (borrar caché)
rm -rf ~/.cache/huggingface/
```

---

### Problema 4: "Lento. ¿Cómo acelerar?"

**Soluciones:**
| Problema | Solución |
|----------|----------|
| Usa CPU en lugar de GPU | Instala CUDA: `pip install torch-cu11` |
| Base de datos muy grande | Reduce cantidad de audios o usa GPU |
| Primera vez es lenta | Normal, descarga modelo (~5 min) |

---

## 📊 Rendimiento Esperado

| Operación | Tiempo | Notas |
|-----------|--------|-------|
| Cargar modelo | 2-5 min | Solo la primera vez |
| Cargar BD (100 audios) | 5-10 min | Depende de duración audios |
| Buscar un audio | 2-5 seg | Constante, no depende de BD |

---

## 🔬 Conceptos Técnicos

### ¿Qué es un Embedding?

Un **embedding** es una representación matemática de un objeto (en este caso, un audio) convertida en un vector de números.

```
Audio "miau" → [0.12, -0.45, 0.89, 0.01, -0.23, ...]
                    ↑ Embedding de 512 dimensiones
```

### ¿Por qué Cosine Similarity?

Mide el ángulo entre dos vectores (embeddings):
- **Distancia 0.0** = Audios idénticos
- **Distancia 0.5** = Audios similares
- **Distancia 1.0** = Audios diferentes

```
Audio usuario:      [0.1, 0.2, 0.3, ...]
Audio BD 1:         [0.11, 0.21, 0.31, ...]  → Distancia: 0.02 ✓ MUY SIMILAR
Audio BD 2:         [0.5, 0.6, 0.7, ...]     → Distancia: 0.85 ✗ MUY DIFERENTE
```

### ¿Cómo funciona KNN?

**KNN = K-Nearest Neighbors** (K Vecinos Más Cercanos)

1. Tienes N embeddings en la base de datos
2. Comparas el embedding del usuario con TODOS los N
3. Ordenas por similitud (menor distancia = más similar)
4. Devuelves el top-K más similares (en nuestro caso K=1)

---

## 📝 Resumen Rápido

```
┌─────────────────────────────────────┐
│ INICIO                              │
│ python modelo_ml.py                 │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ inicializar_modelo()                │
│ - Carga CLAP                        │
│ - Detecta GPU/CPU                   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ inicializar_base_datos()            │
│ - Busca audios                      │
│ - Extrae embeddings                 │
│ - Entrena KNN                       │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ encontrar_mejor_sample(audio)       │
│ - Busca sonido similar              │
│ - Devuelve ruta del mejor match     │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ FIN                                 │
│ Resultado: ruta/audio/similar.wav   │
└─────────────────────────────────────┘
```

---

## 📞 Soporte

Para más información sobre:
- **CLAP Model:** https://huggingface.co/laion/clap-htsat-fused
- **scikit-learn KNN:** https://scikit-learn.org/stable/modules/neighbors.html
- **Librosa:** https://librosa.org/

---

**Documento versión:** 1.0  
**Última actualización:** Abril 2026  
**Autor:** Equipo de Machine Learning
