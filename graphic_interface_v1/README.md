# SonicMatch Frontend

SonicMatch is the frontend for a descriptor-based sound discovery project. The production goal is:

```text
user audio -> Essentia descriptors -> acoustic comparison -> Freesound recommendations
```

Essentia descriptor matching is not connected yet. The current app opens with a welcome screen, then runs in **Temporary Freesound search mode** inside one compact dashboard: the user records or uploads audio, previews and trims it on a waveform, searches Freesound, then refines the results with compact filters.

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` inside `Graphic interface`:

```env
VITE_FREESOUND_API_KEY=your_freesound_api_key
VITE_FREESOUND_API_BASE=https://freesound.org/apiv2
VITE_MAX_FILE_SIZE=52428800
VITE_SUPPORTED_FORMATS=wav,mp3,ogg,flac,m4a
```

There is also a `.env.example` with the same keys. The Freesound API key used for this class project is:

```env
VITE_FREESOUND_API_KEY=ouSAFjnK3KgXpIaCeBcWK8hcJnk2HCjNkIDRAeSb
```

## Commands

```bash
npm run dev
npm run build
npm run preview
```

Vite usually serves the app at `http://localhost:5173/`.

## Current Dashboard Flow

0. Welcome screen  
   Introduces SonicMatch, explains the Freesound requirement, and opens the dashboard.

1. Your sound  
   Record from the microphone or upload an audio file in the left panel.

2. Trim and preview  
   Keep the audio visible, generate a real waveform from the uploaded/recorded audio, select a region directly on the waveform, and play either the full audio or only the selected segment.

3. Freesound recommendations  
   Request 4 real Freesound results in the right panel without changing views.

4. Refine search  
   After results appear, open compact filters and update the results.

## Freesound Integration

The Freesound service is in `src/services/freesound.ts`.

- Endpoint: `GET https://freesound.org/apiv2/search/`
- Auth: `token` query parameter from `VITE_FREESOUND_API_KEY`
- Result count: `page_size=4`
- Returned fields include name, username, duration, tags, previews, waveform images, URL, license, date, downloads, ratings, comments, sample rate and channels.
- Errors are logged with technical details in the browser console, while the UI shows a clear user-facing message.

No result names, authors, ratings, durations or tags are invented. If Freesound does not provide waveform imagery, the UI renders a visual placeholder only.

## Filters

Filters live below the results in a compact refine section.

- Category changes the query text, for example `nature` or `percussion`.
- Mood changes the query text, for example `calm nature`.
- Duration adds Freesound duration filters when selected.
- Sort maps to Freesound sort values such as relevance, rating, downloads or recent.
- License currently adjusts the temporary query text; it is prepared for stricter API filtering later.

If no filters are selected, the app picks one temporary query from examples such as `ambient`, `rain`, `footsteps`, `synth`, `bass`, `city`, `nature`, `percussion`, `piano`, `wind`, `glitch`, `loop`, `texture`, `impact` or `drone`.

## Audio Trimming

Trimming is implemented visually in `src/components/AudioWaveform.tsx`. The component decodes the user audio with Web Audio, draws a real waveform on canvas, and lets the user drag a selectable region. The selected segment can be played back in the browser and is stored in shared state.

Current limitation: the frontend does not yet generate a physically trimmed audio Blob. That is prepared for a future iteration, when the selected segment can be exported and passed into the Essentia descriptor pipeline.

## Essentia Status

`src/services/audioAnalysisService.ts` is kept as the future integration point for descriptor extraction. It currently contains Web Audio fallback descriptor logic, but the active Freesound search mode does not claim real descriptor matching.

Pending work:

- Add Essentia or Essentia.js to the frontend build.
- Extract the final descriptor set from the selected segment.
- Use descriptors for acoustic comparison.
- Map descriptor results to Freesound search or similarity parameters.

## Structure

```text
Graphic interface/
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
