# 🎵 Audio Analysis - Extracción de Descriptores Musicales

Módulo de extracción de descriptores musicales (ritmo, melodía y timbre). Cumple dos funciones:

1. **Extracción en tiempo real (librosa)**: los extractores `rhythmic_features.py`, `melodic_features.py` y `timbre_features.py` analizan cualquier audio al vuelo. El backend los usa para cada consulta del usuario, y `regenerate_descriptors.py` los usa en batch para construir la base de datos del dataset.
2. **Pipeline batch original (Essentia)**: `main.py` + `general_features.py` extraen los 577 descriptores generales de Essentia (`music_all.json`), que se usan para las estadísticas del dataset y el modelo `knn_essentia` de la evaluación.

> ⚠️ **Regla de consistencia**: el dataset y la consulta deben pasar por las **mismas funciones de extracción**. Por eso `regenerate_descriptors.py` importa exactamente los mismos extractores que usa el backend en producción. Si se modifica un extractor, hay que regenerar los descriptores y reentrenar los modelos.

## 📁 Estructura del Proyecto

```
audio_analysis/
├── rhythmic_features.py        # Descriptores rítmicos (librosa, 22.05 kHz)
├── melodic_features.py         # Descriptores melódicos (librosa, 48 kHz)
├── timbre_features.py          # Descriptores de timbre (librosa, 48 kHz)
├── regenerate_descriptors.py   # Regenera descriptors/ del dataset y reentrena los KNN
├── general_features.py         # Descriptores generales con Essentia (pipeline batch)
├── main.py                     # Pipeline batch original (Essentia, genera music_all.json)
├── descriptors/                # Base de datos de descriptores del dataset (JSON)
│   ├── rhythmic_descriptors.json
│   ├── melodic_descriptors.json
│   ├── timbre_descriptors.json
│   └── music_all.json          # Descriptores Essentia (evaluación y estadísticas)
└── README.md                   # Este archivo
```

## 🚀 Instalación

Todo el proyecto usa un único `requirements.txt` en la raíz del repositorio (verificado en Python 3.12 bajo WSL):

```bash
# Desde la raíz del repositorio
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> Essentia solo se distribuye por pip para Linux: usa **WSL** si estás en Windows (`wsl --install` y luego `wsl`). Solo es necesaria para el pipeline batch (`main.py` / `general_features.py`); los extractores en tiempo real funcionan con librosa en cualquier sistema.

## 🎯 Cómo Ejecutar

### Regenerar los descriptores del dataset (y reentrenar los KNN)

Necesario solo si cambias algún extractor o añades audios al dataset:

```bash
# Desde la raíz del repositorio
python audio_analysis/regenerate_descriptors.py --retrain
```

- Procesa todos los audios de `Dataset/audio_processed/` en paralelo (configurable con `--workers`).
- Es **reanudable**: guarda checkpoints cada pocos audios; si se interrumpe, vuelve a lanzarlo y continúa.
- Escribe los JSON en `audio_analysis/descriptors/` y los informes por audio en `reports/`.
- Con `--retrain` llama a `search_engines/acoustic_search/train_models.py` al terminar para reentrenar los 4 modelos KNN.

### Usar los extractores directamente

```python
from rhythmic_features import extract_rhythmic_descriptors
from melodic_features import extract_melodic_features
from timbre_features import extract_timbre_descriptors

ritmo = extract_rhythmic_descriptors("mi_audio.wav")    # bpm, beats, onset_rate...
melodia = extract_melodic_features("mi_audio.wav")      # pitch, hpcp, key strength...
timbre = extract_timbre_descriptors("mi_audio.wav")     # mfcc, gfcc, spectral...
```

### Pipeline batch original (Essentia)

`main.py` recorre los audios, extrae los descriptores generales con `MusicExtractor` de Essentia y fusiona los resultados en `descriptors/music_all.json` (con la carpeta intermedia `descriptors/music/`, un JSON por audio).

```bash
python3 main.py
```

## 🔧 Descriptores Extraídos

### Frecuencias de muestreo

| Extractor | Sample rate | Motivo |
|-----------|-------------|--------|
| Rítmico | 22 050 Hz | El tempo no necesita alta resolución espectral; es mucho más rápido |
| Melódico | 48 000 Hz | El dataset está a 48 kHz; remuestrear la query garantiza features comparables |
| Timbre | 48 000 Hz | Igual que el melódico: las features espectrales dependen del sample rate |

### 🥁 Rítmicos (`rhythmic_features.py`)
- **bpm**: tempo global estimado con `librosa.feature.tempo` sobre la envolvente de onsets
- **beats**: número de pulsos estimados a partir del tempo
- **beat_confidence**: regularidad de los intervalos entre beats (1 = perfectamente regular)
- **onset_rate**: transitorios detectados por segundo, útil para percusión y articulación
- **danceability**: proxy combinando regularidad rítmica y densidad de onsets

### 🎼 Melódicos (`melodic_features.py`)
- **pitch_mean / median / max / min**: estadísticas del pitch detectado con `librosa.pyin`
- **pitch_confidence**: probabilidad media de los frames con voz/tono detectado
- **hpcp_crest_mean / median / max / min**: concentración de energía por clase de pitch (chroma CQT), refleja la fuerza armónica
- **hpcp_entropy**: entropía del chroma; armonía ordenada (baja) vs dispersa (alta)
- **key_strength_edma / krumhansl / temperley**: claridad de la tonalidad según correlación con plantillas mayor/menor

### 🎧 Tímbricos (`timbre_features.py`)
- **mfcc.mean (×13)**: forma general del espectro, para distinguir sonoridades
- **gfcc.mean / gfcc.cov (×13)**: representación complementaria robusta al ruido (proxy mel)
- **spectral_centroid / spread / rolloff**: brillo, dispersión y concentración de la energía espectral
- **spectral_flux**: velocidad de cambio del espectro entre frames
- **zerocrossingrate**: distingue sonidos tonales de ruidosos/percusivos

### 🎯 Resumen
Estos descriptores se escogieron porque:
- describen bien **melodía, ritmo y timbre** de forma independiente, lo que permite los 4 modos de búsqueda
- capturan tanto información **instantánea (por frame)** como **global (agregada)**
- son rápidos de calcular en tiempo real para cada consulta del usuario

## ⚠️ Notas Importantes

- Las claves de los JSON generados (`lowlevel.mfcc.mean.0`, `pitch_mean`, `bpm`...) deben coincidir con las columnas con las que se entrenaron los modelos KNN (`search_engines/acoustic_search/models/columnas_*.joblib`).
- Si un audio es silencioso o inválido, los extractores devuelven `None` y lo registran en el informe.
- Test de sanidad tras regenerar: buscar un audio del propio dataset debe devolverlo a sí mismo en el puesto 1 con distancia 0.

## 🐛 Solución de Problemas

### Error: "Module 'essentia' not found"
- Solo afecta al pipeline batch (`main.py`). Activa el entorno (`source .venv/bin/activate`) y reinstala desde la raíz: `pip install -r requirements.txt` (en WSL/Linux).

### La búsqueda devuelve similitudes absurdas tras tocar un extractor
- Dataset y query ya no son comparables. Regenera: `python audio_analysis/regenerate_descriptors.py --retrain`.

---

**Hecho por el equipo de Voice2Sample.**
