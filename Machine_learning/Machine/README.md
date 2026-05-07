# Voice2Sample — Motor de Búsqueda por Similitud de Audio

## 📋 Descripción General

**`modelo.py`** implementa un motor de búsqueda por similitud de audio basado en descriptores extraídos con **Essentia**. El sistema utiliza **tres "cerebros" independientes** (timbre, ritmo y melodía) con modelos **KNN separados** para cada categoría, permitiendo búsquedas flexibles filtradas por aspecto musical.

### Caso de Uso Principal
Dado un audio de entrada (query), encontrar los audios más similares en una base de datos indexada, con opción de filtrar por:
- **Timbre**: similitud de la calidad sonora (MFCC, GFCC, centroide espectral, etc.)
- **Ritmo**: similitud de la estructura temporal (BPM, confianza de pulso, intervalos de beat)
- **Melodía**: similitud del perfil melódico (pitch, HPCP, fuerza armónica)
- **Todos**: combinación equilibrada de las tres dimensiones

---

## 🏗️ Arquitectura

### Estructura de los "Tres Cerebros"

```
┌─────────────────────────────────────────────────────────┐
│           BaselineSearchEngine                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  TIMBRE BRAIN                RHYTHM BRAIN               │
│  ─────────────────           ──────────────             │
│  • StandardScaler            • StandardScaler           │
│  • KNN (cosine)              • KNN (cosine)             │
│  • Matrix: (N, D_timbre)     • Matrix: (N, D_rhythm)    │
│                                                          │
│  Features:                   Features:                  │
│  - MFCC (13 coefs)           - BPM                      │
│  - GFCC (13 coefs)           - Beat confidence          │
│  - Spectral Centroid         - Beat intervals           │
│  - Spectral Spread           - (mean + stdev)           │
│  - Spectral Rolloff                                     │
│  - Spectral Flux             MELODY BRAIN               │
│  - Zero Crossing Rate        ─────────────             │
│  - (mean + stdev for all)     • StandardScaler         │
│                               • KNN (cosine)            │
│                               • Matrix: (N, D_melody)   │
│                                                          │
│                               Features:                 │
│                               - Pitch                   │
│                               - Pitch confidence        │
│                               - HPCP (12 bins)          │
│                               - Key strength            │
│                               - (mean + stdev)          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Flujo de Procesamiento

#### 1. **Indexación** (`construir_indice`)
```
Base de datos (JSON por audio)
    ↓
Extrae features de cada audio (timbre, ritmo, melodía)
    ↓
Crea 3 matrices separadas X_timbre, X_ritmo, X_melodia
    ↓
Normaliza cada matriz con StandardScaler individual
    ↓
Entrena 3 KNN independientes + 1 KNN combinado
    ↓
Persiste escalers, modelos e índice a disco
```

#### 2. **Búsqueda** (`buscar_audio_similar`)
```
Query (audio nuevo)
    ↓
Extrae features (timbre, ritmo, melodía)
    ↓
Elige el KNN según filtro (timbre/ritmo/melodía/todos)
    ↓
Normaliza query con el scaler correspondiente
    ↓
Busca k-vecinos más cercanos
    ↓
Devuelve ranking con distancias y similitudes
```

---

## 📊 Características de Entrada

### Formato de Base de Datos
El sistema espera **un archivo único consolidado** (CSV o JSON) con una fila por audio y columnas para cada descriptor de Essentia:

```csv
audio_id, mfcc_mean_0, mfcc_mean_1, ..., gfcc_std_0, ..., bpm, beat_confidence, pitch_mean, key_strength, ...
audio_001, -580.5, 35.2, ..., 2.1, ..., 106.0, 0.85, 220.5, 0.92, ...
audio_002, -590.2, 38.1, ..., 2.3, ..., 120.0, 0.78, 225.0, 0.88, ...
...
```

### Categorización de Features

| **Categoría** | **Descriptores** | **Extracción** | **Reducción** |
|---|---|---|---|
| **TIMBRE** | MFCC, GFCC, Spectral Centroid, Spread, Rolloff, Flux, Zero Crossing Rate | Por frame | Media + Stdev |
| **RITMO** | BPM, Beat Confidence, Beat Intervals | Global | Valores + distribución de intervalos |
| **MELODÍA** | Pitch, Pitch Confidence, HPCP, Key Strength | Por frame / global | Media + Stdev |

---

## 🚀 Uso

### Instalación

```bash
# Clonar el repositorio
cd Voice2Signal/Machine_learning/Machine/

# Instalar dependencias
pip install -r requirements.txt
```

### API Programática

#### **Creación del Motor (Primera Vez)**

```python
from modelo import BaselineSearchEngine

# Crear instancia
motor = BaselineSearchEngine(n_vecinos=5, metrica="cosine")

# Indexar base de datos desde archivo consolidado
# (ruta a CSV o JSON con descriptores de todos los audios)
motor.construir_indice(
    archivo_bd="datos/descriptores_consolidados.csv",
    columnas_timbre=["mfcc_mean_*", "gfcc_mean_*", "spectral_centroid_mean"],
    columnas_ritmo=["bpm", "beat_confidence"],
    columnas_melodia=["pitch_mean", "key_strength"]
)

# Guardar modelo para reutilización
motor.guardar_modelo("modelos/")

# Ver estado
motor.info()
```

#### **Búsqueda**

```python
# Buscar audios similares (todos los aspectos)
resultados = motor.buscar_audio_similar(
    entrada="descriptores_query.csv",  # Audio a buscar
    n_resultados=5
)
print(resultados)
# Output:
#    rank audio_id   ruta_audio  distancia  similitud
# 0     1 audio_042 data/042.wav      0.213      0.787
# 1     2 audio_128 data/128.wav      0.402      0.598
# ...

# Filtro por categoría: solo timbre
resultados_timbre = motor.buscar_audio_similar(
    entrada="descriptores_query.csv",
    filtro_categoria="timbre",
    n_resultados=3
)

# Filtro por ritmo
resultados_ritmo = motor.buscar_audio_similar(
    entrada="descriptores_query.csv",
    filtro_categoria="ritmo"
)

# Obtener solo la ruta del ganador
ruta_ganador = motor.audio_ganador(
    entrada="descriptores_query.csv",
    filtro_categoria="todos"
)
```

#### **Cargar Modelo Pre-entrenado**

```python
from modelo import BaselineSearchEngine

motor = BaselineSearchEngine()
motor.cargar_modelo("modelos/")  # Carga scalers y KNNs
motor.info()

# Ya listo para buscar
resultados = motor.buscar_audio_similar("query.csv")
```

### Interfaz de Línea de Comandos

#### **Indexar Base de Datos**
```bash
python modelo.py indexar \
    --bd datos/descriptores/ \
    --salida modelos/ \
    --k 5
```

**Argumentos:**
- `--bd`: Directorio raíz con subdirectorios de descriptores de Essentia
- `--salida`: Dónde guardar el modelo (default: `modelos/`)
- `--k`: Número de vecinos a devolver (default: 5)

#### **Buscar Audios Similares**
```bash
python modelo.py buscar \
    --modelos modelos/ \
    --query descriptores_query/ \
    --filtro timbre \
    --k 5
```

**Argumentos:**
- `--modelos`: Directorio con el modelo guardado
- `--query`: Directorio con los descriptores de la query
- `--filtro`: `todos`, `timbre`, `ritmo`, o `melodia` (default: `todos`)
- `--k`: Número de resultados (default: 5)

**Ejemplo:**
```bash
python modelo.py buscar \
    --modelos ./modelos/ \
    --query ./descriptores_query/ \
    --filtro ritmo \
    --k 10
```

---

## 📁 Estructura de Archivos

### Entrada: Descriptores de Essentia

```
datos/
├── timbre_descriptors.json          # {audio_id: {...mfcc, gfcc, spectral...}}
├── rhythmic_descriptors.json        # {audio_id: {...bpm, beat_confidence...}}
├── melodic_descriptors.json         # {audio_id: {...pitch, hpcp, key...}}
└── music_descriptors.json           # Descriptores de nivel bajo (lowlevel.*)
```

### Salida: Modelo Persistido

```
modelos/
├── baseline_scaler_timbre.joblib    # StandardScaler para timbre
├── baseline_scaler_ritmo.joblib     # StandardScaler para ritmo
├── baseline_scaler_melodia.joblib   # StandardScaler para melodía
├── baseline_knn_timbre.joblib       # KNN entrenado en timbre
├── baseline_knn_ritmo.joblib        # KNN entrenado en ritmo
├── baseline_knn_melodia.joblib      # KNN entrenado en melodía
├── baseline_knn_combinado.joblib    # KNN entrenado en concatenación
└── baseline_index.csv               # Tabla: audio_id → ruta_audio
```

---

## 🔧 Configuración Avanzada

### Métrica de Distancia: ¿Por qué Similitud Coseno?

**Decisión:** Se usa `metric='cosine'` en lugar de Euclidiana.

**Justificación:**
- Los MFCC tienen magnitudes muy variables según duración y nivel de grabación
- La similitud coseno mide el **ángulo** entre vectores (la "forma" del espectro), no la magnitud absoluta
- En Query by Vocal Imitation, la amplitud es distinta (voz grabada vs. micrófono), pero el perfil espectral debe ser similar
- La normalización `StandardScaler` ya maneja diferencias de escala dentro de cada categoría

### Dimensionality

- **Timbre**: Típicamente 100-200 dimensiones (MFCC + GFCC + descriptores espectrales, reducidos a media+stdev)
- **Ritmo**: ~5-10 dimensiones (BPM, confianza, estadísticas de intervalos)
- **Melodía**: ~50-100 dimensiones (Pitch, HPCP×12, estadísticas)

---

## 📝 Ejemplo Completo: De 0 a 100

```python
from modelo import BaselineSearchEngine, crear_motor_desde_modelo
import pandas as pd

# ============ PASO 1: INDEXACIÓN ==============

print("1️⃣ Creando motor de búsqueda...")
motor = BaselineSearchEngine(n_vecinos=5, metrica="cosine")

print("2️⃣ Indexando base de datos...")
motor.construir_indice("datos/descriptores_bd/")

print("3️⃣ Guardando modelo...")
motor.guardar_modelo("modelos/")

print("4️⃣ Mostrando estado...")
motor.info()
# Output:
# ========================================================
#   Voice2Sample — Baseline Search Engine
# ========================================================
#   Estado:          ✅ Entrenado
#   Audios en BD:    1247
#   Dim. timbre:     156
#   Dim. ritmo:      8
#   Dim. melodia:    92
#   Métrica:         cosine
#   K vecinos:       5
# ========================================================

# ============ PASO 2: BÚSQUEDA ==============

print("\n5️⃣ Cargando modelo (en producción)...")
motor_prod = BaselineSearchEngine()
motor_prod.cargar_modelo("modelos/")

print("6️⃣ Buscando audios similares en timbre...")
resultados = motor_prod.buscar_audio_similar(
    entrada="descriptores_query/",
    filtro_categoria="timbre",
    n_resultados=3
)

print(resultados[["rank", "audio_id", "similitud"]])
# Output:
#    rank    audio_id  similitud
# 0     1  audio_042      0.892
# 1     2  audio_128      0.756
# 2     3  audio_567      0.743

print("\n7️⃣ Ganador (ritmo):")
ganador_ritmo = motor_prod.audio_ganador(
    entrada="descriptores_query/",
    filtro_categoria="ritmo"
)
print(f"  🎵 {ganador_ritmo}")
```

---

## 🐛 Troubleshooting

### Error: "El motor no está entrenado"
**Solución:** Llama a `construir_indice()` antes de `buscar_audio_similar()`, o carga un modelo con `cargar_modelo()`.

### Error: "Dimensión del vector no coincide"
**Causa:** La query tiene descriptores diferentes a los indexados en la BD.
**Solución:** Asegúrate de que la query se extrae con el mismo pipeline de Essentia.

### Error: "No se encontró ningún audio válido"
**Causa:** Los archivos JSON de descriptores faltan o están vacíos.
**Solución:** Verifica que existan `timbre_descriptors.json`, `rhythmic_descriptors.json` y `melodic_descriptors.json` en la carpeta especificada.

### Búsquedas lentas
**Causa:** Base de datos muy grande + algoritmo brute-force.
**Solución:** 
- Reduce el número de audios indexados
- Usa un subconjunto representativo
- Considera algoritmos más eficientes (kdtree, ball_tree) en futuras versiones

---

## 🎯 API Reference

### Clase: `BaselineSearchEngine`

#### Constructor
```python
BaselineSearchEngine(n_vecinos: int = 5, metrica: str = "cosine")
```

#### Métodos Principales

| Método | Descripción | Retorna |
|---|---|---|
| `construir_indice(directorio_bd)` | Indexa BD desde directorio de descriptores | self |
| `buscar_audio_similar(entrada, n_resultados, filtro_categoria)` | Busca audios similares | pd.DataFrame |
| `audio_ganador(entrada, filtro_categoria)` | Devuelve ruta del audio más similar | str |
| `guardar_modelo(directorio_salida)` | Persiste scalers y KNNs | None |
| `cargar_modelo(directorio_modelos)` | Carga modelo pre-entrenado | self |
| `info()` | Imprime resumen del estado | None |

#### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `entrenado` | bool | True si indexado/cargado |
| `n_audios` | int | Número de audios en BD |

---

## 📦 Dependencias

Ver `requirements.txt` para versiones exactas.

- **numpy**: Operaciones numéricas
- **pandas**: Manejo de DataFrames
- **scikit-learn**: StandardScaler, NearestNeighbors
- **joblib**: Serialización de modelos

---

## 📄 Licencia

Proyecto: Voice2Sample — Query by Vocal Imitation  
Archivo: `modelo.py` — Baseline ML Search Engine

---

## 🤝 Contribuciones

Para mejoras o correcciones, considera:
1. Implementar otras métricas de distancia (Manhattan, Minkowski)
2. Optimizar búsqueda con KD-tree o Ball-tree
3. Agregar ponderación de categorías (ej. 50% timbre, 30% ritmo, 20% melodía)
4. Integración con API REST (Flask/FastAPI)

---

**Última actualización:** Mayo 2026  
**Versión:** 1.0 (Refactorizada con 3 Cerebros Independientes)
