# API - Voice2Sample

## Descripción

Esta carpeta contiene el **backend de la aplicación Voice2Sample**, una API REST construida con **FastAPI** que proporciona:

- **Carga y recorte de archivos de audio** enviados desde el frontend
- **Dos motores de recomendación** sobre el dataset local:
  - **Acoustic Search (KNN)**: búsqueda por descriptores acústicos (ritmo, melodía, timbre o general) usando los modelos entrenados en `search_engines/acoustic_search/models/`
  - **CLAP**: búsqueda semántica por similitud coseno de embeddings (`laion/clap-htsat-unfused`, 512 dimensiones)
- **Mapa de similitud**: proyección 2D de los resultados para la visualización interactiva
- **Gestión de caché** para acelerar consultas repetidas

## Estructura de Archivos

### `app.py`
Aplicación principal de FastAPI:
- Define los endpoints de la API y la configuración CORS
- Selecciona el motor según el parámetro `model` (`acoustic` | `clap`)
- Traduce el `focus` del frontend al modo interno del KNN (`_FOCUS_TO_MODO`: general→general, melodic→melodia, bpm→ritmo, timbre→timbre)
- Reescala las similitudes del KNN a un rango legible para la UI (`_rescale_similarities`)
- Detecta automáticamente el CSV de metadatos disponible (`Dataset/metadata_filtered.csv` o `Dataset/Clean_csv/metadata.csv`) para mostrar el nombre original de Freesound, autor, licencia y tags

### `clap_recommender.py`
Motor de búsqueda semántica CLAP:
- Carga el modelo `laion/clap-htsat-unfused` (transformers + PyTorch) y la base de embeddings `Dataset/embeddings_output.json`
- Extrae el embedding del audio de consulta y rankea por **similitud coseno**
- Se inicializa en segundo plano al arrancar; si no está disponible, la API responde con el KNN
- **Importante**: `search_engines/CLAP/regenerate_clap_embeddings.py` usa este mismo módulo para regenerar la base de embeddings, garantizando que dataset y consulta usan el mismo extractor

### `dataset_recommender.py`
Utilidades de dataset y fallback:
- Carga de metadatos del dataset (nombres, tags, BPM, licencias)
- Recorte de audio (`trim_audio_file`) y utilidades de lectura
- Construcción del mapa de similitud 2D (`build_map_results`, proyección PCA)
- Ranking por descriptores propios como fallback si los modelos KNN no están disponibles

### `cache/` y `tmp/`
- `cache/dataset_features.json`: caché de características del dataset (se regenera solo)
- `tmp/`: directorio temporal para los audios subidos (se limpia tras cada petición)

Ambos están en `.gitignore`.

## Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/health` | GET | Estado de la API y tamaño del dataset cargado |
| `/api/recommendations` | POST | Devuelve hasta 10 sonidos similares. Form: `audio` (archivo), `model` (`acoustic`\|`clap`), `focus` (`general`\|`melodic`\|`bpm`\|`timbre`), `limit`, `trim_start`, `trim_end` |
| `/api/map-results` | POST | Hasta 50 vecinos con coordenadas 2D para el mapa de similitud. Form: `audio`, `focus`, `limit`, `trim_start`, `trim_end` |
| `/api/dataset-audio/{filename}` | GET | Sirve el WAV del dataset para la previsualización en el frontend |

## Requisitos

- Python 3.12 (verificado bajo WSL; Essentia y las versiones fijadas requieren Linux)
- Dependencias del `requirements.txt` **de la raíz del repositorio** (único para todo el proyecto)
- Dataset en `Dataset/audio_processed/` y modelos KNN en `search_engines/acoustic_search/models/`

## Instalación

```bash
# Desde la raíz del repositorio
pip install -r requirements.txt
```

## Uso

Ejecutar **desde la raíz del repositorio** (la app importa como paquete `backend.*`):

```bash
uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

La API estará disponible en `http://localhost:8000`. Al arrancar verás en consola si los modelos KNN y CLAP se han cargado; CLAP tarda unos segundos más (descarga el modelo de Hugging Face la primera vez).

## Integración

Esta carpeta es parte del proyecto **Voice2Sample** y se integra con:
- **Dataset/**: audios procesados (48 kHz), metadatos y embeddings CLAP
- **audio_analysis/**: extractores de descriptores usados para cada consulta
- **search_engines/**: modelos KNN entrenados y herramientas CLAP
- **frontend/**: frontend que consume esta API
