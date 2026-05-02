# 🎧 Audio Dataset Processing Pipeline

Este proyecto automatiza el procesamiento de un dataset de audio y sus metadatos.  
Convierte, limpia y valida audios junto con su información en CSV para su uso en machine learning o análisis de datos.

## 📋 Requisitos Previos

- **Python 3.8+** instalado
- **WSL (Windows Subsystem for Linux)** si estás en Windows
- Abrir Dataset/main.py y configurar todas las rutas al metadata y al audio que hay definidas. 

# 📌 Objetivo

El pipeline realiza:

1. Conversión de audios a formato WAV estándar
2. Eliminación de silencios iniciales
3. Normalización de sample rate (16 kHz) y canal a mono.
4. Conversión de metadata JSON → CSV
5. Filtrado y limpieza del CSV
6. Validación de consistencia entre CSV y archivos de audio

---

# 🗂️ Estructura del proyecto
Dataset/
├── audio/                    # Audios originales
├── audio_processed/         # Audios procesados (output)
├── Json_to_csv/
│   └── metadata
├── Clean_csv/
│   ├── metadata.csv
│   └── metadata_filtered.csv
├── Convert_audio_to_wav/
├── Json_to_csv/
├── Clean_csv/
├── main.py

---

# ⚙️ Pipeline

El flujo principal se ejecuta desde `main.py`.

## 1. Conversión de audio

📂 `Convert_audio_to_wav/wav_convertor.py`

- Carga audios en múltiples formatos:
  - mp3, wav, flac, ogg, aiff, etc.
- Elimina silencio inicial
- Convierte a:
  - WAV
  - Mono
  - 16 kHz sample rate

---

## 2. Conversión de JSON a CSV

📂 `Json_to_csv/json_to_csv.py`

- Convierte metadata JSON a CSV usando `pandas`
- Limpia texto (remueve \n, \t, \r)
- Normaliza estructura anidada
- Renombra campos para mejor comprension

---

## 3. Filtrado de CSV

📂 `Clean_csv/csv_filter.py`

- Selecciona columnas relevantes
- Añade columna `audio_path` automáticamente
- Genera CSV limpio para entrenamiento o análisis


## 4. Validación de audios

📂 'Clean_csv/csv_filter.py'

- Verifica que cada id del CSV tenga su archivo .wav
- Reporta audios faltantes
- Evita inconsistencias entre dataset y metadata

---

# 🚀 Ejecución

Para ejecutar todo el pipeline:
## 1.1 Entrar en entorno virtual linux (si estas en windows). 

wsl
cd ## To the working folder ##

## 1.2 Crear entorno virtual y activarlo

python3 -m venv .venv
source .venv/bin/activate

## 2. Instalar Dependencias

pip install --upgrade pip
pip install pandas
sudo apt install ffmpeg

## 3. Ejecutar el script

python main.py