# 🎵 Módulo de Machine Learning - Voice2Signal

**Búsqueda de sonidos por imitación vocal utilizando embeddings semánticos**

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Requisitos Previos](#requisitos-técnicos)
3. [Configuración](#instalación)
4. [Flujo de Ejecución](#flujo-de-ejecución)
5. [Funciones del Módulo](#funciones-del-módulo)
6. [Arquitectura Técnica](#arquitectura-técnica)

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

## ⚙️ Requisitos Previos

Para aislar las dependencias y evitar conflictos en tu sistema, este módulo requiere:
- **Python:** Instalar la versión recomendada 3.12.x o cualquiera superior a 3.8.
- **Entorno Virtual:** Soporte para `venv` (incluido por defecto en Python).
- Aproximadamente **3 GB de espacio libre** en disco (para la descarga automática de los pesos del modelo neuronal).

---

### Dependencias (en `requeriments.txt`)
```
matplotlib
numpy
scikit-learn
torch
librosa
transformers
scipy
```

## 📦 Configuración

### Paso 1: Ponerte en la carpeta de Machine_learning
Abre la terminal integrada de VS Code (`Terminal > Nuevo Terminal`) y ejecuta:
```bash
CD Deep_learning
```

### Paso 2: Crear y Activar el Entorno Virtual
Ahora en la misma terminal pero en la carpeta Machine_learning:
```bash
1. Crear el entorno virtual
python -m venv venv

2. Activar entorno
.\venv\Scripts\Activate.ps1

Si salta error en letras rojas ejecutar primero:
    Set-ExecutionPolicy Unrestricted -Scope CurrentUser

    Volver a ejecutar .\venv\Scripts\Activate.ps1
```

### Paso 3: Instalar dependencias
```bash
pip install -r requeriments.txt
```

### Paso 4: Ejecutar el Modelo
```bash
python modelo_ml.py
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

**Documento versión:** 1.0  
**Última actualización:** Abril 2026  
**Autor:** Equipo de Machine Learning
