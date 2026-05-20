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
- `timbre_descriptors.json` - Descriptores de timbre extraídos del JSON general
- `rhythmic_descriptors.json` - Descriptores rítmicos extraídos del JSON general
- `melodic_descriptors.json` - Descriptores melódicos extraídos del JSON general

También se crea la carpeta intermedia `descriptors/music/` con un JSON por archivo de audio antes de fusionar.
## 📁 Estructura del Proyecto

```
audio_analysis/
├── main.py                    # Script principal de ejecución
├── general_features.py        # Extracción de descriptores generales
├── timbre_features.py         # Extracción de descriptores de timbre
├── rhythmic_features.py       # Extracción de descriptores rítmicos
├── melodic_features.py        # Extracción de descriptores melódicos
├── descriptors/               # Carpeta con resultados JSON (generada)
├── README.md                  # Este archivo
└── requeriments.txt           # Lista de dependencias
```

## 🔧 Funcionalidades

### Descriptores Extraídos

1. **Descriptores Generales** (MusicExtractor)
   - 577 características agregadas a partir de `MusicExtractor`
   - Estadísticas `mean` de descriptores `lowlevel`, `rhythm`, `tonal` y `mfcc`
   - Incluye tempo, energía, brillo espectral, armonía, dinamismo y más

2. **Descriptores de Timbre**
   - MFCC (`lowlevel.mfcc.mean`, `lowlevel.mfcc.cov`)
   - GFCC (`lowlevel.gfcc.mean`, `lowlevel.gfcc.cov`)
   - Centroid espectral (`lowlevel.spectral_centroid.*`)
   - Spread espectral (`lowlevel.spectral_spread.*`)
   - Rolloff espectral (`lowlevel.spectral_rolloff.*`)
   - Flux espectral (`lowlevel.spectral_flux.*`)
   - Zero crossing rate (`lowlevel.zerocrossingrate.*`)

3. **Descriptores Rítmicos**
   - BPM global (`rhythm.bpm`)
   - Número de beats (`rhythm.beats_count`)
   - Confianza rítmica basada en loudness (`rhythm.beats_loudness.mean`)
   - Tasa de onsets (`rhythm.onset_rate`)
   - Danceability (`rhythm.danceability`)

4. **Descriptores Melódicos**
   - Pitch promedio, mediano, máximo y mínimo (`lowlevel.pitch_salience.*`)
   - `pitch_confidence` como desviación estándar de pitch salience
   - HPCP crest promedio/mediano/máximo/mínimo (`tonal.hpcp_crest.*`)
   - Entropía de HPCP (`tonal.hpcp_entropy.mean`)
   - Fuerza de tonalidad según EDMA, Krumhansl y Temperley

## ❓ Por qué estos descriptores (y por qué en loops)

He escogido estos descriptores porque representan bien cada aspecto del audio y, además, se benefician del análisis por frames (loops), ya que permiten capturar cambios en el tiempo.

---

### 🎼 Melódicos
- **pitch_mean / pitch_median / pitch_max / pitch_min**: resumen la claridad de pitch detectada por `lowlevel.pitch_salience.*`  
  👉 Capturan cómo cambia la presencia melódica en el audio, incluso cuando la señal es variable.  

- **pitch_confidence**: desviación estándar de `lowlevel.pitch_salience`  
  👉 Mide cuánta variación hay en la detección de pitch; valores bajos indican estimaciones más estables.  

- **hpcp_crest_mean / hpcp_crest_median / hpcp_crest_max / hpcp_crest_min**: energía máxima de HPCP (`tonal.hpcp_crest.*`)  
  👉 Refleja la fuerza armónica de la pista y cómo cambia la concentración de notas.  

- **hpcp_entropy**: entropía de HPCP (`tonal.hpcp_entropy.mean`)  
  👉 Indica si la armonía es más ordenada (poca entropía) o más dispersa.  

- **key_strength_edma / key_strength_krumhansl / key_strength_temperley**: fuerza de tonalidad según tres algoritmos distintos  
  👉 Mide cuán clara es la tonalidad bajo diferentes reglas de detección musical.  

---

### 🥁 Rítmicos
- **bpm**: velocidad global calculada por `rhythm.bpm`  
  👉 Describe la velocidad base de la pista y sirve de referencia para el ritmo.  

- **beats**: recuento de beats detectados (`rhythm.beats_count`)  
  👉 Muestra cuántos pulsos rítmicos se identifican en el audio; útil para medir densidad rítmica.  

- **beat_confidence**: loudness promedio de los beats (`rhythm.beats_loudness.mean`)  
  👉 Usa la energía de los beats como proxy de fiabilidad rítmica.  

- **onset_rate**: tasa de transitorios detectados (`rhythm.onset_rate`)  
  👉 Indica cuántos eventos de ataque ocurren por segundo, útil para percusión y articulación.  

- **danceability**: medida de bailabilidad (`rhythm.danceability`)  
  👉 Refleja qué tan “bailable” es la pista según su patrón rítmico.  

---

### 🎧 Tímbricos
- **mfcc.mean / mfcc.cov**: coeficientes MFCC y su covarianza  
  👉 Capturan la forma general del espectro y su variabilidad para distinguir sonoridades.  

- **gfcc.mean / gfcc.cov**: coeficientes GFCC y su covarianza  
  👉 Ofrecen una representación robusta frente al ruido, complementando los MFCC.  

- **spectral_centroid.*:** brillo espectral en media, mediana, máximo, mínimo y desviación estándar  
  👉 Mide hacia dónde se concentra la energía espectral.  

- **spectral_spread.*:** dispersión espectral en media, mediana, máximo, mínimo y desviación estándar  
  👉 Indica si la energía está concentrada o dispersa en el espectro.  

- **spectral_rolloff.*:** rolloff espectral en media, mediana, máximo, mínimo y desviación estándar  
  👉 Indica hasta qué frecuencia se concentra la mayor parte de la energía.  

- **spectral_flux.*:** cambio espectral entre frames en media, mediana, máximo, mínimo y desviación estándar  
  👉 Mide qué tan rápido varía el espectro, útil para detectar dinámicas y transiciones.  

- **zerocrossingrate.*:** tasa de cruces por cero en media, mediana, máximo, mínimo y desviación estándar  
  👉 Ayuda a distinguir sonidos tonales de sonidos más ruidosos o percusivos.  

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

