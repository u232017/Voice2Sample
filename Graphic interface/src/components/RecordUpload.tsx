import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileAudio,
  Mic,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
} from 'lucide-react';
import { AudioUploadInput } from './AudioUploadInput';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useFileUpload } from '../hooks/useFileUpload';
import { defaultSearchFilters, useAudio } from '../context/AudioContext';
import {
  FreesoundSearchFilters,
  RecordedAudio,
  SearchCategory,
  SearchDuration,
  SearchLicense,
  SearchMood,
  SearchSort,
} from '../services/types';
import { audioService } from '../services/audio';

interface RecordUploadProps {
  initialMode?: 'record' | 'upload';
  onAnalyze: () => void;
  onBack: () => void;
}

const categories: SearchCategory[] = [
  'any',
  'ambience',
  'music loop',
  'foley',
  'nature',
  'urban',
  'percussion',
  'synth',
  'voice',
];
const moods: SearchMood[] = ['any', 'calm', 'dark', 'bright', 'energetic', 'mysterious'];
const durations: SearchDuration[] = ['any', 'short', 'medium', 'long'];
const sorts: SearchSort[] = ['relevance', 'rating', 'downloads', 'recent'];
const licenses: SearchLicense[] = ['any', 'creative_commons', 'commercial_friendly'];

const labels: Record<string, string> = {
  any: 'Any',
  ambience: 'Ambience',
  'music loop': 'Music loop',
  foley: 'Foley',
  nature: 'Nature',
  urban: 'Urban',
  percussion: 'Percussion',
  synth: 'Synth',
  voice: 'Voice',
  calm: 'Calm',
  dark: 'Dark',
  bright: 'Bright',
  energetic: 'Energetic',
  mysterious: 'Mysterious',
  short: 'Short < 5s',
  medium: 'Medium 5s - 30s',
  long: 'Long > 30s',
  relevance: 'Relevance',
  rating: 'Rating',
  downloads: 'Downloads',
  recent: 'Recent',
  creative_commons: 'Creative Commons',
  commercial_friendly: 'Commercial friendly',
};

export function RecordUpload({ initialMode = 'record', onAnalyze, onBack }: RecordUploadProps) {
  const { setCurrentAudio, setSearchRequest, setTrimSelection } = useAudio();
  const recorder = useAudioRecorder();
  const fileUpload = useFileUpload();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mode, setMode] = useState<'record' | 'upload'>(initialMode);
  const [currentAudio, setLocalAudio] = useState<RecordedAudio | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [filters, setFilters] = useState<FreesoundSearchFilters>(defaultSearchFilters);

  const audioUrl = useMemo(() => {
    if (!currentAudio) return null;
    return URL.createObjectURL(currentAudio.blob);
  }, [currentAudio]);

  const duration = Math.max(0, currentAudio?.metadata.duration || 0);
  const isValidTrim = currentAudio ? trimStart < trimEnd && trimEnd <= duration : false;

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setCurrentAudio(currentAudio);

    if (currentAudio) {
      setTrimStart(0);
      setTrimEnd(Math.max(0, currentAudio.metadata.duration));
      setTrimSelection({ start: 0, end: Math.max(0, currentAudio.metadata.duration) });
    }
  }, [currentAudio, setCurrentAudio, setTrimSelection]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const updateFilter = <Key extends keyof FreesoundSearchFilters>(
    key: Key,
    value: FreesoundSearchFilters[Key]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyTrim = (start: number, end: number) => {
    const safeStart = Math.min(Math.max(0, start), duration);
    const safeEnd = Math.min(Math.max(0, end), duration);
    setTrimStart(safeStart);
    setTrimEnd(safeEnd);
    setTrimSelection({ start: safeStart, end: safeEnd });
  };

  const handleStartRecording = async () => {
    const started = await recorder.startRecording();
    if (started) {
      setLocalAudio(null);
    }
  };

  const handleStopRecording = async () => {
    const audio = await recorder.stopRecording();
    if (audio) {
      setLocalAudio(audio);
    }
  };

  const handleFileSelected = async (file: File) => {
    const audio = await fileUpload.uploadFile(file);
    if (audio) {
      setLocalAudio(audio);
      setMode('upload');
    }
  };

  const resetAudio = () => {
    setLocalAudio(null);
    setCurrentAudio(null);
    setTrimSelection(null);
  };

  const resetTrim = () => {
    applyTrim(0, duration);
  };

  const playSelectedSegment = async () => {
    const player = audioRef.current;
    if (!player || !isValidTrim) return;
    player.currentTime = trimStart;
    await player.play();
  };

  const handleTimeUpdate = () => {
    const player = audioRef.current;
    if (!player) return;

    if (player.currentTime >= trimEnd) {
      player.pause();
      player.currentTime = trimStart;
    }
  };

  const submitSearch = () => {
    setSearchRequest({
      query: '',
      filters,
      limit: 4,
    });
    setTrimSelection({ start: trimStart, end: trimEnd });
    onAnalyze();
  };

  return (
    <section className="app-page">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <button onClick={onBack} className="ghost-action mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </button>

        <div className="flow-steps mb-8">
          <div className="active">
            <span>1</span>
            <p>Choose audio</p>
          </div>
          <div className={currentAudio ? 'active' : ''}>
            <span>2</span>
            <p>Trim and preview</p>
          </div>
          <div className={currentAudio ? 'active' : ''}>
            <span>3</span>
            <p>Search Freesound</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="space-y-5">
            <div>
              <p className="section-kicker">Audio input</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight text-white md:text-5xl">
                Record or upload a sound to start
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Preview your audio, trim the part you want to use, choose optional search filters,
                then find 4 real sounds from Freesound.
              </p>
            </div>

            <div className="segmented-control">
              <button
                className={mode === 'record' ? 'active' : ''}
                onClick={() => setMode('record')}
                disabled={recorder.isRecording}
              >
                <Mic className="h-4 w-4" />
                Record
              </button>
              <button
                className={mode === 'upload' ? 'active' : ''}
                onClick={() => setMode('upload')}
                disabled={recorder.isRecording}
              >
                <FileAudio className="h-4 w-4" />
                Upload
              </button>
            </div>

            <div className="notice-card">
              Temporary Freesound search mode enabled. Essentia descriptor matching will be
              connected later.
            </div>
          </aside>

          <div className="workspace-panel">
            {mode === 'record' ? (
              <div className="input-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Record from microphone</h2>
                    <p className="mt-1 text-sm text-slate-300">
                      Status:{' '}
                      {recorder.isRecording
                        ? 'recording'
                        : currentAudio?.source === 'recording'
                          ? 'recording ready'
                          : 'ready to record'}
                    </p>
                  </div>
                  <div className={`record-indicator ${recorder.isRecording ? 'recording' : ''}`} />
                </div>

                <div className="record-meter mt-5">
                  <div>
                    <p className="font-mono text-5xl font-bold text-white">
                      {audioService.formatDuration(recorder.duration)}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Browser permission is requested when recording starts.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  {!recorder.isRecording ? (
                    <button className="primary-action" onClick={handleStartRecording}>
                      <Mic className="h-5 w-5" />
                      Start recording
                    </button>
                  ) : (
                    <button className="danger-action" onClick={handleStopRecording}>
                      <Square className="h-5 w-5" />
                      Stop recording
                    </button>
                  )}
                  {currentAudio && (
                    <button className="secondary-action" onClick={resetAudio}>
                      <RotateCcw className="h-5 w-5" />
                      Reset sample
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="input-card">
                <h2 className="text-2xl font-bold text-white">Upload audio file</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Select a local audio file and preview it before searching.
                </p>
                <div className="mt-5">
                  <AudioUploadInput onFileSelected={handleFileSelected} isLoading={fileUpload.isLoading} />
                </div>
              </div>
            )}

            {(recorder.error || fileUpload.error) && (
              <div className="status-message error">
                <AlertCircle className="h-5 w-5" />
                <p>{recorder.error || fileUpload.error}</p>
              </div>
            )}

            {!currentAudio && (
              <div className="empty-inline">
                <FileAudio className="h-6 w-6 text-cyan-200" />
                <p>No audio loaded yet. Record or upload a sound to unlock preview, trimming and filters.</p>
              </div>
            )}

            {currentAudio && audioUrl && (
              <div className="preview-panel">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-lime-200">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-semibold">Audio ready to preview</span>
                    </div>
                    <h3 className="mt-2 text-xl font-bold text-white">
                      {currentAudio.name || 'Recorded sample'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {audioService.formatPreciseDuration(duration)} ·{' '}
                      {(currentAudio.metadata.sampleRate / 1000).toFixed(1)} kHz ·{' '}
                      {currentAudio.metadata.channels} channel
                      {currentAudio.metadata.channels === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-sm font-semibold text-cyan-100">
                    {currentAudio.source === 'recording' ? 'Recording' : 'Uploaded file'}
                  </div>
                </div>

                <audio
                  ref={audioRef}
                  className="mt-5 w-full"
                  src={audioUrl}
                  controls
                  preload="metadata"
                  onTimeUpdate={handleTimeUpdate}
                />

                <div className="trim-card">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-white">Trim and preview</h4>
                      <p className="text-sm text-slate-300">
                        Selected segment: {audioService.formatPreciseDuration(trimStart)} -{' '}
                        {audioService.formatPreciseDuration(trimEnd)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button className="secondary-action" onClick={playSelectedSegment} disabled={!isValidTrim}>
                        Play segment
                      </button>
                      <button className="ghost-action" onClick={resetTrim}>
                        Reset trim
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="range-control">
                      <span>Start time</span>
                      <input
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={trimStart}
                        onChange={(event) => applyTrim(Number(event.target.value), trimEnd)}
                      />
                      <input
                        type="number"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={trimStart.toFixed(1)}
                        onChange={(event) => applyTrim(Number(event.target.value), trimEnd)}
                      />
                    </label>

                    <label className="range-control">
                      <span>End time</span>
                      <input
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={trimEnd}
                        onChange={(event) => applyTrim(trimStart, Number(event.target.value))}
                      />
                      <input
                        type="number"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={trimEnd.toFixed(1)}
                        onChange={(event) => applyTrim(trimStart, Number(event.target.value))}
                      />
                    </label>
                  </div>

                  {!isValidTrim && (
                    <p className="mt-3 text-sm text-amber-100">Start time must be lower than end time.</p>
                  )}
                </div>

                <div className="filters-card">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-lime-300 text-slate-950">
                      <SlidersHorizontal className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">Choose optional search filters</h4>
                      <p className="text-sm text-slate-300">
                        These controls shape the temporary Freesound query.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FilterSelect
                      label="Category"
                      value={filters.category}
                      options={categories}
                      onChange={(value) => updateFilter('category', value as SearchCategory)}
                    />
                    <FilterSelect
                      label="Mood"
                      value={filters.mood}
                      options={moods}
                      onChange={(value) => updateFilter('mood', value as SearchMood)}
                    />
                    <FilterSelect
                      label="Duration"
                      value={filters.duration}
                      options={durations}
                      onChange={(value) => updateFilter('duration', value as SearchDuration)}
                    />
                    <FilterSelect
                      label="Sort"
                      value={filters.sort}
                      options={sorts}
                      onChange={(value) => updateFilter('sort', value as SearchSort)}
                    />
                    <FilterSelect
                      label="License"
                      value={filters.license}
                      options={licenses}
                      onChange={(value) => updateFilter('license', value as SearchLicense)}
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button className="primary-action" onClick={submitSearch} disabled={!isValidTrim}>
                    <Search className="h-5 w-5" />
                    Search 4 Freesound examples
                  </button>
                  <p className="text-sm text-slate-300">
                    Using temporary Freesound search until Essentia descriptor matching is connected.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] || option}
          </option>
        ))}
      </select>
    </label>
  );
}
