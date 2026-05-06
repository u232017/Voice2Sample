# 🎵 Audio Analysis - Extracción de Descriptores Musicales

Proyecto para extraer descriptores musicales de archivos de audio usando Essentia.

## 📋 Requisitos Previos

- **Python 3.8+** instalado
- **WSL (Windows Subsystem for Linux)** si estás en Windows
- Archivo de audio de prueba (ej: `pruebawa.wav`)

## 🚀 Instalación y Configuración

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

- `music_descriptors.json` - Descriptores generales (577 características)
- `timbre_descriptors.json` - Descriptores de timbre (MFCC, centroid, etc.)
- `rhythmic_descriptors.json` - Descriptores rítmicos (BPM, beats, etc.)
- `melodic_descriptors.json` - Descriptores melódicos (pitch, HPCP, key, etc.)

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
   - 577 características de bajo, medio y alto nivel
   - Tempo, dinámica, timbre, armonía, etc.

2. **Descriptores de Timbre**
   - MFCC (13 coeficientes)
   - GFCC (13 coeficientes)
   - Centroid espectral, spread, rolloff
   - Flux espectral, zero crossing rate

3. **Descriptores Rítmicos**
   - BPM (tempo)
   - Posiciones de beats
   - Confianza de detección
   - Intervalos entre beats

4. **Descriptores Melódicos**
   - Pitch por frame con confianza
   - Harmonic Pitch Class Profile (HPCP)
   - Tonalidad y modo detectados
   - Fuerza de la detección de key

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
