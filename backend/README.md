# API - Voice2Sample

## Descripción

Esta carpeta contiene el **backend de la aplicación Voice2Sample**, una API REST construida con **FastAPI** que proporciona funcionalidades para:

- **Carga y procesamiento de archivos de audio**
- **Análisis de características de audio**
- **Búsqueda y recomendación de muestras de audio similares** basada en un dataset
- **Gestión de caché** para optimizar consultas frecuentes

## Estructura de Archivos

### `app.py`
Aplicación principal de FastAPI que define los endpoints de la API:
- Manejo de carga de archivos de audio
- Procesamiento de solicitudes
- Gestión de directorios temporales
- Respuestas HTTP estructuradas

### `dataset_recommender.py`
Módulo principal que contiene la lógica de recomendación:
- Carga de metadatos del dataset
- Extracción de características de audio
- Limpieza y normalización de nombres
- Rankeo de elementos similares basado en características de audio
- Soporte para múltiples formatos de audio (WAV, MP3, FLAC, OGG, AIFF, M4A)

### `requirements.txt`
Dependencias Python necesarias para ejecutar la API:
- **fastapi**: Framework web para construir APIs
- **uvicorn[standard]**: Servidor ASGI
- **python-multipart**: Manejo de datos multipart (para carga de archivos)
- **numpy**: Computación numérica
- **soundfile**: Lectura y escritura de archivos de audio

### `cache/`
Directorio para almacenar datos en caché:
- `dataset_features.json`: Caché de características extraídas del dataset para acelerar búsquedas

## Requisitos

- Python 3.8+
- Dependencias listadas en `requirements.txt`

## Instalación

```bash
pip install -r requirements.txt
```

## Uso

Para ejecutar la API:

```bash
uvicorn app:app --reload
```

La API estará disponible en `http://localhost:8000`

## Endpoints Principales

La API proporciona endpoints para:
- Carga de archivos de audio
- Búsqueda de muestras similares en el dataset
- Procesamiento y análisis de características de audio

## Integración

Esta carpeta es parte del proyecto **Voice2Sample** y se integra con:
- **Dataset/**: Almacena metadatos y audios procesados
- **audio_processing/**: Módulos de procesamiento de audio avanzado
- **graphic_interface_v1/**: Frontend que consume esta API

