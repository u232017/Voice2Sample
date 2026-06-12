# Evaluación Cuantitativa — Essentia KNN vs CLAP

**Voice2Sample · TFG, Ingeniería Informática**
*Metodología de evaluación para Information Retrieval Musical*

---

## Índice

1. [Introducción y Objetivo](#1-introducción-y-objetivo-de-la-evaluación)
2. [Metodología de Pruebas](#2-metodología-de-pruebas-experimental-setup)
3. [Diccionario de Métricas](#3-diccionario-de-métricas-core-metrics)
4. [Sistema de Puntuación Avanzado](#4-sistema-de-puntuación-avanzado-ranking-score)
5. [Interpretación de Resultados](#5-interpretación-de-resultados-y-casos-de-uso)
6. [Uso del Script](#6-uso-del-script)
7. [Referencias](#7-referencias)

---

## 1. Introducción y Objetivo de la Evaluación

La recuperación de información musical (*Music Information Retrieval*, MIR) plantea un reto fundamental: definir de forma computacionalmente tratable qué significa que dos audios sean *similares*. Este concepto es inherentemente multidimensional, ya que dos productores musicales pueden coincidir o discrepar según si priorizan el ritmo, el timbre, la tonalidad o la textura perceptual general.

El sistema **Voice2Sample** implementa dos estrategias de recuperación que representan filosofías radicalmente distintas:

- **CLAP** (*Contrastive Language-Audio Pretraining*) es un modelo de **búsqueda semántica latente**. A partir del modelo `laion/clap-htsat-unfused`, cada audio queda representado como un vector denso de 512 dimensiones en un espacio de embeddings aprendido mediante aprendizaje contrastivo sobre millones de pares audio-texto. La similitud entre dos audios se mide como la **similitud coseno** entre sus vectores de embedding, capturando relaciones perceptuales de alto nivel como el mood, el género o la textura tímbrica global.

- **Essentia KNN** es un modelo de **búsqueda acústica paramétrica**. Cada audio se describe mediante **1 126 descriptores acústicos** extraídos con la biblioteca Essentia (ritmo, melodía, timbre, tonalidad, dinámica). La búsqueda se realiza mediante un índice KNN con **distancia euclídea** en el espacio estandarizado. La similitud bruta se define como $s = 1/(1 + d_{\text{eucl}})$.

### Preguntas de investigación

> 1. ¿Cuál de los dos modelos produce resultados *globalmente más similares* al audio de consulta, en una escala comparable?
> 2. ¿Cuál es más preciso en la recuperación de audios con el mismo **tempo** (*BPM Agreement*)?
> 3. ¿En qué medida los dos modelos son **complementarios** (atacan el problema desde dimensiones ortogonales)?

---

## 2. Metodología de Pruebas (*Experimental Setup*)

### 2.1 Corpus de Evaluación

Ambos modelos operan sobre el **mismo corpus local** de audios preprocesados: una colección de muestras en formato WAV que constituye la base de datos de Voice2Sample. El corpus está formado por $N = 2\,502$ audios con sus correspondientes metadatos (BPM, etiquetas, etc.).

Para evitar **contaminación del test** (*data leakage*), los audios de consulta (*queries*) se seleccionan del propio corpus, lo que permite disponer de los descriptores del query ya precalculados y evaluar la capacidad de cada modelo para recuperar los vecinos más próximos de un ítem conocido.

### 2.2 Entorno de Pruebas

El entorno está diseñado para ser **reproducible, eficiente y libre de reprocesamiento** en tiempo real.

| Componente | Archivo | Descripción |
|---|---|---|
| Descriptores Essentia | `music_all.json` | `{audio_id: {feature_key: float}}` — 1 126 descriptores por audio, calculados offline por el pipeline de Essentia. |
| Modelos Essentia KNN | `knn_essentia.joblib` `meta_essentia.joblib` `columnas_essentia.joblib` | Bundle serializado con `scikit-learn`: `StandardScaler` ajustado + `NearestNeighbors` entrenado + metadatos. |
| Embeddings CLAP | `embeddings_output.json` | `{"items": [{"path": str, "embedding": [float × 512]}]}` — embeddings precalculados del corpus. Los vectores se L2-normalizan al cargarse para que el producto escalar equivalga a la similitud coseno. |

El script acepta `--me-json` y `--clap-json` como parámetros independientes para evitar colisiones entre formatos, y `--models-dir` para localizar los ficheros `.joblib`.

### 2.3 Protocolo de Evaluación Top-K y Doble Pasada

Dado un conjunto de queries $Q = \{q_1, \ldots, q_m\}$ y un parámetro $K$ (habitualmente $K = 5$), para cada modelo se recuperan los $K$ audios más similares al query (excluyendo el propio query) y se evalúan las métricas de la Sección 3.

Para garantizar que la normalización sea **global y estable**, el script realiza dos pasadas:

1. **Primera pasada** — calcula las similitudes brutas de cada query frente a *todos* los $N$ audios del dataset. Esto proporciona la distribución empírica completa de similitudes de cada modelo.
2. **Segunda pasada** — normaliza los scores top-K usando los límites globales obtenidos en la primera pasada y computa las métricas finales.

---

## 3. Diccionario de Métricas (*Core Metrics*)

### 3.1 Similitud Coseno Media

**Definición.** La similitud coseno entre dos vectores $\mathbf{u}, \mathbf{v} \in \mathbb{R}^d$ mide el coseno del ángulo que forman:

$$\text{cos\_sim}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \cdot \|\mathbf{v}\|}$$

Para vectores L2-normalizados ($\|\mathbf{u}\| = \|\mathbf{v}\| = 1$), se reduce al producto escalar: $\text{cos\_sim}(\mathbf{u}, \mathbf{v}) = \mathbf{u}^{\top}\mathbf{v}$.

**Cálculo.** La similitud media de los $K$ resultados para el query $q$ en el modelo CLAP:

$$\bar{s}_{\text{CLAP}}(q) = \frac{1}{K} \sum_{k=1}^{K} \text{cos\_sim}(\mathbf{e}_q,\, \mathbf{e}_{r_k})$$

Para Essentia KNN, la similitud bruta a partir de la distancia euclídea en espacio estandarizado:

$$s_{\text{Ess}}(q, r) = \frac{1}{1 + d_{\text{eucl}}(q, r)} \quad \Rightarrow \quad s \in (0,\, 1]$$

**Interpretación.**

| Valor | Significado |
|---|---|
| $\bar{s} \to 1$ | Los $K$ resultados son muy próximos al query en el espacio del modelo. Alta coherencia interna. |
| $\bar{s} \to 0$ | Resultados alejados del query. Baja calidad de recuperación. |

> ⚠️ **Advertencia crítica:** los rangos naturales de ambos modelos son distintos. CLAP produce valores típicamente en $[0.5,\, 0.99]$; Essentia en $[0.05,\, 0.5]$. **Un $0.4$ en CLAP no equivale a un $0.4$ en Essentia.** Por ello se aplica la Normalización Global descrita en §4.1 antes de cualquier comparación directa.

---

### 3.2 *BPM Agreement* (Tolerancia ±10 BPM)

**Definición.** Proporción de los $K$ resultados cuyo tempo se encuentra dentro de la tolerancia $\tau$ respecto al BPM del query:

$$\text{BPM\_agr}(q) = \frac{\left|\left\{r \in \text{Top-}K \;:\; |bpm_r - bpm_q| \leq \tau\right\}\right|}{K} \times 100\%$$

con $\tau = 10\,\text{BPM}$ por defecto.

**Por qué $\tau = 10\,\text{BPM}$.** En producción musical electrónica, muestras con una diferencia de tempo inferior a 10 BPM son generalmente compatibles sin *time-stretching* perceptible, o pueden sincronizarse con ajustes menores. Esta tolerancia es un estándar práctico en herramientas de gestión de samples y DJing profesional (Rekordbox, Serato).

**Relevancia en MIR.** El tempo es una de las dimensiones más críticas en la búsqueda de samples: un productor que trabaja a 140 BPM necesita muestras rítmicamente compatibles. Un modelo que devuelva audios perceptualmente similares pero a 90 BPM será **inutilizable** en contexto de producción, independientemente de su similitud tímbrica. El BPM Agreement actúa como una **métrica de utilidad práctica** más allá de la coherencia representacional interna.

Los valores de BPM se extraen del campo `rhythm.bpm` en `music_all.json`, calculado por el extractor de Essentia durante el preprocesamiento del corpus.

---

### 3.3 *Top-K Overlap* (Solapamiento entre modelos)

**Definición.** Porcentaje de resultados coincidentes entre ambos modelos para el mismo query:

$$\text{Overlap}(q) = \frac{\left|\text{Top-}K_{\text{Ess}}(q) \;\cap\; \text{Top-}K_{\text{CLAP}}(q)\right|}{\max\!\left(K_{\text{Ess}},\, K_{\text{CLAP}}\right)} \times 100\%$$

**Interpretación.**

| Overlap | Significado |
|---|---|
| **> 60 %** | Alta coincidencia. Ambos modelos consideran similares a los mismos audios. Hay coherencia entre representaciones, pero también redundancia: combinarlos aportaría poca diversidad. |
| **< 30 %** | ✅ **Resultado deseable.** Los modelos atacan el problema desde **dimensiones ortogonales**. Essentia captura características acústicas objetivas (ritmo, espectro, tonalidad); CLAP captura similitud semántica y perceptual de alto nivel. Un sistema híbrido que fusiione ambos rankings (p. ej., mediante *Reciprocal Rank Fusion*) ampliaría la diversidad de recomendaciones sin sacrificar relevancia. |

---

## 4. Sistema de Puntuación Avanzado (*Ranking Score*)

### 4.1 Normalización Global Min-Max

**El problema.** Las similitudes brutas de CLAP y Essentia habitan escalas distintas: cualquier comparación directa de sus valores numéricos carecería de rigor estadístico. Incluso dentro del mismo modelo, las distribuciones varían entre queries.

**La solución.** Se aplica normalización Min-Max **global**, usando los límites calculados sobre la distribución empírica completa del modelo — todas las similitudes, de todas las queries, frente a todos los audios del corpus (excepto el propio query):

$$\tilde{s}(i) = \frac{s(i) - s_{\min}^{\text{global}}}{s_{\max}^{\text{global}} - s_{\min}^{\text{global}}} \times 100$$

donde los límites se calculan sobre el conjunto:

$$\mathcal{S} = \bigcup_{q \,\in\, Q} \bigl\{s(q, r) \;:\; r \in \mathcal{D} \setminus \{q\}\bigr\}$$

siendo $\mathcal{D}$ el corpus completo y $Q$ el conjunto de queries de evaluación.

**Resultado.** Tras la normalización, $\tilde{s} \in [0, 100]$ para ambos modelos con el mismo significado semántico: *«este resultado ocupa el X% superior de la distribución de similitud del modelo sobre el dataset»*. Un $\tilde{s} = 85$ en CLAP y un $\tilde{s} = 85$ en Essentia son ahora directamente comparables.

---

### 4.2 Penalización por Posición (*Discounted Cumulative Gain*)

**Motivación.** Una vez normalizadas las similitudes, la **posición** de un resultado en el ranking sigue siendo información relevante. Un modelo que coloca el audio más similar en la posición 1 debe ser premiado frente a otro que lo coloca en la posición 5, aunque ambos devuelvan el mismo conjunto de audios.

**Fórmula.** Se adopta la función de descuento del *Normalized Discounted Cumulative Gain* (NDCG), propuesta por Järvelin & Kekäläinen (2002):

$$w(\text{rank}) = \frac{1}{\log_2(\text{rank} + 1)}$$

| Rank $k$ | $\log_2(k+1)$ | $w(k)$ |
|:---:|:---:|:---:|
| 1 | 1.000 | **1.0000** |
| 2 | 1.585 | **0.6309** |
| 3 | 2.000 | **0.5000** |
| 4 | 2.322 | **0.4307** |
| 5 | 2.585 | **0.3869** |

Esta función es **decreciente y convexa**: la diferencia de peso entre los puestos 1 y 2 es mayor que entre el 4 y el 5, reflejando el comportamiento real del usuario que explora preferentemente los primeros resultados.

---

### 4.3 *Weighted Score* (Puntuación Final)

**Definición.** El *Weighted Score* combina la similitud normalizada de cada resultado con su peso posicional, normalizado por la suma de pesos para que el resultado siga en $[0, 100]$:

$$\text{WS}(q) = \frac{\displaystyle\sum_{k=1}^{K} \tilde{s}(k) \cdot w(k)}{\displaystyle\sum_{k=1}^{K} w(k)}$$

**Propiedades.**

- $\text{WS}(q) \in [0, 100]$ para ambos modelos, en la misma escala.
- Si todos los resultados tienen similitud máxima: $\text{WS}(q) = 100$.
- El score **penaliza doblemente**: por similitud baja y por posición alta. Un modelo que coloca resultados mediocres en los primeros puestos obtiene un WS significativamente menor que uno que coloca resultados excelentes en los primeros puestos.

**Score global.** El *Weighted Score* medio sobre el conjunto de queries $Q$ es la métrica principal de comparación:

$$\overline{\text{WS}} = \frac{1}{|Q|} \sum_{q \,\in\, Q} \text{WS}(q)$$

El modelo con mayor $\overline{\text{WS}}$ se declara **ganador en búsqueda por similitud general**.

---

## 5. Interpretación de Resultados y Casos de Uso

### 5.1 Guía de Interpretación de Escenarios

| Escenario | WS | BPM Agr. | Interpretación |
|---|---|---|---|
| **A** | CLAP > Essentia | Essentia > CLAP | Resultado más frecuente. Cada modelo gana en su dimensión natural. Sistema híbrido óptimo. |
| **B** | CLAP > Essentia | CLAP > Essentia | CLAP ha capturado el tempo implícitamente. Corpus estilísticamente homogéneo. |
| **C** | Essentia > CLAP | Essentia > CLAP | Los descriptores DSP son más discriminativos que los embeddings para este corpus. |
| **D** | ≈ empate | ≈ empate | Overlap alto: los modelos convergen. Corpus con poca variedad o queries muy genéricas. |

**Escenario A en detalle** — CLAP gana en WS, Essentia gana en BPM Agreement:

Significa que CLAP recupera audios perceptualmente más próximos al query (similitud semántica global), pero sin garantizar compatibilidad de tempo. Essentia recupera audios con tempo compatible con alta fiabilidad, gracias a los descriptores rítmicos explícitos (`rhythm.bpm`, `rhythm.onset_rate`, `rhythm.danceability`), aunque su similitud global puede ser más dispersa en el espacio de 1 126 dimensiones.

**Implicación práctica:** ningún modelo es superior en términos absolutos; cada uno es óptimo para un subconjunto de casos de uso. La fusión de rankings (*ensemble*) produce resultados superiores a cualquiera de los dos por separado.

---

### 5.2 La Brecha Semántica vs. Precisión Acústica

Los resultados de esta evaluación deben interpretarse a la luz de la **brecha semántica** (*semantic gap*): la distancia entre la representación computacional de un audio y la percepción subjetiva humana del mismo. Ambos modelos abordan esta brecha desde extremos opuestos.

#### Casos de uso donde CLAP es el modelo óptimo

> *El usuario describe o ejemplifica un estilo, textura o mood.*

- **Búsqueda por analogía tímbrica** — el usuario sube un pad ambiental oscuro y busca samples con la misma atmósfera, independientemente del BPM exacto. CLAP captura la "oscuridad" y el carácter ambiental como atributos latentes; Essentia solo puede comparar coeficientes espectrales.
- **Búsqueda cross-genre** — el usuario busca *"algo que suene como este bassline de funk pero en contexto electrónico"*. La similitud semántica de CLAP puede cruzar fronteras de género que los descriptores DSP no atraviesan.
- **Exploración creativa** — cuando el usuario no sabe exactamente qué busca. Los resultados de CLAP tienden a ser creativamente estimulantes, ya que el espacio de embeddings organiza los audios por relaciones semánticas aprendidas de datos humanos.

#### Casos de uso donde Essentia KNN es el modelo óptimo

> *El usuario necesita compatibilidad técnica precisa con un proyecto en curso.*

- **Sincronización de tempo** — el usuario trabaja a 140 BPM y necesita samples rítmicamente compatibles. El BPM Agreement superior de Essentia garantiza resultados utilizables sin *time-stretching*.
- **Matching de características acústicas** — el usuario busca un sample con el mismo rango de frecuencias y nivel de energía que otro ya en uso (para *layering*). Los descriptores de bajo nivel de Essentia son más precisos en estas dimensiones técnicas.
- **Géneros rítmicamente estrictos** — *drum and bass*, *techno* o música clásica, donde la precisión de BPM y la coherencia espectral son no-negociables.

#### Síntesis: argumento para un sistema híbrido

La existencia de estos dos perfiles complementarios es la motivación técnica principal para el diseño híbrido de Voice2Sample. Si se define la función de utilidad $U(q, r)$ de un resultado $r$ para un query $q$ como:

$$U(q, r) = \alpha \cdot \text{WS}_{\text{CLAP}}(q, r) + (1-\alpha) \cdot \text{WS}_{\text{Ess}}(q, r)$$

donde $\alpha \in [0, 1]$ controla el balance entre búsqueda semántica y acústica, el sistema puede configurarse dinámicamente según el contexto del usuario. La evaluación cuantitativa presentada en este documento proporciona los fundamentos empíricos para justificar este diseño y calibrar el parámetro $\alpha$ de forma informada.

---

## 6. Uso del Script

```bash
# Instalación de dependencias
pip install numpy scikit-learn joblib rich

# Ejecución básica (5 queries automáticos)
python Evaluation/evaluacion_cuantitativa.py \
    --me-json    audio_analysis/descriptors/music_all.json \
    --models-dir audio_processing/Processing/models \
    --clap-json  Dataset/embeddings_output.json \
    --top-k      5

# Ejecución con queries específicos y exportación JSON
python Evaluation/evaluacion_cuantitativa.py \
    --me-json    audio_analysis/descriptors/music_all.json \
    --models-dir audio_processing/Processing/models \
    --clap-json  Dataset/embeddings_output.json \
    --top-k      5 \
    --query-ids  100270 101894 101895 \
    --output-json Evaluation/resultados.json
```

| Parámetro | Obligatorio | Descripción |
|---|:---:|---|
| `--me-json` | ✅ | JSON de descriptores Essentia (`music_all.json`) |
| `--models-dir` | ✅ | Directorio con los ficheros `.joblib` de Essentia KNN |
| `--clap-json` | ✅ | JSON de embeddings CLAP (`embeddings_output.json`) |
| `--top-k` | ❌ | Número de resultados por query (default: `5`) |
| `--query-ids` | ❌ | IDs de audio a evaluar. Si se omite, los 5 primeros comunes |
| `--output-json` | ❌ | Ruta para guardar resultados en JSON |

---

## 7. Referencias

- Järvelin, K., & Kekäläinen, J. (2002). *Cumulative gain-based evaluation of IR techniques*. ACM Transactions on Information Systems, 20(4), 422–446.
- Laion-AI. (2022). *CLAP: Learning Audio Concepts From Natural Language Supervision*. arXiv:2206.04769.
- Bogdanov, D., et al. (2013). *Essentia: an Audio Analysis Library for Music Information Retrieval*. ISMIR 2013.
- Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to Information Retrieval*. Cambridge University Press. Cap. 8: Evaluation in information retrieval.

---

*Documento generado como parte de la memoria del TFG «Voice2Sample» — Evaluación Cuantitativa de Sistemas de Recuperación de Audio por Similitud.*
