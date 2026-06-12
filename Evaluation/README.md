# Evaluación — Voice2Sample

Esta carpeta contiene las evaluaciones cuantitativas del sistema de recomendación. Hay tres evaluaciones independientes, cada una con su script:

| Script | Qué evalúa |
|--------|------------|
| `evaluacion_cuantitativa.py` | Comparativa **Essentia KNN vs CLAP**: calidad de recuperación, acuerdo de BPM y complementariedad entre los dos motores |
| `evaluate_essentia_query.py` | Calidad de las **queries de texto** que genera el análisis del frontend (simula `audioAnalysisService.ts`) frente a los metadatos reales del dataset |
| `test_bpm_recommendation_behavior.py` | Comportamiento del **focus BPM** del backend: ¿los resultados respetan el tempo del query? |

Los `.json` de la carpeta son salidas de ejemplo de estas evaluaciones. Las fórmulas con notación matemática completa están en `README.pdf`.

---

## 1. Comparativa Essentia KNN vs CLAP (`evaluacion_cuantitativa.py`)

### Los dos motores

- **CLAP** (`laion/clap-htsat-unfused`): búsqueda semántica. Cada audio es un embedding de 512 dimensiones; la similitud entre dos audios es la **similitud coseno** entre sus vectores.
- **Essentia KNN**: búsqueda acústica. Cada audio se describe con 1 126 descriptores (ritmo, melodía, timbre, tonalidad); la búsqueda usa distancia euclídea en espacio estandarizado, con similitud `s = 1 / (1 + distancia)`.

### Metodología

- Mismo corpus para ambos: los ~2 500 WAV de `Dataset/audio_processed/`, con descriptores y embeddings precalculados (no se reprocesa audio durante la evaluación).
- Las queries se toman del propio corpus, y se recuperan los K vecinos más similares excluyendo el propio query (K = 5 por defecto).
- **Doble pasada**: primero se calculan las similitudes de cada query contra todo el corpus (distribución completa de cada modelo); después se normalizan los top-K con esos límites globales y se calculan las métricas.

### Métricas

**Similitud media del top-K.** Promedio de las similitudes de los K resultados. ⚠️ Los rangos naturales de los dos modelos son distintos (CLAP suele dar 0.5–0.99; Essentia 0.05–0.5), así que **nunca se comparan en bruto**: antes se aplica una normalización min-max global que lleva ambos a una escala 0–100 con el mismo significado ("este resultado está en el X % superior de la distribución de su modelo").

**BPM Agreement.** Porcentaje de los K resultados cuyo BPM está a ±10 BPM del BPM del query. La tolerancia de 10 BPM es el estándar práctico en producción: por debajo de esa diferencia dos samples se sincronizan sin time-stretching perceptible. Mide utilidad real: un resultado perceptualmente similar pero a un tempo incompatible no sirve en un proyecto.

**Top-K Overlap.** Porcentaje de resultados que coinciden entre los dos modelos para el mismo query. Un overlap **bajo (< 30 %)** es deseable: significa que los modelos son complementarios (uno captura lo acústico, el otro lo semántico) y que combinarlos aporta diversidad. Un overlap alto (> 60 %) indicaría redundancia.

**Weighted Score (métrica principal).** Combina similitud normalizada y posición en el ranking, con el descuento posicional del NDCG: el peso de cada puesto es `w(rank) = 1 / log2(rank + 1)` (puesto 1 pesa 1.0, puesto 2 pesa 0.63, puesto 5 pesa 0.39). El score de un query es la media ponderada `WS = suma(similitud_normalizada × peso) / suma(pesos)`, en escala 0–100. Penaliza doblemente: por similitud baja y por colocar los buenos resultados en puestos bajos. El modelo con mayor WS medio gana en búsqueda por similitud general.

### Interpretación

El resultado más frecuente es que **CLAP gane en Weighted Score** (recupera audios perceptualmente más próximos) y **Essentia gane en BPM Agreement** (sus descriptores rítmicos explícitos garantizan compatibilidad de tempo). Ninguno es superior en absoluto: CLAP es mejor para búsqueda por atmósfera/textura y exploración creativa; Essentia para compatibilidad técnica (tempo, rango espectral, layering). Esa complementariedad es la justificación empírica del diseño híbrido de Voice2Sample, que ofrece ambos motores al usuario.

### Uso

```bash
python Evaluation/evaluacion_cuantitativa.py \
    --me-json    audio_analysis/descriptors/music_all.json \
    --models-dir audio_processing/Processing/models \
    --clap-json  Dataset/embeddings_output.json \
    --top-k      5

# Con queries concretas y exportación a JSON:
#   --query-ids 100270 101894 101895 --output-json Evaluation/resultados.json
```

| Parámetro | Obligatorio | Descripción |
|---|:---:|---|
| `--me-json` | ✅ | JSON de descriptores Essentia (`music_all.json`) |
| `--models-dir` | ✅ | Directorio con los `.joblib` del KNN |
| `--clap-json` | ✅ | JSON de embeddings CLAP |
| `--top-k` | ❌ | Resultados por query (default: 5) |
| `--query-ids` | ❌ | IDs a evaluar; si se omite, usa los 5 primeros comunes |
| `--output-json` | ❌ | Ruta para guardar los resultados |

---

## 2. Calidad de la query de texto del frontend (`evaluate_essentia_query.py`)

El frontend analiza el audio con Essentia.js y genera etiquetas y una query de texto (la tarjeta de análisis). Este script replica ese pipeline en Python (audio → descriptores → labels → query) sobre audios del dataset y mide la **coherencia** entre lo que la query dice del audio y lo que dicen sus metadatos reales (BPM anotado, tags, descripción).

```bash
python Evaluation/evaluate_essentia_query.py                  # todos los focus
python Evaluation/evaluate_essentia_query.py --focus bpm      # un focus concreto
python Evaluation/evaluate_essentia_query.py --focus all --limit 20 --output Evaluation/essentia_query_report.json
```

---

## 3. Comportamiento del focus BPM (`test_bpm_recommendation_behavior.py`)

Comprueba que la búsqueda con focus `bpm` del backend devuelve resultados rítmicamente compatibles. Selecciona audios del dataset con BPM objetivo (100, 120 y 140), lanza la recomendación y mide cuántos resultados caen dentro de ventanas de tolerancia de ±2, ±5, ±10 y ±20 BPM.

```bash
# Ejecutar desde la raíz del proyecto (importa backend.dataset_recommender)
python Evaluation/test_bpm_recommendation_behavior.py
```

---

## Referencias

- Järvelin, K., & Kekäläinen, J. (2002). *Cumulative gain-based evaluation of IR techniques*. ACM TOIS 20(4).
- Laion-AI (2022). *CLAP: Learning Audio Concepts From Natural Language Supervision*. arXiv:2206.04769.
- Bogdanov, D., et al. (2013). *Essentia: an Audio Analysis Library for MIR*. ISMIR 2013.
- Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to Information Retrieval*. Cap. 8.
