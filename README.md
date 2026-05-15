# Voice2Sample

Voice2Sample is a project for producers and developers that makes it easy to search and compare loops, samples, and short audio fragments by extracting acoustic descriptors, processing metadata, and using similarity models. The repository contains tools to prepare datasets, extract musical descriptors, train or run machine learning models, and a web interface to test recommendations.

**Summary of features**
- Dataset preparation: convert audio to WAV, clean metadata, and generate CSV files ready for ML.
- Extraction of acoustic and musical descriptors (timbre, rhythm, melodic) from `audio_analysis/` (uses Essentia).
- Search for similar samples based on descriptors and embeddings.
- Backend API that serves recommendations and a frontend for visualization and interaction.

**Dataset used in this repository**
- The main collection is located in the `Dataset/` folder.
	- `Dataset/audio_prueba`: example processed audio used for local testing.
	- `Dataset/metadata_prueba`: metadata associated with those audio files.
- The pipeline supports downloading collections from Zenodo (see `download_dataset/zenodo_downloader.py`) and the dependencies listed in `Dataset/readme.md` include `zenodo-get`. Therefore, the intended source for bulk data is Zenodo when using the downloader script; otherwise, you can place audio and metadata manually into the folders above.

**Repository highlights**
- `audio_analysis/` — Descriptor extraction and generation of JSON files in `descriptors/` (melodic, timbre, rhythmic, music).
- `Dataset/` — Audio conversion, JSON→CSV conversion, cleaning and validation (main pipeline in `Dataset/main.py`).
- `backend/` — FastAPI backend that exposes recommendation endpoints for the UI.
- `graphic_interface_v1/` — Web interface (Vite + React/TypeScript) for uploading/recording audio and displaying results.
- `Machine_Learning/` — Experiments, embeddings and models for similarity.

**Quick installation and run guide**
1. Create and activate a Python environment:

```bash
python -m venv .venv
.venv\Scripts\activate    # Windows PowerShell
# or: source .venv/bin/activate    # WSL / Linux
```

2. Install dependencies:

```bash
pip install -r requeriments.txt
```

3. Prepare or download the dataset (optional):
- Edit paths in `Dataset/main.py` to point to your audio/metadata folders.
- To download collections from Zenodo, use `download_dataset/zenodo_downloader.py`.

4. Run the Dataset pipeline:

```bash
cd Dataset
python main.py
```

5. Extract acoustic descriptors:

```bash
cd audio_analysis
python main.py
```

6. Run the backend API (from the repository root):

```bash
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

7. Start the web interface (optional):

```bash
cd graphic_interface_v1
npm install
npm run dev
```

**Important notes**
- `essentia` does not provide official Windows binaries; using WSL is recommended for analysis with Essentia (`audio_analysis/README.md` and `Dataset/readme.md` include instructions).
- Make sure `ffmpeg` is installed for audio conversions.
- By default, the backend uses the files in `Dataset/audio_prueba` and `Dataset/metadata_prueba` for local recommendations; you can change that source by editing the configuration in `backend/app.py`.

Would you like me to also add:
- step-by-step instructions specifically for Windows/WSL,
- example API request snippets,
- or a contribution and licensing section?

