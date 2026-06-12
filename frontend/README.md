# SonicMatch Frontend

SonicMatch is the React/Vite frontend for Voice2Sample. The app records or uploads audio, creates a waveform preview, trims the selected region, analyzes it in the browser with Essentia.js, and asks the Voice2Sample backend for similar sounds from the local dataset (Acoustic Search or CLAP engine). Freesound metadata is used to enrich the result cards (names, tags, visualizations).

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` inside `frontend`:

```env
VITE_FREESOUND_API_KEY=your_freesound_api_key_here
VITE_FREESOUND_API_BASE=https://freesound.org/apiv2
VITE_MAX_FILE_SIZE=52428800
VITE_SUPPORTED_FORMATS=wav,mp3,ogg,flac,m4a
```

Optionally, `VITE_BACKEND_API_BASE` can point to the backend API; by default the dev server proxies `/api` to `http://127.0.0.1:8000` (see `vite.config.ts`), so just start the backend on port 8000.

## Commands

```bash
npm run dev
npm run build
npm run preview
```

Vite serves the app locally at `http://localhost:4173/`.

## Current Dashboard Flow

1. Welcome screen  
   Opens the focused audio dashboard.

2. Your sound  
   Record from the microphone or upload an audio file.

3. Trim and preview  
   Decode the audio in the browser, draw a waveform, select a region, and play the full audio or selected segment.

4. Descriptor analysis  
   Analyze the selected audio segment with Essentia.js descriptors when the user starts analysis.

5. Recommendations  
   Choose the Acoustic Search or CLAP engine and a similarity focus (general, melodic, bpm, timbre), search the backend, and preview the resulting dataset sounds. A 2D similarity map (`SoundMap`) shows the nearest neighbours of the query.

## Backend and Freesound Integration

The active recommendation flow uses `src/services/recommendations.ts`, `src/services/audioAnalysisService.ts`, and `src/services/freesound.ts`.

- Audio analysis runs in the browser through Web Audio and Essentia.js (display card only; the backend extracts its own features for the search).
- Recommendations come from the local backend (`POST /api/recommendations`, max 4 results) and the similarity map from `POST /api/map-results` (up to 50 neighbours).
- Preview audio is served by the backend (`GET /api/dataset-audio/{filename}`).
- Freesound metadata (names, tags, spectrogram images) enriches the result cards when available.

## Descriptor Status

`src/services/audioAnalysisService.ts` extracts descriptor values from the uploaded or recorded audio and keeps the frontend flow independent from Python-only descriptor scripts.

The Python descriptor and machine learning folders remain in the repository for experiments, but they are not required to run this interface.

## Structure

```text
frontend/
  src/
    App.tsx
    main.tsx
    components/
      AudioOrbVisualizer.tsx
      AudioWaveform.tsx
      BrandLogo.tsx
      ErrorBoundary.tsx
      FallingNotesBackground.tsx
      Layout.tsx
      LoadingRecommendations.tsx
      QuickAudioAnalysis.tsx
      RecordUpload.tsx
      SoundCard.tsx
      SoundMap.tsx
      WelcomeScreen.tsx
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
      essentiaWorker.ts
      freesound.ts
      recommendations.ts
      types.ts
    styles/
      frontend-redesign.css
      fonts.css
      index.css
      quick-audio-analysis.css
      sound-map.css
      tailwind.css
      theme.css
  .env.example
  index.html
  package.json
  vite.config.ts
```
