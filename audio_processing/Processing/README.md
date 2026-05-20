# Voice2Sample — Processing: Entrenamiento e Inferencia de Modelos KNN

## 📋 Descripción General

**`Processing/`** es el módulo de **entrenamiento e inferencia** que implementa un motor de búsqueda por similitud de audio basado en descriptores de **ritmo, melodía y timbre**. Utiliza **cuatro modelos KNN independientes** (uno por cada categoría y uno combinado) para permitir búsquedas flexibles y multimodales.


### Caso de Uso Principal
Dado un audio de entrada (query), encontrar los audios más similares en una base de datos indexada según:
- **Timbre**: similitud de la calidad sonora (MFCC, GFCC, centroide espectral, etc.)
- **Ritmo**: similitud de la estructura temporal (BPM, confianza de pulso, intervalos de beat)
- **Melodía**: similitud del perfil melódico (pitch, HPCP, fuerza armónica)
- **General**: combinación equilibrada de todas las dimensiones

---

## 🏗️ Arquitectura

### Estructura de los "Cuatro Modelos"

```
┌──────────────────────────────────────────────────────────────┐
│         SISTEMA DE BÚSQUEDA POR SIMILITUD                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  MODELO TIMBRE  │  │ MODELO RITMO │  │ MODELO MELODÍA   │ │
│  ├─────────────────┤  ├──────────────┤  ├──────────────────┤ │
│  │ StandardScaler  │  │ StandardScal │  │ StandardScaler   │ │
│  │ KNN (k=10)      │  │ KNN (k=10)   │  │ KNN (k=10)       │ │
│  │                 │  │              │  │                  │ │
│  │ Features:       │  │ Features:    │  │ Features:        │ │
│  │ • MFCC          │  │ • BPM        │  │ • Pitch          │ │
│  │ • GFCC          │  │ • Beat conf. │  │ • Pitch conf.    │ │
│  │ • Spectral*     │  │ • Intervals  │  │ • HPCP           │ │
│  │                 │  │ • Statistics │  │ • Key strength   │ │
│  │ Dim: 100-150    │  │ Dim: 8-15    │  │ Dim: 50-100      │ │
│  └─────────────────┘  └──────────────┘  └──────────────────┘ │
│           ↓                   ↓                    ↓           │
│           └───────────────────┼────────────────────┘           │
│                               ↓                                │
│                    ┌──────────────────────┐                    │
│                    │ MODELO COMBINADO     │                    │
│                    │ (Ritmo+Melodía+     │                    │
│                    │  Timbre concatenado) │                    │
│                    │ StandardScaler       │                    │
│                    │ KNN (k=10)           │                    │
│                    │ Dim: 200-300         │                    │
│                    └──────────────────────┘                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Flujo de Procesamiento Completo

```
FASE 1: ENTRENAMIENTO (train_models.py)
════════════════════════════════════════
Descriptores JSON                           Modelos KNN
(consolidados)                              (guardados)
      ↓                                          ↑
      │                                          │
      ├─ rhythmic_descriptors.json ──→ entrena KNN ritmo
      ├─ melodic_descriptors.json ───→ entrena KNN melodía
      ├─ timbre_descriptors.json ────→ entrena KNN timbre
      │                                          │
      └─ Concatena todas ──────────────→ entrena KNN general
                                                 ↓
                                    Guarda en: ./models/

FASE 2: INFERENCIA (inference.py)
══════════════════════════════════
Audio Query                                 Resultados
     ↓                                          ↑
     │                                          │
     ├─ feature_extractors.py (extrae features)
     │      ↓
     │  Elige modo (timbre/ritmo/melodía/general)
     │      ↓
     │  Busca en modelo KNN correspondiente
     │      ↓
     │  Retorna top-k audios similares
     │                                          ↑
     └──────────────────────────────────────────┘
```

---

## 📂 Estructura de Archivos y Directorios

### Entrada: Descriptores JSON Consolidados

```
descriptors/
├── rhythmic_descriptors.json      # {audio_id: {bpm, beat_conf, ...}}
├── melodic_descriptors.json       # {audio_id: {pitch, hpcp, ...}}
├── timbre_descriptors.json        # {audio_id: {mfcc, gfcc, spectral...}}
└── music_all.json                 # Descriptores Essentia pre-calculados
```

**Formato esperado** (ejemplo):
```json
{
  "kick_001": {
    "bpm": 120.5,
    "beat_confidence": 0.92,
    "beat_intervals_mean": 0.5,
    "beat_intervals_std": 0.02
  },
  "snare_002": {
    "bpm": 120.3,
    "beat_confidence": 0.88,
    ...
  }
}
```

### Salida: Modelos Entrenados

```
models/
├── knn_ritmo.joblib               # Modelo KNN entrenado (ritmo)
├── knn_melodia.joblib             # Modelo KNN entrenado (melodía)
├── knn_timbre.joblib              # Modelo KNN entrenado (timbre)
├── knn_general.joblib             # Modelo KNN entrenado (combinado)
├── meta_ritmo.joblib              # IDs de audios (meta)
├── meta_melodia.joblib            # IDs de audios (meta)
├── meta_timbre.joblib             # IDs de audios (meta)
├── meta_general.joblib            # IDs de audios (meta)
├── columnas_ritmo.joblib          # Nombres de features (ritmo)
├── columnas_melodia.joblib        # Nombres de features (melodía)
├── columnas_timbre.joblib         # Nombres de features (timbre)
└── columnas_general.joblib        # Nombres de features (combinado)
```

---

## 📚 Módulos Principales

### 1. **`main.py`** — Punto de Entrada Principal

**Propósito**: Orquestar el flujo completo (entrenamiento + búsqueda de prueba).

**Funcionalidades**:
- Entrena los 4 modelos KNN desde descriptores JSON consolidados
- Ejecuta una búsqueda de prueba con un audio de query
- Proporciona opciones para entrenar solo o buscar solo

**Uso**:
```bash
# Solo entrenar
python main.py --solo_entrenar

# Entrenar + buscar (default)
python main.py --audio ./sample.wav --modo timbre

# Solo buscar (modelos ya entrenados)
python main.py --solo_buscar --audio ./sample.wav --modo ritmo --top_k 5

# Ver todos los modos con el mismo audio
python main.py --solo_buscar --audio ./sample.wav --todos_los_modos
```

**Configuración por defecto**:
- Directorio de descriptores: `./descriptors`
- Directorio de salida de modelos: `./models`
- Número de vecinos: 10
- Top-K resultados: 5

---

### 2. **`train_models.py`** — Entrenamiento de Modelos KNN

**Propósito**: Entrenar modelos KNN a partir de descriptores JSON consolidados.

**Proceso**:
1. Carga descriptores desde JSON (ritmo, melodía, timbre)
2. Aplana estructuras anidadas a diccionarios planos
3. Crea matrices numéricas (N_audios × D_features)
4. Normaliza con StandardScaler
5. Entrena modelo KNN para cada categoría
6. Concatena características para modelo general
7. Guarda modelos, escalers y metadatos con joblib

**Entrada esperada** (JSON consolidado):
```json
{
  "audio_id_1": {
    "bpm": 120.0,
    "beat_confidence": [0.9, 0.85, ...],
    "nested_feature": {
      "sub_feature": 0.5
    }
  }
}
```

**Salida**:
- 4 modelos KNN (ritmo, melodía, timbre, general)
- 4 metadata (listas de IDs de audio)
- 4 columnas (listas de nombres de features)


---

### 3. **`inference.py`** — Motor de Inferencia/Búsqueda

**Propósito**: Buscar audios similares usando modelos pre-entrenados.

**Interfaces**:
1. **Función directa** (simple):
   ```python
   from inference import buscar_similar
   resultados = buscar_similar("sample.wav", modo="timbre", top_k=5)
   ```

2. **Clase BuscadorSimilitud** (eficiente para múltiples búsquedas):
   ```python
   from inference import BuscadorSimilitud
   buscador = BuscadorSimilitud(models_dir="./models")
   resultados = buscador.buscar("sample.wav", modo="ritmo", top_k=5)
   ```

**Formato de retorno**:
```python
[
  {
    "rank": 1,
    "nombre": "kick_001",
    "distancia": 0.1823,
    "similitud": 0.8177
  },
  ...
]
```

**Modos válidos**: `"ritmo"`, `"melodia"`, `"timbre"`, `"general"`

**Funciones principales**:
- `_alinear_vector(feats_dict, columnas_modelo)` → Alinea features con el modelo
- `BuscadorSimilitud.buscar(audio, modo, top_k)` → Busca audios similares
- `buscar_similar(audio, modo, top_k)` → Interfaz directa (sin caché)

---

### 4. **`feature_extractors.py`** — Extracción de Características

**Propósito**: Extraer características (features) de audios en diferentes modos.

**Punto de entrada público**:
```python
from feature_extractors import extraer_features

features = extraer_features("audio.wav", modo="timbre")
```

**Modos soportados**:
- `"ritmo"` → Características rítmicas
- `"melodia"` → Características melódicas
- `"timbre"` → Características de timbre
- `"general"` → Todas las características

**Funciones internas**:
- `_extraer_ritmo(audio)` → extrae descriptores rítmicos
- `_extraer_melodia(audio)` → extrae descriptores melódicos
- `_extraer_timbre(audio)` → extrae descriptores de timbre
- `_extraer_general(audio)` → combina ritmo + melodía + timbre


**Validaciones**:
- ✅ Verifica que el archivo existe
- ✅ Valida que el modo es válido
- ✅ Detecta audios inválidos

---

## 🚀 Guía de Instalación Completa

### Requisitos Previos

1. **Python 3.8 o superior** instalado en tu sistema
2. **Git** (para clonar el repositorio)
3. **Descriptores JSON consolidados** en `./descriptors/`:
   - `rhythmic_descriptors.json`
   - `melodic_descriptors.json`
   - `timbre_descriptors.json`

### Instalación Paso a Paso

#### **Paso 0: Activar WSL **

Si estás en **Windows 10/11**, debes activar **WSL 2** (Windows Subsystem for Linux):

```powershell
# Abre PowerShell como administrador y ejecuta:
wsl --install
wsl --set-default-version 2

# Luego abre una terminal WSL:
wsl
```

Si ya tienes WSL activado, simplemente abre una terminal WSL:
```bash
wsl
```

---
 
#### **Paso 1: Crear un Entorno Virtual (Python venv)**

Es **muy recomendado** crear un entorno virtual para aislar las dependencias:

```bash
# Crear entorno virtual llamado "venv"
python3 -m venv venv

# Activar el entorno virtual
# En Linux/Mac/WSL:
source venv/bin/activate

# O en Windows PowerShell (sin WSL):
# venv\Scripts\Activate.ps1
```

---

#### **Paso 2: Navegar a la Carpeta Processing**

```bash
# Navegar a audio_processing/Processing
cd audio_processing/Processing

# Verificar que estás en el lugar correcto
ls
# Deberías ver: main.py, train_models.py, inference.py, feature_extractors.py, README.md, etc.
```

---

#### **Paso 3: Instalar Dependencias**

```bash
# Actualizar pip (recomendado)
pip install --upgrade pip

# Instalar todas las dependencias del proyecto
pip install -r requirements.txt
```

**Salida esperada**:
```
Collecting numpy>=1.21.0,<2.0
  Downloading numpy-1.24.3-cp38-cp38-linux_x86_64.whl (14.6 MB)
  ...
Successfully installed numpy-1.24.3 pandas-2.0.2 scipy-1.11.1 scikit-learn-1.3.0 joblib-1.3.1
```


---


#### **Paso 4: Entrenar Modelos**

Desde la carpeta `audio_processing/Processing` con el entorno activado:

```bash
# Solo entrenar
python3 main.py --solo_entrenar
```

**Salida esperada**:
```
── [Paso 1/2] Entrenando modelos KNN ─────────────────────────────

[1/4] knn_ritmo
  ✓ Modelo entrenado en 2.34s (1247 audios, 12 features)

[2/4] knn_melodia
  ✓ Modelo entrenado en 3.21s (1247 audios, 85 features)

[3/4] knn_timbre
  ✓ Modelo entrenado en 4.89s (1247 audios, 156 features)

[4/4] knn_general
  ✓ Modelo entrenado en 6.12s (1247 audios, 253 features)

✅ Modelos guardados en: ./models/
```

#### **Paso 5: Prueba a Buscar Audios Similares**

```bash
# Buscar por timbre
python3 main.py --solo_buscar --audio ./sample.wav --modo timbre --top_k 5
```

**Salida esperada**:
```
── [Paso 2/2] Buscando audios similares ─────────────────────────

Modo: TIMBRE
Audio query: sample.wav

   Rank  Nombre Audio     Similitud  Distancia
   ────  ──────────────  ─────────  ────────
      1  kick_042          0.892     0.108
      2  kick_128          0.756     0.244
      3  drum_567          0.743     0.257
      4  sample_001        0.721     0.279
      5  audio_902         0.698     0.302

🎯 Ganador: kick_042 (similitud: 89.2%)
```
---

## 📋 Requisitos del Sistema

### Dependencias Principales

| Paquete | Versión | Propósito |
|---------|---------|----------|
| `numpy` | ≥1.21.0 | Operaciones numéricas |
| `pandas` | ≥1.3.0 | Manipulación de datos |
| `scipy` | ≥1.7.0 | Funciones científicas |
| `scikit-learn` | ≥1.0.0 | ML: KNN, StandardScaler |
| `joblib` | ≥1.1.0 | Serialización de modelos |
| `essentia` | ≥2.1.0 | Extracción de descriptores (opcional) |

### Dependencias Opcionales

| Paquete | Propósito |
|---------|----------|
| `librosa` | Procesamiento de audio (alternativa a Essentia) |
| `soundfile` | Lectura de archivos de audio |
| `pytest` | Testing |
| `black` | Formateo de código |
| `flake8` | Linting |

### Requisitos del Sistema

- **RAM**: Mínimo 2 GB (recomendado 4+ GB para BD grandes)
- **Almacenamiento**: 
  - Descriptores JSON: 50-200 MB
  - Modelos entrenados: 100-500 MB
- **Tiempo de entrenamiento**: 
  - BD pequeña (100 audios): ~10s
  - BD mediana (1000 audios): ~30s
  - BD grande (10000+ audios): ~3-5 min


---

## 📄 Licencia

Proyecto: Voice2Sample — Query by Vocal Imitation  
Módulo: Processing (Entrenamiento e Inferencia)

---

**Última actualización**: Mayo 2026  
**Versión**: 2.0 (Refactorizado con 4 Modelos KNN Independientes)
