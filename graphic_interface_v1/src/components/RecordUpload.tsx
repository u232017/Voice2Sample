import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  FileAudio,
  Mic,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
  Upload,
} from 'lucide-react';
import { SoundCard } from './SoundCard';
import { AudioWaveform } from './AudioWaveform';
import { LoadingRecommendations } from './LoadingRecommendations';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useFileUpload } from '../hooks/useFileUpload';
import { defaultSearchFilters, useAudio } from '../context/AudioContext';
import { useFreesound } from '../hooks/useFreesound';
import {
  FreesoundSearchFilters,
  RecordedAudio,
  SearchCategory,
  SearchDuration,
  SearchMood,
  SearchSort,
} from '../services/types';
import { audioService } from '../services/audio';

const categories: SearchCategory[] = ['any', 'nature', 'urban', 'music loop', 'foley', 'synth', 'percussion'];
const moods: SearchMood[] = ['any', 'calm', 'dark', 'bright', 'energetic'];
const durations: SearchDuration[] = ['any', 'short', 'medium', 'long'];
const sorts: SearchSort[] = ['relevance', 'rating', 'downloads', 'recent'];

const labels: Record<string, string> = {
  any: 'Any',
  nature: 'Nature',
  urban: 'Urban',
  'music loop': 'Music loop',
  foley: 'Foley',
  synth: 'Synth',
  percussion: 'Percussion',
  calm: 'Calm',
  dark: 'Dark',
  bright: 'Bright',
  energetic: 'Energetic',
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
  relevance: 'Relevance',
  rating: 'Rating',
  downloads: 'Downloads',
  recent: 'Recent',
};

export function RecordUpload() {
  const { setCurrentAudio, setSearchRequest, setTrimSelection } = useAudio();
  const { results, isLoading, error, searchExamples, clearResults } = useFreesound();
  const recorder = useAudioRecorder();
  const fileUpload = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchDelayRef = useRef<number | null>(null);
  const searchDelayResolveRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const [currentAudio, setLocalAudio] = useState<RecordedAudio | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchTransition, setIsSearchTransition] = useState(false);
  const [filters, setFilters] = useState<FreesoundSearchFilters>(defaultSearchFilters);

  const audioUrl = useMemo(() => {
    if (!currentAudio) return null;
    return URL.createObjectURL(currentAudio.blob);
  }, [currentAudio]);

  const duration = Math.max(0, currentAudio?.metadata.duration || 0);
  const isValidTrim = currentAudio ? trimStart < trimEnd && trimEnd <= duration : false;
  const isRecommendationLoading = isSearchTransition || isLoading;
  const status = recorder.isRecording ? 'recording' : currentAudio ? 'audio ready' : 'no audio';

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (searchDelayRef.current) {
        window.clearTimeout(searchDelayRef.current);
        searchDelayResolveRef.current?.();
      }
    };
  }, []);

  useEffect(() => {
    setCurrentAudio(currentAudio);

    if (currentAudio) {
      const end = Math.max(0, currentAudio.metadata.duration);
      setTrimStart(0);
      setTrimEnd(end);
      setTrimSelection({ start: 0, end });
      clearResults();
    }
  }, [currentAudio, setCurrentAudio, setTrimSelection, clearResults]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
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

  const handleRecord = async () => {
    if (recorder.isRecording) {
      const audio = await recorder.stopRecording();
      if (audio) setLocalAudio(audio);
      return;
    }

    const started = await recorder.startRecording();
    if (started) {
      setLocalAudio(null);
    }
  };

  const handleFileSelected = async (file?: File) => {
    if (!file) return;
    const audio = await fileUpload.uploadFile(file);
    if (audio) setLocalAudio(audio);
  };

  const resetAudio = () => {
    setLocalAudio(null);
    setCurrentAudio(null);
    setTrimSelection(null);
    clearResults();
  };

  const runSearch = async () => {
    if (!currentAudio || !isValidTrim || isRecommendationLoading) return;

    const request = { query: '', filters, limit: 4 };
    const minimumLoadingTime = new Promise<void>((resolve) => {
      searchDelayResolveRef.current = resolve;
      searchDelayRef.current = window.setTimeout(() => {
        searchDelayRef.current = null;
        searchDelayResolveRef.current = null;
        resolve();
      }, 3000);
    });

    setIsSearchTransition(true);
    setSearchRequest(request);
    setTrimSelection({ start: trimStart, end: trimEnd });

    try {
      await Promise.all([searchExamples(request), minimumLoadingTime]);
    } finally {
      searchDelayRef.current = null;
      searchDelayResolveRef.current = null;
      if (isMountedRef.current) {
        setIsSearchTransition(false);
      }
    }
  };

  return (
    <section className="app-page dashboard-page">
      <div className="dashboard-shell">
        <section className="dashboard-panel user-sound-panel">
          <div className="panel-heading">
            <div>
              <p>Your sound</p>
              <h1>{currentAudio ? currentAudio.name || 'Recorded sample' : 'Record or upload'}</h1>
            </div>
            <span className={`status-pill ${recorder.isRecording ? 'recording' : currentAudio ? 'ready' : ''}`}>
              {status}
            </span>
          </div>

          <div className="quick-actions">
            <button className={recorder.isRecording ? 'danger-action' : 'primary-action'} onClick={handleRecord}>
              {recorder.isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {recorder.isRecording ? 'Stop' : 'Record'}
            </button>
            <button className="secondary-action" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-5 w-5" />
              Upload
            </button>
            {currentAudio && (
              <button className="ghost-action" onClick={resetAudio}>
                <RotateCcw className="h-5 w-5" />
                Reset
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => handleFileSelected(event.target.files?.[0])}
            />
          </div>

          {(recorder.error || fileUpload.error) && (
            <div className="status-message error compact-error">
              <AlertCircle className="h-5 w-5" />
              <p>{recorder.error || fileUpload.error}</p>
            </div>
          )}

          <div className="user-wave-card">
            {audioUrl ? (
              <AudioWaveform
                audioUrl={audioUrl}
                duration={duration}
                selectedStart={trimStart}
                selectedEnd={trimEnd}
                onRegionChange={applyTrim}
              />
            ) : (
              <div className="record-meter compact-meter">
                <div>
                  <p className="font-mono text-3xl font-bold text-white">
                    {recorder.isRecording ? audioService.formatDuration(recorder.duration) : '00:00'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {recorder.isRecording ? 'Recording from microphone' : 'Waiting for audio'}
                  </p>
                </div>
                <div className="empty-sound-note">
                  <FileAudio className="h-5 w-5" />
                  Add audio to generate a waveform.
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="dashboard-panel freesound-panel">
          <div className="panel-heading">
            <div>
              <p>Freesound recommendations</p>
              <h2>{results.length ? '4 real sounds' : 'Ready when you are'}</h2>
            </div>
            <span className="tiny-note">Temporary search · Essentia pending</span>
          </div>

          <button className="primary-action search-main-button" onClick={runSearch} disabled={!currentAudio || !isValidTrim || isRecommendationLoading}>
            <Search className="h-5 w-5" />
            {isRecommendationLoading ? 'Searching...' : 'Search 4 Freesound sounds'}
          </button>

          {isRecommendationLoading && <LoadingRecommendations />}

          {error && !isRecommendationLoading && (
            <div className="status-message error compact-error">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}

          {!currentAudio && !isRecommendationLoading && (
            <div className="recommendation-empty">
              <FileAudio className="h-7 w-7" />
              <p>Record or upload a sound to get recommendations.</p>
            </div>
          )}

          {currentAudio && !isRecommendationLoading && !error && results.length === 0 && (
            <div className="recommendation-empty">
              <Search className="h-7 w-7" />
              <p>Search Freesound when your sample is ready.</p>
            </div>
          )}

          {!isRecommendationLoading && results.length > 0 && (
            <>
              <div className="recommendation-list">
                {results.slice(0, 4).map((sound) => (
                  <SoundCard key={sound.id} sound={sound} />
                ))}
              </div>

              <div className="refine-box">
                <button className="refine-toggle" onClick={() => setShowFilters((value) => !value)}>
                  <SlidersHorizontal className="h-4 w-4" />
                  Refine search
                </button>

                {showFilters && (
                  <div className="chip-filter-group">
                    <ChipGroup label="Category" options={categories} value={filters.category} onChange={(value) => updateFilter('category', value as SearchCategory)} />
                    <ChipGroup label="Mood" options={moods} value={filters.mood} onChange={(value) => updateFilter('mood', value as SearchMood)} />
                    <ChipGroup label="Duration" options={durations} value={filters.duration} onChange={(value) => updateFilter('duration', value as SearchDuration)} />
                    <ChipGroup label="Sort" options={sorts} value={filters.sort} onChange={(value) => updateFilter('sort', value as SearchSort)} />
                    <button className="secondary-action small-action" onClick={runSearch} disabled={isRecommendationLoading}>
                      Update results
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

interface ChipGroupProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

function ChipGroup({ label, options, value, onChange }: ChipGroupProps) {
  return (
    <div className="chip-row">
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            key={option}
            className={value === option ? 'active' : ''}
            onClick={() => onChange(option)}
          >
            {labels[option] || option}
          </button>
        ))}
      </div>
    </div>
  );
}
