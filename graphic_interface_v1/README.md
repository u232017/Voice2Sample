# SonicMatch Frontend

SonicMatch is the React/Vite frontend for Voice2Sample. It runs entirely in the browser: the app records or uploads audio, creates a waveform preview, trims the selected region, derives a lightweight audio-search hint, and asks Freesound for real previewable sound results.

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` inside `graphic_interface_v1`:

```env
VITE_FREESOUND_API_KEY=your_freesound_api_key_here
VITE_FREESOUND_API_BASE=https://freesound.org/apiv2
VITE_MAX_FILE_SIZE=52428800
VITE_SUPPORTED_FORMATS=wav,mp3,ogg,flac,m4a
```

There is also a `.env.example` with the same keys.

## Commands

```bash
npm run dev
npm run build
npm run preview
```

Vite serves the app locally, normally at `http://localhost:5173/`.

## Current Dashboard Flow

1. Welcome screen  
   Opens the focused audio dashboard.

2. Your sound  
   Record from the microphone or upload an audio file.

3. Trim and preview  
   Decode the audio in the browser, draw a waveform, select a region, and play the full audio or selected segment.

4. Recommendations  
   Analyze the browser audio with the frontend fallback descriptors and search Freesound for related sounds.

5. Refine search  
   UI filters are preserved for category, mood, duration, sort, and license.

## Freesound Integration

The active recommendation flow uses `src/services/recommendations.ts`, `src/services/audioAnalysisService.ts`, and `src/services/freesound.ts`.

- Audio analysis runs in the browser through Web Audio.
- The generated query is sent to Freesound's `/search/` endpoint.
- Results are limited to 4 sounds.
- Preview audio and visualizations come directly from Freesound response metadata.

## Descriptor Status

`src/services/audioAnalysisService.ts` extracts a small fallback descriptor summary from the uploaded or recorded audio. It is intentionally lightweight so the frontend works without Python services.

The Python descriptor and machine learning folders remain in the repository for experiments, but they are not required to run this interface.

## Structure

```text
graphic_interface_v1/
  src/
    App.tsx
    main.tsx
    components/
      AudioUploadInput.tsx
      AudioWaveform.tsx
      BrandLogo.tsx
      ErrorBoundary.tsx
      FallingNotesBackground.tsx
      Layout.tsx
      LoadingRecommendations.tsx
      LoadingSpinner.tsx
      RecordUpload.tsx
      Results.tsx
      SoundCard.tsx
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
      freesound.ts
      recommendations.ts
      types.ts
    styles/
      fonts.css
      index.css
      tailwind.css
      theme.css
  .env.example
  index.html
  package.json
  vite.config.ts
```
