# SonicMatch Frontend

SonicMatch is the frontend for a descriptor-based sound discovery project. The production goal is:

```text
user audio -> audio descriptors -> acoustic comparison -> dataset recommendations
```

The current app opens with a welcome screen, then runs in one compact dashboard: the user records or uploads audio, previews and trims it on a waveform, sends the selected audio to the local backend, and receives dataset recommendations.

When the backend is running, the frontend posts the selected audio to `POST /api/recommendations`. The backend extracts acoustic descriptors, compares them against the files in `Dataset/audio_prueba`, and returns only sounds from that dataset. The frontend does not use generic Freesound search for final recommendations.

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` inside `graphic_interface_v1`:

```env
VITE_BACKEND_API_BASE=http://127.0.0.1:8000/api
VITE_MAX_FILE_SIZE=52428800
VITE_SUPPORTED_FORMATS=wav,mp3,ogg,flac,m4a
```

There is also a `.env.example` with the same keys. Freesound metadata URLs can appear for dataset sounds that originally came from Freesound, but recommendations are not produced through global Freesound search.

## Commands

```bash
npm run dev
npm run build
npm run preview
```

Vite serves the app at `http://localhost:4173/`.

Start the backend from the repository root in another terminal:

```bash
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Or, from this `graphic_interface_v1` folder:

```bash
npm run backend
```

## Current Dashboard Flow

0. Welcome screen  
   Introduces SonicMatch, explains the Freesound requirement, and opens the dashboard.

1. Your sound  
   Record from the microphone or upload an audio file in the left panel.

2. Trim and preview  
   Keep the audio visible, generate a real waveform from the uploaded/recorded audio, select a region directly on the waveform, and play either the full audio or only the selected segment.

3. Recommendations  
   Send the selected audio segment to the backend and render the closest dataset sounds in the right panel without changing views.

4. Refine search  
   After results appear, open compact filters and update the results.

## Backend and Dataset Integration

The backend API is configured with `VITE_BACKEND_API_BASE`.

- Endpoint: `POST http://127.0.0.1:8000/api/recommendations`
- Payload: uploaded or recorded audio as WAV, `limit=4`
- Dataset source: `Dataset/audio_prueba`
- Metadata source: `Dataset/metadata_prueba`
- Cached features: `backend/cache/dataset_features.json`
- Response: recommendation objects shaped like Freesound sounds so the existing UI cards can render them without visual changes.
- Preview audio: local backend audio URLs served from the dataset.

Freesound is not used for generic search in the recommendation flow. Existing Freesound IDs and metadata are used only when they are already present in the dataset metadata.

## Filters

Filters live below the results in a compact refine section. They are kept in the UI for later expansion, but the current dataset recommendation is based on acoustic descriptors rather than global text search.

- Category, mood, duration, sort and license are preserved as UI state.
- The active backend recommendation currently ranks dataset sounds by descriptor similarity.
- The filter controls are ready to be connected to descriptor weighting or dataset filtering in a later iteration.

## Audio Trimming

Trimming is implemented visually in `src/components/AudioWaveform.tsx`. The component decodes the user audio with Web Audio, draws a real waveform on canvas, and lets the user drag a selectable region. The selected segment can be played back in the browser and is stored in shared state.

The frontend exports the selected audio segment as WAV before posting it to the backend, so the backend compares the selected region rather than the full browser recording container.

## Descriptor and Model Status

`src/services/audioAnalysisService.ts` is kept as a frontend-side future integration point for descriptor extraction. The active recommendation flow uses the backend descriptor extractor.

The local backend now extracts reusable acoustic descriptors for the dataset and compares them to the user's selected audio segment. It caches dataset features so they do not need to be recomputed on every request.

Essentia scripts exist in `audio_analysis/`, but Essentia is not installed in the current Windows Python environment. The backend therefore uses a NumPy/SoundFile descriptor extractor that follows the same acoustic-comparison idea and can be replaced or extended with Essentia later.

Pending work:

- Install/connect Essentia in the backend environment if the project wants to replace the current NumPy/SoundFile descriptors with the existing Essentia scripts.
- Expand the dataset beyond the 3 current files in `Dataset/audio_prueba`.
- Connect compact UI filters to descriptor weighting or metadata filtering.

## Structure

```text
graphic_interface_v1/
  src/
    App.tsx
    main.tsx
    components/
      Home.tsx
      Layout.tsx
      WelcomeScreen.tsx
      RecordUpload.tsx
      AudioWaveform.tsx
      Results.tsx
      SoundCard.tsx
      AudioUploadInput.tsx
      LoadingRecommendations.tsx
      LoadingSpinner.tsx
      ErrorBoundary.tsx
    context/
      AudioContext.tsx
      FreesoundContext.tsx
    hooks/
      useAudioRecorder.ts
      useFileUpload.ts
      useFreesound.ts
    services/
      audio.ts
      audioAnalysisService.ts
      freesound.ts
      types.ts
    styles/
      index.css
      tailwind.css
      theme.css
      fonts.css
  .env.example
  index.html
  package.json
  vite.config.ts
  README.md
```
