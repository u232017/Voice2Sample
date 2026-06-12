# Voice2Sample

Voice2Sample is a project for producers and developers that makes it easy to search and compare loops, samples, and short audio fragments by extracting acoustic descriptors, processing metadata, and using similarity models. The repository contains tools to prepare datasets, extract musical descriptors, train or run machine learning models, and a web interface to test recommendations.

**Summary of features**
- Dataset preparation: convert audio to WAV, clean metadata, and generate CSV files ready for ML.
- Extraction of acoustic and musical descriptors (timbre, rhythm, melodic) from `audio_analysis/` (librosa in real time; Essentia for the offline corpus descriptors).
- Search for similar samples based on descriptors (Essentia KNN) and semantic embeddings (CLAP).
- Backend API that serves recommendations and a frontend for visualization and interaction.

**Dataset used in this repository**
- The main collection lives in the `Dataset/` folder.
	- `Dataset/audio_processed/`: the processed WAV corpus (48 kHz). **Not versioned in git** — download it with `Dataset/download_dataset/zenodo_downloader.py` or place your own audio there.
	- `Dataset/Clean_csv/metadata.csv`: metadata for every sound (original Freesound name, author, license, tags, BPM).
- The search databases derived from the corpus **are versioned**: KNN models (`audio_processing/Processing/models/`), descriptor JSONs (`audio_analysis/descriptors/`) and CLAP embeddings (`Dataset/embeddings_output.json`), so a fresh clone can run searches without retraining anything.

**Repository highlights**
- `audio_analysis/` — Descriptor extraction (used both in real time by the backend for each query and in batch by `regenerate_descriptors.py` to build `descriptors/` and retrain the models).
- `Dataset/` — Audio conversion, JSON→CSV conversion, cleaning and validation (main pipeline in `Dataset/main.py`), plus the Zenodo downloader.
- `audio_processing/Processing/` — KNN similarity models (`train_models.py`, `inference.py`, `models/`).
- `audio_processing/CLAP/` — CLAP semantic search: original prototype and `regenerate_clap_embeddings.py` to rebuild the embeddings database.
- `backend/` — FastAPI backend exposing the recommendation and similarity-map endpoints (Essentia KNN + CLAP engines).
- `graphic_interface_v1/` — Web interface (Vite + React/TypeScript) for uploading/recording audio and displaying results.
- `Evaluation/` — Quantitative evaluation comparing Essentia KNN vs CLAP (methodology in `Evaluation/README.md`).

**Quick installation and run guide**

> Use WSL (or Linux): `essentia` is only distributed through pip for Linux, and the pinned versions in `requirements.txt` were verified on Python 3.12 under WSL.

1. Create and activate a Python environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies (single requirements file for the whole project):

```bash
pip install -r requirements.txt
```

3. Download the audio corpus (only the WAVs are missing from git):

```bash
python Dataset/download_dataset/zenodo_downloader.py
# the files must end up in Dataset/audio_processed/ (see Dataset/readme.md)
```

4. Run the backend API (from the repository root):

```bash
uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

   - The first start builds a feature cache for the corpus (a few minutes); later starts are fast.
   - CLAP loads in the background: wait for `CLAP model loaded — real embedding search enabled` in the log before testing CLAP searches.

5. Start the web interface (second terminal):

```bash
cd graphic_interface_v1
npm install
npm run dev
# opens http://localhost:4173
```

6. (Optional) Quantitative evaluation Essentia vs CLAP:

```bash
python Evaluation/evaluacion_cuantitativa.py \
    --me-json    audio_analysis/descriptors/music_all.json \
    --models-dir audio_processing/Processing/models \
    --clap-json  Dataset/embeddings_output.json \
    --top-k 5
```

**Rebuilding the search databases (only if the corpus changes)**

The query-time extractors and the database must always come from the same functions, so both rebuild scripts reuse the production extractors:

```bash
# Descriptors + KNN models (resumable, writes the analysis reports to reports/)
python audio_analysis/regenerate_descriptors.py --retrain

# CLAP embeddings (resumable)
python audio_processing/CLAP/regenerate_clap_embeddings.py
```

Restart the backend afterwards.

**Important notes**
- `essentia` does not provide official Windows binaries; use WSL (see `audio_analysis/README.md` and `Dataset/readme.md`).
- The KNN `.joblib` models were trained with scikit-learn 1.9.0 (pinned in `requirements.txt`); unpickling them with another version may give inconsistent results.
- Make sure `ffmpeg` is installed for audio conversions.
- The backend reads the corpus from `Dataset/audio_processed/` and the metadata from `Dataset/Clean_csv/metadata.csv` (or `Dataset/metadata_filtered.csv` if present); both paths are configured at the top of `backend/app.py`.
