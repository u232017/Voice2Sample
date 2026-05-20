# 🎵 Audio Analysis - Extracción de Descriptores Musicales

Proyecto para extraer descriptores musicales de archivos de audio usando Essentia.

## 📋 Requisitos Previos

- **Python 3.8+** instalado
- **WSL (Windows Subsystem for Linux)** si estás en Windows
- Archivo de audio de prueba (ej: `pruebawa.wav`)

## 🚀 Instalación y Configuración

### 0. Instalar y activar wsl

```bash
#Instalar wsl
wsl --install

# Activar wsl
wsl
```

### 1. Crear Entorno Virtual (Recomendado)

```bash
# Crear entorno virtual
python3 -m venv .venv

# Activar entorno virtual
source .venv/bin/activate
```

### 2. Actualizar pip

```bash
# Actualizar pip a la última versión
pip install --upgrade pip
```

### 3. Instalar Dependencias

```bash
# Instalar Essentia (librería principal para análisis de audio)
pip install essentia

# Instalar otras dependencias necesarias
pip install numpy matplotlib seaborn scikit-learn
```

## 🎯 Cómo Ejecutar

### Ejecutar Análisis Completo

```bash
# Ejecutar el script principal
python3 main.py
```

Esto extraerá automáticamente todos los descriptores musicales y los guardará en archivos JSON separados en la carpeta `descriptors/`.

### Archivos Generados

Después de ejecutar, encontrarás estos archivos en la carpeta `descriptors/`:

- `music_all.json` - JSON final fusionado con todos los descriptores generales de `descriptors/music/`
- `timbre_descriptors.json` - Descriptores de timbre extraídos desde `descriptors/music/*.json`
- `rhythmic_descriptors.json` - Descriptores rítmicos extraídos desde `descriptors/music/*.json`
- `melodic_descriptors.json` - Descriptores melódicos extraídos desde `descriptors/music/*.json`

También se crea la carpeta intermedia `descriptors/music/` con un JSON por archivo de audio antes de fusionar.
## 📁 Estructura del Proyecto

```
audio_analysis/
├── main.py                    # Script principal de ejecución
├── general_features.py        # Extracción de descriptores generales con Essentia MusicExtractor
├── timbre_features.py         # Selección de descriptores de timbre desde el JSON general
├── rhythmic_features.py       # Selección de descriptores rítmicos desde el JSON general
├── melodic_features.py        # Selección de descriptores melódicos desde el JSON general
├── descriptors/               # Carpeta con resultados JSON (generada)
├── reports/                   # Carpetas de logs de ejecución
├── README.md                  # Este archivo
└── requeriments.txt           # Lista de dependencias
```

## 🔧 Funcionalidades

### Descriptores Extraídos

1. **Descriptores Generales** (MusicExtractor)
   - Extrae estadísticas `mean` y `var` de descriptores `lowlevel`, `rhythm`, `tonal` y `mfcc`
   - Genera un JSON individual por audio en `descriptors/music/`
   - Fusiona esos JSON en `descriptors/music_all.json`

2. **Descriptores de Timbre**
   - MFCC (`lowlevel.mfcc.mean`, `lowlevel.mfcc.var`)
   - GFCC (`lowlevel.gfcc.mean`, `lowlevel.gfcc.var`)
   - Centroid espectral (`lowlevel.spectral_centroid.mean`, `lowlevel.spectral_centroid.var`)
   - Spread espectral (`lowlevel.spectral_spread.mean`, `lowlevel.spectral_spread.var`)
   - Rolloff espectral (`lowlevel.spectral_rolloff.mean`, `lowlevel.spectral_rolloff.var`)
   - Flux espectral (`lowlevel.spectral_flux.mean`, `lowlevel.spectral_flux.var`)
   - Zero crossing rate (`lowlevel.zerocrossingrate.mean`, `lowlevel.zerocrossingrate.var`)

3. **Descriptores Rítmicos**
   - BPM global (`rhythm.bpm`)
   - Número de beats (`rhythm.beats_count`)
   - Confianza rítmica basada en loudness de beats (`rhythm.beats_loudness.mean`)
   - Tasa de onsets (`rhythm.onset_rate`)
   - Danceability (`rhythm.danceability`)
   - Histograma de BPM: primer y segundo pico con peso y spread

4. **Descriptores Melódicos**
   - Pitch salience media y varianza (`lowlevel.pitch_salience.mean`, `lowlevel.pitch_salience.var`)
   - HPCP crest media y varianza (`tonal.hpcp_crest.mean`, `tonal.hpcp_crest.var`)
   - Entropía de HPCP media (`tonal.hpcp_entropy.mean`)
   - Fuerza de tonalidad: EDMA, Krumhansl y Temperley (`tonal.key_edma.strength`, `tonal.key_krumhansl.strength`, `tonal.key_temperley.strength`)

## ❓ Por qué estos descriptores (y por qué en loops)

He escogido estos descriptores porque representan bien cada aspecto del audio y, además, se benefician del análisis por frames (loops), ya que permiten capturar cambios en el tiempo.

---

### 🎼 Melódicos
- **pitch_mean / pitch_var**: resumen la claridad y estabilidad del pitch detectado por `lowlevel.pitch_salience`  
  👉 Capturan cómo varía la presencia melódica en el audio y su consistencia.  

- **hpcp_crest_mean / hpcp_crest_var**: energía armónica de HPCP  
  👉 Refleja la fuerza y la variabilidad de la armonía en la pista.  

- **hpcp_entropy_mean**: entropía de HPCP  
  👉 Indica si la armonía está más ordenada o dispersa.  

- **key_strength_edma / key_strength_krumhansl / key_strength_temperley**: fuerza de tonalidad según tres criterios  
  👉 Mide la claridad tonal desde diferentes métodos de detección.  

---

### 🥁 Rítmicos
- **bpm**: velocidad global calculada por `rhythm.bpm`  
  👉 Describe la base rítmica de la pista.  

- **beats**: recuento de beats detectados (`rhythm.beats_count`)  
  👉 Indica la densidad rítmica del audio.  

- **beat_confidence**: loudness promedio de beats (`rhythm.beats_loudness.mean`)  
  👉 Usa la energía de los pulsos para estimar la fiabilidad del ritmo.  

- **onset_rate**: tasa de transitorios (`rhythm.onset_rate`)  
  👉 Mide cuántos ataques o eventos por segundo aparecen.  

- **danceability**: medida de bailabilidad (`rhythm.danceability`)  
  👉 Refleja qué tan fluido y regular es el ritmo para bailar.  

- **bpm_hist_first_peak_bpm / bpm_hist_first_peak_weight**: primer pico del histograma de BPM  
  👉 Indica el tempo dominante y su importancia.  

- **bpm_hist_second_peak_bpm / bpm_hist_second_peak_spread / bpm_hist_second_peak_weight**: segundo pico del histograma de BPM  
  👉 Mide tempo alternativo y su consistencia.  

---

### 🎧 Tímbricos
- **mfcc.mean / mfcc.var**: coeficientes MFCC y su variabilidad  
  👉 Describen la forma espectral y la textura sonora.  

- **gfcc.mean / gfcc.var**: coeficientes GFCC y su variabilidad  
  👉 Complementan los MFCC con robustez frente al ruido.  

- **spectral_centroid.mean / spectral_centroid.var**: brillo espectral  
  👉 Mide dónde se concentra la energía en el espectro.  

- **spectral_spread.mean / spectral_spread.var**: dispersión espectral  
  👉 Indica cuán extendida está la energía espectral.  

- **spectral_rolloff.mean / spectral_rolloff.var**: rolloff espectral  
  👉 Marca el límite superior de la energía dominante.  

- **spectral_flux.mean / spectral_flux.var**: cambio espectral  
  👉 Detecta transiciones y dinámicas en el timbre.  

- **zerocrossingrate.mean / zerocrossingrate.var**: tasa de cruces por cero  
  👉 Diferencia sonidos más tonales de sonidos más ruidosos.  

---

### 🎯 Resumen
He escogido estos descriptores porque:
- describen bien **melodía, ritmo y timbre**  
- permiten analizar la **evolución temporal** mediante loops  
- capturan tanto información **instantánea (por frame)** como **global (agregada)**  

## ❓ Por qué estos descriptores (y por qué en loops)

He escogido estos descriptores porque representan bien cada aspecto del audio y, además, se benefician del análisis por frames (loops), ya que permiten capturar cambios en el tiempo.

---

### 🎼 Melódicos
- **pitch**: indica la nota (frecuencia fundamental) → base de la melodía  
  👉 En loops permite seguir cómo cambia la melodía instante a instante  

- **pitch_confidence**: indica la fiabilidad del pitch detectado  
  👉 En loops permite descartar frames donde la estimación es incorrecta (ruido, percusión, etc.)  

- **hpcp**: representa la energía por clases de nota (Do, Re, Mi…)  
  👉 En loops captura cómo evoluciona la armonía a lo largo del tiempo  

- **key, scale, key_strength**: resumen la tonalidad global  
  👉 Se calculan a partir de todos los frames, aprovechando la información acumulada del loop  

---

### 🥁 Rítmicos
- **bpm**: velocidad global de la canción  
  👉 Se estima a partir de muchos frames, detectando patrones repetidos en el tiempo  

- **beats**: posiciones de los pulsos rítmicos  
  👉 En loops permite detectar eventos distribuidos temporalmente  

- **beat_confidence**: mide si los beats siguen un patrón regular  
  👉 En loops evalúa la consistencia del ritmo entre frames  

- **beat_intervals**: tiempo entre beats  
  👉 En loops permite analizar si el ritmo es estable o varía  

---

### 🎧 Tímbricos
- **mfcc**: resumen la forma del espectro → diferencian sonidos  
  👉 En loops capturan cambios de timbre a lo largo del tiempo  

- **gfcc**: similares a MFCC pero más robustos al ruido  
  👉 En loops mantienen estabilidad incluso si la señal cambia  

- **spectral_centroid**: indica el “brillo” del sonido  
  👉 En loops permite ver variaciones de brillo entre frames  

- **spectral_spread**: dispersión de frecuencias  
  👉 En loops detecta cambios en la distribución espectral  

- **spectral_rolloff**: distribución de energía en frecuencias  
  👉 En loops sigue cómo cambia la energía en el espectro  

- **spectral_flux**: cambio entre frames  
  👉 En loops mide directamente la dinámica temporal  

- **zero_crossing_rate**: nivel de ruido/percusividad  
  👉 En loops detecta variaciones rápidas en la señal  

---

### 🎯 Resumen
He escogido estos descriptores porque:
- describen bien **melodía, ritmo y timbre**  
- permiten analizar la **evolución temporal** mediante loops  
- capturan tanto información **instantánea (por frame)** como **global (agregada)**  

## ⚠️ Notas Importantes

- Asegúrate de tener un archivo `pruebawa.wav` en la carpeta raíz
- Los descriptores se calculan por frame (ventanas de 2048 muestras)
- Los resultados se guardan automáticamente en JSON para fácil procesamiento posterior
- El análisis puede tomar tiempo dependiendo del tamaño del archivo de audio

## 🐛 Solución de Problemas

### Error: "Audio file not found"
- Verifica que `pruebawa.wav` esté en la carpeta correcta
- Asegúrate de que el archivo no esté corrupto

### Error: "Module 'essentia' not found"
- Activa el entorno virtual: `source .venv/bin/activate`
- Reinstala Essentia: `pip install essentia`

### Error: "ndarray is not JSON serializable"
- Ya está solucionado en el código actual
- Los arrays numpy se convierten automáticamente a listas

## 📚 Dependencias Técnicas

- **Essentia** - Framework de análisis de audio
- **NumPy** - Computación numérica
- **JSON** - Serialización de datos (incluido en Python)

---

**Proyecto desarrollado para análisis de señales musicales usando técnicas de machine learning.**
