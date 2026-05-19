# Voice2Sample

Voice2Sample is a project for finding and comparing sound samples from an input recording. It includes dataset utilities, audio descriptor experiments, machine learning prototypes, and a Vite/React web interface.

## What the project does

- Dataset preparation: WAV conversion, CSV cleanup, and JSON to CSV tools.
- Audio analysis experiments with timbre, rhythm, melody, and general descriptors.
- Machine learning prototypes for local audio similarity experiments.
- Web UI to record or upload audio, preview a waveform, trim the useful region, and search related sounds through Freesound.

## General requirements

- Python 3.10+ for the analysis, dataset, and machine learning scripts.
- Node.js 18+ for the web interface.
- Python dependencies in [requeriments.txt](requeriments.txt).

## Python Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requeriments.txt
```

Note: `essentia` does not provide official Windows binaries. On Windows, use WSL or another Linux environment if you need the Essentia scripts.

## Web Interface

```bash
cd graphic_interface_v1
npm install
npm run dev
```

Create `graphic_interface_v1/.env.local` from `graphic_interface_v1/.env.example` and add a Freesound API key:

```env
VITE_FREESOUND_API_KEY=your_freesound_api_key_here
VITE_FREESOUND_API_BASE=https://freesound.org/apiv2
VITE_MAX_FILE_SIZE=52428800
VITE_SUPPORTED_FORMATS=wav,mp3,ogg,flac,m4a
```

The web app runs with Vite, normally at `http://localhost:5173`.

## Repository Structure

```text
Voice2Sample/
  audio_analysis/
    descriptors/
    general_features.py
    melodic_features.py
    rhythmic_features.py
    timbre_features.py
  Dataset/
    Clean_csv/
    Convert_audio_to_wav/
    Json_to_csv/
    audio_prueba/
  Evaluation/
  graphic_interface_v1/
    src/
      components/
      context/
      hooks/
      services/
      styles/
  Machine_Learning/
    Deep_learning/
    Machine/
  README.md
  requeriments.txt
```

## License

See [LICENSE](LICENSE).
