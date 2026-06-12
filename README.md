# Voice2Sample

Voice2Sample es una aplicación web para productores musicales: subes o grabas un audio (una voz imitando un ritmo, un loop, un sample…) y el sistema te recomienda los sonidos más parecidos de un corpus de ~2 500 samples. Ofrece dos motores de búsqueda complementarios:

- **Acoustic Search (KNN acústico)** — compara descriptores de ritmo, melodía y timbre. Ideal para compatibilidad técnica (tempo, rango espectral).
- **Búsqueda semántica (CLAP)** — compara embeddings de un modelo audio-texto. Ideal para encontrar sonidos con la misma "atmósfera".

## Estructura del repositorio

| Carpeta | Contenido |
|---------|-----------|
| `Dataset/` | Descarga del corpus, conversión de audio a WAV 48 kHz y limpieza de metadatos |
| `audio_analysis/` | Extracción de descriptores (en tiempo real para cada consulta y en batch para la base de datos) |
| `search_engines/acoustic_search/` | Motor de búsqueda acústica: entrenamiento e inferencia de los modelos KNN |
| `search_engines/CLAP/` | Motor de búsqueda semántica: generación de la base de embeddings CLAP |
| `backend/` | API FastAPI que sirve las recomendaciones y el mapa de similitud |
| `frontend/` | Interfaz web (Vite + React/TypeScript) |
| `Evaluation/` | Evaluaciones cuantitativas del sistema |
| `reports/` | Estadísticas del análisis del dataset (se generan al regenerar descriptores) |

Cada carpeta tiene su propio README con el detalle.

---

## Guía paso a paso: probarlo desde cero

### 0. Requisitos previos

- **WSL o Linux** — `essentia` solo se distribuye por pip para Linux. En Windows, instala WSL (`wsl --install`) y trabaja desde ahí. Las versiones fijadas en `requirements.txt` están verificadas con **Python 3.12** bajo WSL.
- **Node.js 18+** y npm (para la interfaz web).
- **ffmpeg** (para las conversiones de audio): `sudo apt install ffmpeg`.

### 1. Clonar el repositorio y crear el entorno de Python

```bash
git clone https://github.com/<usuario>/Voice2Sample.git
cd Voice2Sample

python -m venv .venv
source .venv/bin/activate
```

### 2. Instalar las dependencias

Hay un único `requirements.txt` para todo el proyecto:

```bash
pip install -r requirements.txt
```

### 3. Descargar el corpus de audio

Los WAV no están versionados en git (ocupan varios GB). Se descargan de Zenodo con el script incluido:

```bash
python Dataset/download_dataset/zenodo_downloader.py
```

Los archivos deben quedar en `Dataset/audio_processed/` (ver `Dataset/readme.md` si usas tu propio audio). Todo lo demás que necesita la búsqueda **sí está versionado**: los modelos KNN (`search_engines/acoustic_search/models/`), los descriptores (`audio_analysis/descriptors/`) y los embeddings CLAP (`Dataset/embeddings_output.json`). No hace falta entrenar nada.

### 4. Arrancar el backend

Desde la **raíz del repositorio**, con el entorno activado:

```bash
uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

Qué esperar:
- El primer arranque construye una caché de features del corpus (unos minutos); los siguientes arranques son rápidos.
- CLAP se carga **en segundo plano**: el backend ya responde a búsquedas de Acoustic Search, pero espera a ver `CLAP model loaded — real embedding search enabled` en el log antes de probar búsquedas CLAP.
- Comprobación rápida: abre `http://localhost:8000/api/health`.

### 5. Arrancar la interfaz web

En una **segunda terminal**:

```bash
cd frontend
npm install        # solo la primera vez
npm run dev
```

Abre `http://localhost:4173` en el navegador. Importante: `npm run dev` debe ejecutarse **dentro de `frontend/`**, no desde la raíz.

### 6. Probar una búsqueda

1. Sube un audio o graba con el micrófono.
2. Elige el motor (Acoustic Search o CLAP) y, en Acoustic Search, el focus (ritmo / melodía / timbre / general).
3. Pulsa buscar. La primera búsqueda de Acoustic Search tarda más (extracción de features); repetir con el mismo audio es casi instantáneo gracias a la caché.

### 7. (Opcional) Evaluaciones

Las tres evaluaciones cuantitativas están documentadas en `Evaluation/README.md`. La principal, la comparativa Acoustic Search (KNN) vs CLAP:

```bash
python Evaluation/evaluacion_cuantitativa.py \
    --me-json    audio_analysis/descriptors/music_all.json \
    --models-dir search_engines/acoustic_search/models \
    --clap-json  Dataset/embeddings_output.json \
    --top-k 5
```

---

## Regenerar las bases de datos de búsqueda (solo si cambia el corpus)

Los extractores de la consulta y los de la base de datos deben ser **exactamente las mismas funciones**, así que ambos scripts de regeneración reutilizan los extractores de producción:

```bash
# Descriptores + modelos KNN (reanudable; escribe los informes en reports/)
python audio_analysis/regenerate_descriptors.py --retrain

# Embeddings CLAP (reanudable)
python search_engines/CLAP/regenerate_clap_embeddings.py
```

Reinicia el backend después.

## Notas importantes

- Los modelos KNN `.joblib` se entrenaron con scikit-learn 1.9.0 (fijado en `requirements.txt`); cargarlos con otra versión puede dar resultados inconsistentes.
- El backend lee el corpus de `Dataset/audio_processed/` y los metadatos de `Dataset/Clean_csv/metadata.csv` (o `Dataset/metadata_filtered.csv` si existe); ambas rutas se configuran al inicio de `backend/app.py`.

---

Hecho por el equipo de Voice2Sample.
