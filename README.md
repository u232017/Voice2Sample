# Voice2Sample

Voice2Sample is an application for producers who want to search for loops and sounds for their creations. It includes tools for dataset preparation, audio analysis with descriptors, machine learning models, and a web interface for testing.

## What the project does
- Dataset preparation (WAV conversion, CSV cleanup, JSON to CSV).
- Audio analysis with descriptors (timbre, rhythm, melody).
- Similarity search using embeddings and KNN.
- Web UI to upload or record audio and view results.

## General requirements
- Python 3.10+.
- Node.js 18+ (for the web interface).
- Python dependencies in [requeriments.txt](requeriments.txt).

## Requirements by area (Python)
- Dataset: `pandas`,`ffmpeg`.
- Audio analysis: `essentia`, `numpy`, `matplotlib`, `seaborn`, `scikit-learn`.
- Machine learning: `torch`, `transformers`, `librosa`, `scikit-learn`, `scipy`, `numpy`.
- Visualization: `npm`, `matplotlib`, `seaborn`.

Note: `essentia` does not provide official Windows binaries. On Windows, use WSL and set up a Linux environment with the `essentia` dependencies.

## Installation (Python)
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requeriments.txt
```

## Installation (Web interface)
```bash
cd "Graphic interface"
npm install
npm run dev
```

## Repository structure
Note: environment and dependency folders are included to reflect the full structure, even if their internal files are not listed.

```text
Voice2Sample/
├─ .git/
├─ .venv/
├─ .vscode/
├─ audio_analysis/
│  ├─ .venv/
│  ├─ __pycache__/
│  ├─ descriptors/
│  │  ├─ melodic_descriptors.json
│  │  ├─ music_descriptors.json
│  │  ├─ rhythmic_descriptors.json
│  │  └─ timbre_descriptors.json
│  ├─ audio.txt
│  ├─ general_features.py
│  ├─ main.py
│  ├─ melodic_features.py
│  ├─ pruebawa.wav
│  ├─ README.md
│  ├─ rhythmic_features.py
│  └─ timbre_features.py
├
├─ Dataset/
│  ├─ .venv/
│  ├─ audio_processed/
│  ├─ audio_prueba/
│  │  ├─ 114688.wav
│  │  ├─ 253959.mp3
│  │  └─ 40962.wav
│  ├─ Clean_csv/
│  │  ├─ __pycache__/
│  │  └─ csv_filter.py
│  ├─ Convert_audio_to_wav/
│  │  ├─ __pycache__/
│  │  ├─ detect_audio_extensiuons.py
│  │  └─ wav_convertor.py
│  ├─ Json_to_csv/
│  │  ├─ __pycache__/
│  │  └─ json_to_csv.py
│  ├─ Acknowledgements (need change).txt
│  ├─ main.py
│  ├─ metadata_prueba/
│  └─ readme.md
├─ evaluation/
│  └─ añgo.txt
├─ Graphic interface/
│  ├─ image/
│  │  └─ readme-assets/
│  │     └─ 1777977902041.png
│  ├─ node_modules/
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ AudioUploadInput.tsx
│  │  │  ├─ ErrorBoundary.tsx
│  │  │  ├─ Home.tsx
│  │  │  ├─ Layout.tsx
│  │  │  ├─ LoadingSpinner.tsx
│  │  │  ├─ RecordUpload.tsx
│  │  │  ├─ Results.tsx
│  │  │  └─ SoundCard.tsx
│  │  ├─ context/
│  │  │  ├─ AudioContext.tsx
│  │  │  └─ FreesoundContext.tsx
│  │  ├─ hooks/
│  │  │  ├─ useAudioRecorder.ts
│  │  │  ├─ useFileUpload.ts
│  │  │  └─ useFreesound.ts
│  │  ├─ services/
│  │  │  ├─ audio.ts
│  │  │  ├─ audioAnalysisService.ts
│  │  │  ├─ freesound.ts
│  │  │  └─ types.ts
│  │  ├─ styles/
│  │  │  ├─ fonts.css
│  │  │  ├─ index.css
│  │  │  ├─ tailwind.css
│  │  │  └─ theme.css
│  │  ├─ App.tsx
│  │  ├─ main.tsx
│  │  └─ vite-env.d.ts
│  ├─ .env.example
│  ├─ .gitignore
│  ├─ index.html
│  ├─ interface-flow.md
│  ├─ package.json
│  ├─ pnpm-workspace.yaml
│  ├─ postcss.config.mjs
│  ├─ README.md
│  ├─ tailwind.config.js
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  └─ vite.config.ts
├─ graphic_interface_v1/
│  └─ node_modules/
├─ graphic_interface_v2/
│  └─ holi.txt
├─ Machine_learning/
│  ├─ base_datos_audios/
│  │  ├─ 246288__afleetingspeck__open-e-guitar-chord-hit-percussion.wav
│  │  ├─ 339787__djfroyd__groovy-synth-drum-loop.wav
│  │  ├─ 423867__uzbazur__oliviolin-bowed.wav
│  │  ├─ 646823__josefpres__virtual-instrument-002-v02-11-g2.wav
│  │  └─ 735631__sensacionarsm__shhhh-silence.wav
│  ├─ Deep_learning/
│  │  ├─ base_datos_audios/
│  │  ├─ __pycache__/
│  │  │  └─ modelo_ml.cpython-313.pyc
│  │  ├─ embeddings_cache.npz
│  │  └─ modelo_ml.py
│  ├─ mi_imitacion.wav
│  ├─ modelo_ml.py
│  ├─ README.md
│  └─ requeriments.txt
|
├─ .gitignore
├─ README.md
└─ requeriments.txt
```

## License
Add a license when the project requires it.
