import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  FileAudio,
  Mic,
  RotateCcw,
  Search,
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
import { RecordedAudio } from '../services/types';
import { audioService, MAX_RECORDING_DURATION_SECONDS } from '../services/audio';

type SimilarityFocus = 'melodic' | 'bpm' | 'timbre' | 'energy';
type RecommendationModel = 'essentia' | 'clap';

interface SoundCharacteristicsPreview {
  estimatedBpm: string;
  mainCharacter: string;
  energy: string;
  pitchRange: string;
}

const similarityOptions: Array<{ label: string; value: SimilarityFocus }> = [
  { label: 'Melodic', value: 'melodic' },
  { label: 'BPM', value: 'bpm' },
  { label: 'Timbre', value: 'timbre' },
  { label: 'Energy', value: 'energy' },
];
const recommendationModelOptions: Array<{ label: string; value: RecommendationModel }> = [
  { label: 'Essentia', value: 'essentia' },
  { label: 'CLAP', value: 'clap' },
];
const recommendationModelDescriptions: Record<RecommendationModel, string> = {
  essentia:
    'Essentia extracts traditional audio features such as rhythm, timbre, pitch, energy, and spectral information. With this model, you can choose which characteristic should be prioritized, so the filters below are available when Essentia is selected.',
  clap:
    'CLAP represents the sound as a complete audio embedding and compares that full vector with sounds in our dataset. Because it uses the whole sound representation at once, the individual similarity filters are not needed.',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function RecordUpload() {
  const { setCurrentAudio, setSearchRequest, setTrimSelection } = useAudio();
  const { results, isLoading, error, searchExamples, clearResults } = useFreesound();
  const recorder = useAudioRecorder();
  const fileUpload = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchDelayRef = useRef<number | null>(null);
  const searchDelayResolveRef = useRef<(() => void) | null>(null);
  const autoStopPendingRef = useRef(false);
  const isMountedRef = useRef(true);
  const [currentAudio, setLocalAudio] = useState<RecordedAudio | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isSearchTransition, setIsSearchTransition] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [similarityFocus, setSimilarityFocus] = useState<SimilarityFocus>('melodic');
  const [recommendationModel, setRecommendationModel] = useState<RecommendationModel>('essentia');
  const [activeModelTooltip, setActiveModelTooltip] = useState<RecommendationModel | null>(null);
  const [autoStopNotice, setAutoStopNotice] = useState(false);
  const [characteristics, setCharacteristics] = useState<SoundCharacteristicsPreview | null>(null);

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
    setHasSearched(false);

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

  useEffect(() => {
    if (!recorder.isRecording || autoStopPendingRef.current) {
      return;
    }

    if (recorder.duration < MAX_RECORDING_DURATION_SECONDS) {
      return;
    }

    autoStopPendingRef.current = true;
    setAutoStopNotice(true);

    recorder
      .stopRecording()
      .then((audio) => {
        if (audio) {
          setLocalAudio(audio);
        }
      })
      .finally(() => {
        autoStopPendingRef.current = false;
      });
  }, [recorder.duration, recorder.isRecording, recorder.stopRecording]);

  useEffect(() => {
    if (!currentAudio) {
      setCharacteristics(null);
      return;
    }

    let cancelled = false;

    const generateCharacteristics = async () => {
      try {
        const audioBuffer = await audioService.decodeAudio(currentAudio.blob);
        if (cancelled) return;

        const channel = audioBuffer.getChannelData(0);
        const length = channel.length;
        if (!length) {
          setCharacteristics(null);
          return;
        }

        let sumSquares = 0;
        let zeroCrossings = 0;
        for (let index = 0; index < length; index += 1) {
          const sample = channel[index];
          sumSquares += sample * sample;
          if (index > 0) {
            const prev = channel[index - 1];
            if ((prev <= 0 && sample > 0) || (prev >= 0 && sample < 0)) {
              zeroCrossings += 1;
            }
          }
        }

        const rms = Math.sqrt(sumSquares / length);
        const zcr = zeroCrossings / Math.max(1, length - 1);

        const energy = rms > 0.18 ? 'High' : rms > 0.09 ? 'Medium' : 'Low';
        const mainCharacter = zcr > 0.13 ? 'Bright / Percussive' : zcr < 0.07 ? 'Warm' : 'Balanced';
        const pitchRange = zcr > 0.14 ? 'Mid-High' : zcr > 0.09 ? 'Mid' : 'Low-Mid';
        const bpmValue = Math.round(clamp(92 + zcr * 360 + rms * 110, 78, 164));

        setCharacteristics({
          estimatedBpm: `${bpmValue} BPM`,
          mainCharacter,
          energy,
          pitchRange,
        });
      } catch (analysisError) {
        console.warn('Could not derive local sound characteristics.', analysisError);
        if (!cancelled) {
          setCharacteristics({
            estimatedBpm: '--',
            mainCharacter: '--',
            energy: '--',
            pitchRange: '--',
          });
        }
      }
    };

    generateCharacteristics();

    return () => {
      cancelled = true;
    };
  }, [currentAudio]);

  const applyTrim = (start: number, end: number) => {
    const safeStart = Math.min(Math.max(0, start), duration);
    const safeEnd = Math.min(Math.max(0, end), duration);
    setTrimStart(safeStart);
    setTrimEnd(safeEnd);
    setTrimSelection({ start: safeStart, end: safeEnd });
  };

  const handleRecord = async () => {
    if (recorder.isRecording) {
      if (autoStopPendingRef.current) return;
      const audio = await recorder.stopRecording();
      if (audio) setLocalAudio(audio);
      return;
    }

    setAutoStopNotice(false);
    const started = await recorder.startRecording();
    if (started) {
      setLocalAudio(null);
    }
  };

  const handleFileSelected = async (file?: File) => {
    if (!file) return;
    setAutoStopNotice(false);
    const audio = await fileUpload.uploadFile(file);
    if (audio) setLocalAudio(audio);
  };

  const resetAudio = () => {
    setLocalAudio(null);
    setCurrentAudio(null);
    setTrimSelection(null);
    clearResults();
    setHasSearched(false);
    setAutoStopNotice(false);
    setCharacteristics(null);
  };

  const runSearch = async () => {
    if (!currentAudio || !isValidTrim || isRecommendationLoading) return;

    const request = { query: '', filters: defaultSearchFilters, limit: 4 };
    const minimumLoadingTime = new Promise<void>((resolve) => {
      searchDelayResolveRef.current = resolve;
      searchDelayRef.current = window.setTimeout(() => {
        searchDelayRef.current = null;
        searchDelayResolveRef.current = null;
        resolve();
      }, 3000);
    });

    setIsSearchTransition(true);
    setHasSearched(true);
    setSearchRequest(request);
    setTrimSelection({ start: trimStart, end: trimEnd });

    try {
      await Promise.all([
        searchExamples(request, currentAudio, { start: trimStart, end: trimEnd }),
        minimumLoadingTime,
      ]);
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
                    {recorder.isRecording
                      ? audioService.formatDuration(Math.min(recorder.duration, MAX_RECORDING_DURATION_SECONDS))
                      : '00:00'}
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

          {autoStopNotice && (
            <p className="recording-limit-note">Max 10s reached. Recording stopped automatically.</p>
          )}

          <div className="sound-characteristics-card">
            <div className="subsection-head">
              <p>Sound characteristics</p>
            </div>
            <div className="sound-characteristics-grid">
              <div className="characteristic-tile">
                <span>Duration</span>
                <strong>{currentAudio ? audioService.formatDuration(duration) : '--'}</strong>
              </div>
              <div className="characteristic-tile">
                <span>Estimated BPM</span>
                <strong>{currentAudio ? characteristics?.estimatedBpm ?? '128 BPM' : '--'}</strong>
              </div>
              <div className="characteristic-tile">
                <span>Main character</span>
                <strong>{currentAudio ? characteristics?.mainCharacter ?? 'Bright / Percussive' : '--'}</strong>
              </div>
              <div className="characteristic-tile">
                <span>Energy</span>
                <strong>{currentAudio ? characteristics?.energy ?? 'Medium' : '--'}</strong>
              </div>
              <div className="characteristic-tile">
                <span>Pitch range</span>
                <strong>{currentAudio ? characteristics?.pitchRange ?? 'Mid-High' : '--'}</strong>
              </div>
            </div>
          </div>

          <div className="recommendation-model-card">
            <div className="subsection-head">
              <p>Recommendation model</p>
              <small>Choose how the input sound will be compared.</small>
            </div>
            <div className="recommendation-model-grid">
              {recommendationModelOptions.map((option) => (
                <div key={option.value} className="model-option-shell">
                  <div
                    className="model-info-anchor"
                    onMouseEnter={() => setActiveModelTooltip(option.value)}
                    onMouseLeave={() => setActiveModelTooltip((current) => (current === option.value ? null : current))}
                  >
                    <button
                      type="button"
                      className="model-info-button"
                      aria-label={`What is ${option.label}?`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveModelTooltip((current) => (current === option.value ? null : option.value));
                      }}
                    >
                      <span className="model-info-glyph">i</span>
                    </button>
                    <div
                      className={activeModelTooltip === option.value ? 'model-tooltip visible' : 'model-tooltip'}
                      role="tooltip"
                    >
                      {recommendationModelDescriptions[option.value]}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={recommendationModel === option.value ? 'similarity-toggle active' : 'similarity-toggle'}
                    aria-pressed={recommendationModel === option.value}
                    onClick={() => setRecommendationModel(option.value)}
                  >
                    {option.label}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {recommendationModel === 'essentia' && (
            <div className="similarity-focus-card">
              <div className="subsection-head">
                <p>Similarity results by</p>
              </div>
              <div className="similarity-focus-grid">
                {similarityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={similarityFocus === option.value ? 'similarity-toggle active' : 'similarity-toggle'}
                    aria-pressed={similarityFocus === option.value}
                    onClick={() => setSimilarityFocus(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className="primary-action search-main-button"
            onClick={runSearch}
            disabled={!currentAudio || !isValidTrim || isRecommendationLoading}
          >
            <Search className="h-5 w-5" />
            {isRecommendationLoading ? 'Searching similar loops...' : 'Search for similar loops'}
          </button>
        </section>

        <section className="dashboard-panel freesound-panel">
          <div className="panel-heading">
            <div>
              <p>Similar sound results</p>
              <h2>{results.length ? `${results.length} results ready` : 'Ready when you are'}</h2>
            </div>
            <span className="tiny-note">Frontend preview - backend pending</span>
          </div>

          {isRecommendationLoading && <LoadingRecommendations />}

          {error && !isRecommendationLoading && (
            <div className="status-message error compact-error">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}

          {!hasSearched && !isRecommendationLoading && !error && (
            <div className="recommendation-empty">
              <FileAudio className="h-7 w-7" />
              <p>Record or upload a sound, choose a similarity focus, and search to discover related samples.</p>
            </div>
          )}

          {hasSearched && !isRecommendationLoading && !error && results.length === 0 && (
            <div className="recommendation-empty">
              <Search className="h-7 w-7" />
              <p>No matching sounds yet. Try another sample or adjust your similarity focus.</p>
            </div>
          )}

          {!isRecommendationLoading && results.length > 0 && (
            <div className="recommendation-list">
              {results.slice(0, 4).map((sound) => (
                <SoundCard key={sound.id} sound={sound} />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
