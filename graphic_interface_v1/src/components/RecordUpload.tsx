import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  FileAudio,
  Info,
  Mic,
  RotateCcw,
  Search,
  Square,
  Upload,
} from 'lucide-react';
import { SoundCard } from './SoundCard';
import { SoundMap } from './SoundMap';
import { AudioWaveform } from './AudioWaveform';
import { LoadingRecommendations } from './LoadingRecommendations';
import { QuickAudioAnalysis } from './QuickAudioAnalysis';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useFileUpload } from '../hooks/useFileUpload';
import { defaultSearchFilters, useAudio } from '../context/AudioContext';
import { useFreesound } from '../hooks/useFreesound';
import {
  AudioAnalysisResult,
  CombinedSoundMapResponse,
  FreesoundSearchFilters,
  RecommendationModel,
  RecordedAudio,
  SimilarityFocus,
} from '../services/types';
import { audioService } from '../services/audio';
import { audioAnalysisService } from '../services/audioAnalysisService';
import { recommendationAPI } from '../services/recommendations';

const similarityOptions: Array<{
  value: SimilarityFocus;
  label: string;
}> = [
  { value: 'general', label: 'General' },
  { value: 'melodic', label: 'Melodic' },
  { value: 'bpm', label: 'BPM' },
  { value: 'timbre', label: 'Timbre' },
];

export function RecordUpload() {
  const {
    setCurrentAudio,
    setSearchRequest,
    setTrimSelection,
  } = useAudio();

  const {
    results,
    isLoading,
    error,
    searchExamples,
    clearResults,
  } = useFreesound();

  const recorder = useAudioRecorder();
  const fileUpload = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchDelayRef = useRef<number | null>(null);
  const searchDelayResolveRef = useRef<(() => void) | null>(null);
  const mapRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const [currentAudio, setLocalAudio] = useState<RecordedAudio | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isSearchTransition, setIsSearchTransition] = useState(false);
  const [filters] = useState<FreesoundSearchFilters>(defaultSearchFilters);
  const [recommendationModel, setRecommendationModel] =
    useState<RecommendationModel>('essentia');
  const [similarityFocus, setSimilarityFocus] =
    useState<SimilarityFocus>('general');
  const [frontendAnalysis, setFrontendAnalysis] =
    useState<AudioAnalysisResult | null>(null);
  const [mapResults, setMapResults] =
    useState<CombinedSoundMapResponse | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const audioUrl = useMemo(() => {
    if (!currentAudio) {
      return null;
    }

    return URL.createObjectURL(currentAudio.blob);
  }, [currentAudio]);

  const duration = Math.max(0, currentAudio?.metadata.duration || 0);

  const isValidTrim = currentAudio
    ? trimStart < trimEnd && trimEnd <= duration
    : false;

  const selectedDuration = isValidTrim ? trimEnd - trimStart : duration;

  const isTrimmed =
    currentAudio &&
    isValidTrim &&
    Math.abs(selectedDuration - duration) > 0.05;

  const isRecommendationLoading = isSearchTransition || isLoading;

  const status = recorder.isRecording
    ? 'recording'
    : currentAudio
      ? 'audio ready'
      : 'no audio';

  const trimSelection = useMemo(() => {
    if (!currentAudio || !isValidTrim) {
      return null;
    }

    return {
      start: trimStart,
      end: trimEnd,
    };
  }, [currentAudio, isValidTrim, trimStart, trimEnd]);

  const userSoundTitle = recorder.isRecording
    ? `Recording... ${audioService.formatDuration(recorder.duration)}`
    : currentAudio
      ? isTrimmed
        ? `Selected clip · ${audioService.formatPreciseDuration(
            selectedDuration
          )}`
        : `Sample duration ${audioService.formatPreciseDuration(duration)}`
      : 'Record or upload';

  const discardMap = useCallback(() => {
    mapRequestIdRef.current += 1;
    setMapResults(null);
    setMapError(null);
    setIsMapLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      mapRequestIdRef.current += 1;

      if (searchDelayRef.current) {
        window.clearTimeout(searchDelayRef.current);
        searchDelayResolveRef.current?.();
      }
    };
  }, []);

  useEffect(() => {
    setCurrentAudio(currentAudio);
    setFrontendAnalysis(null);
    discardMap();

    if (currentAudio) {
      const end = Math.max(0, currentAudio.metadata.duration);

      setTrimStart(0);
      setTrimEnd(end);
      setTrimSelection({ start: 0, end });
      clearResults();
    }
  }, [
    currentAudio,
    setCurrentAudio,
    setTrimSelection,
    clearResults,
    discardMap,
  ]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const applyTrim = (start: number, end: number) => {
    const safeStart = Math.min(Math.max(0, start), duration);
    const safeEnd = Math.min(Math.max(0, end), duration);

    setTrimStart(safeStart);
    setTrimEnd(safeEnd);
    setTrimSelection({
      start: safeStart,
      end: safeEnd,
    });

    clearResults();
    discardMap();
  };

  const handleAnalysisChange = useCallback(
    (analysis: AudioAnalysisResult | null) => {
      setFrontendAnalysis(analysis);
    },
    []
  );

  const handleRecord = async () => {
    if (recorder.isRecording) {
      const audio = await recorder.stopRecording();

      if (audio) {
        setLocalAudio(audio);
      }

      return;
    }

    const started = await recorder.startRecording();

    if (started) {
      setLocalAudio(null);
      setFrontendAnalysis(null);
      clearResults();
      discardMap();
    }
  };

  const handleFileSelected = async (file?: File) => {
    if (!file) {
      return;
    }

    const audio = await fileUpload.uploadFile(file);

    if (audio) {
      setLocalAudio(audio);
      setFrontendAnalysis(null);
      clearResults();
      discardMap();
    }
  };

  const resetAudio = () => {
    setLocalAudio(null);
    setCurrentAudio(null);
    setTrimSelection(null);
    setFrontendAnalysis(null);
    clearResults();
    discardMap();
  };

  const selectRecommendationModel = (model: RecommendationModel) => {
    setRecommendationModel(model);
    clearResults();
    discardMap();
  };

  const selectSimilarityFocus = (focus: SimilarityFocus) => {
    setSimilarityFocus(focus);
    clearResults();
    discardMap();
  };

  const buildSearchRequest = (focus: SimilarityFocus) => {
    const analysis = frontendAnalysis;

    return {
      query:
        recommendationModel === 'essentia' && analysis
          ? audioAnalysisService.createEssentiaQuery(
              analysis.descriptors,
              focus,
              currentAudio?.name
            )
          : '',
      filters,
      limit: 4,
      model: recommendationModel,
      focus:
        recommendationModel === 'essentia'
          ? focus
          : undefined,
      trimSelection: trimSelection || undefined,
      frontendAnalysis: analysis,
      essentiaPayload:
        recommendationModel === 'essentia' && analysis && trimSelection
          ? {
              model: 'essentia' as const,
              focus,
              trim: trimSelection,
              descriptors: analysis.descriptors,
              suggestedQuery: audioAnalysisService.createEssentiaQuery(
                analysis.descriptors,
                focus,
                currentAudio?.name
              ),
            }
          : null,
      clapPayload:
        recommendationModel === 'clap' && trimSelection
          ? {
              model: 'clap' as const,
              trim: trimSelection,
              note: 'CLAP search is expected to be handled by the backend using audio embeddings.' as const,
            }
          : null,
    };
  };

  const runSearch = async () => {
    if (
      !currentAudio ||
      !isValidTrim ||
      !trimSelection ||
      isRecommendationLoading
    ) {
      return;
    }

    const request = buildSearchRequest(similarityFocus);

    const minimumLoadingTime = new Promise<void>((resolve) => {
      searchDelayResolveRef.current = resolve;

      searchDelayRef.current = window.setTimeout(() => {
        searchDelayRef.current = null;
        searchDelayResolveRef.current = null;
        resolve();
      }, 1800);
    });

    discardMap();
    setIsSearchTransition(true);
    setSearchRequest(request);
    setTrimSelection(trimSelection);

    try {
      await Promise.all([
        searchExamples(request, currentAudio, trimSelection),
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

  const loadRealSoundMap = async () => {
    if (
      !currentAudio ||
      !trimSelection ||
      recommendationModel !== 'essentia' ||
      isMapLoading
    ) {
      return;
    }

    const requestId = mapRequestIdRef.current + 1;

    mapRequestIdRef.current = requestId;
    setIsMapLoading(true);
    setMapError(null);

    try {
      const data = await recommendationAPI.getCombinedMapResults(
        currentAudio,
        trimSelection,
        50
      );

      if (
        isMountedRef.current &&
        requestId === mapRequestIdRef.current
      ) {
        setMapResults(data);
      }
    } catch (requestError) {
      console.error('Sound map request failed:', requestError);

      if (
        isMountedRef.current &&
        requestId === mapRequestIdRef.current
      ) {
        const message =
          requestError instanceof Error ? requestError.message : '';

        const status = message.startsWith('BACKEND_MAP_HTTP_')
          ? message.replace('BACKEND_MAP_HTTP_', '')
          : null;

        setMapError(
          status
            ? `Map request failed (HTTP ${status}). Check the Python backend terminal.`
            : 'The combined similarity map could not be loaded.'
        );
      }
    } finally {
      if (
        isMountedRef.current &&
        requestId === mapRequestIdRef.current
      ) {
        setIsMapLoading(false);
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
              <h1>{userSoundTitle}</h1>
            </div>

            <span
              className={`status-pill ${
                recorder.isRecording
                  ? 'recording'
                  : currentAudio
                    ? 'ready'
                    : ''
              }`}
            >
              {status}
            </span>
          </div>

          <div className="quick-actions">
            <button
              className={
                recorder.isRecording
                  ? 'danger-action'
                  : 'primary-action'
              }
              onClick={handleRecord}
            >
              {recorder.isRecording ? (
                <Square className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}

              {recorder.isRecording ? 'Stop' : 'Record'}
            </button>

            <button
              className="secondary-action"
              onClick={() => fileInputRef.current?.click()}
            >
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
              onChange={(event) =>
                handleFileSelected(event.target.files?.[0])
              }
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
              <>
                <AudioWaveform
                  audioUrl={audioUrl}
                  duration={duration}
                  selectedStart={trimStart}
                  selectedEnd={trimEnd}
                  onRegionChange={applyTrim}
                />

                <QuickAudioAnalysis
                  audio={currentAudio}
                  trimSelection={trimSelection}
                  focus={similarityFocus}
                  onAnalysisChange={handleAnalysisChange}
                />
              </>
            ) : (
              <div className="record-meter compact-meter">
                <div>
                  <p className="font-mono text-3xl font-bold text-white">
                    {recorder.isRecording
                      ? audioService.formatDuration(recorder.duration)
                      : '00:00'}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {recorder.isRecording
                      ? 'Recording from microphone'
                      : 'Waiting for audio'}
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

              <h2>
                {results.length ? '4 real sounds' : 'Ready when you are'}
              </h2>
            </div>

            <span className="tiny-note">
              {recommendationModel === 'essentia'
                ? `Acoustic backend · ${similarityFocus}`
                : 'CLAP backend mode'}
            </span>
          </div>

          <div className="model-selector-card">
            <div className="model-card-head">
              <div>
                <p>Recommendation model</p>
                <span>Choose how the input sound will be compared.</span>
              </div>
            </div>

            <div className="model-toggle-row">
              <button
                className={
                  recommendationModel === 'essentia' ? 'active' : ''
                }
                onClick={() => selectRecommendationModel('essentia')}
              >
                Essentia
              </button>

              <button
                className={
                  recommendationModel === 'clap' ? 'active' : ''
                }
                onClick={() => selectRecommendationModel('clap')}
              >
                CLAP
              </button>
            </div>

            <div className="model-info-row">
              <span>
                <Info className="h-4 w-4" />

                {recommendationModel === 'essentia'
                  ? 'The current backend compares acoustic features from your selected audio segment with real dataset sounds.'
                  : 'CLAP is prepared as a backend search mode based on complete audio embeddings.'}
              </span>
            </div>
          </div>

          {recommendationModel === 'essentia' && (
            <div className="similarity-card">
              <div className="model-card-head">
                <div>
                  <p>Similarity results by</p>
                  <span>
                    Choose how the real dataset sounds should be compared.
                  </span>
                </div>
              </div>

              <div className="similarity-grid">
                {similarityOptions.map((option) => (
                  <button
                    key={option.value}
                    className={
                      similarityFocus === option.value ? 'active' : ''
                    }
                    onClick={() => selectSimilarityFocus(option.value)}
                  >
                    <span>{option.label}</span>

                    {option.value === 'bpm' && (
                      <span
                        className="similarity-info-anchor"
                        aria-hidden="true"
                      >
                        <span className="similarity-info-dot">i</span>

                        <span className="similarity-info-tooltip">
                          BPM results include close tempo matches and compatible
                          half-time relationships when available.
                        </span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className="primary-action search-main-button"
            onClick={runSearch}
            disabled={
              !currentAudio ||
              !isValidTrim ||
              isRecommendationLoading
            }
          >
            <Search className="h-5 w-5" />

            {isRecommendationLoading
              ? 'Searching...'
              : recommendationModel === 'essentia'
                ? `Search by ${
                    similarityOptions.find(
                      (option) => option.value === similarityFocus
                    )?.label
                  }`
                : 'Search with CLAP'}
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

          {currentAudio &&
            !isRecommendationLoading &&
            !error &&
            results.length === 0 && (
              <div className="recommendation-empty">
                <Search className="h-7 w-7" />
                <p>Start the search when your sample is ready.</p>
              </div>
            )}

          {!isRecommendationLoading && results.length > 0 && (
            <>
              {recommendationModel === 'essentia' && (
                <div className="sound-map-trigger-card">
                  <div>
                    <strong>Explore nearby results</strong>
                    <p>
                      Visualize 200 real matches: 50 by General, 50 by Melodic,
                      50 by BPM and 50 by Timbre.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-action sound-map-trigger"
                    onClick={loadRealSoundMap}
                    disabled={isMapLoading}
                  >
                    <Search className="h-4 w-4" />

                    {isMapLoading
                      ? 'Building map...'
                      : mapResults
                        ? 'Refresh map'
                        : 'Explore similarity map'}
                  </button>
                </div>
              )}

              <div className="recommendation-list">
                {results.slice(0, 4).map((sound) => (
                  <SoundCard key={sound.id} sound={sound} />
                ))}
              </div>
            </>
          )}

          {mapError && (
            <div className="status-message error compact-error sound-map-error">
              <AlertCircle className="h-5 w-5" />
              <p>{mapError}</p>
            </div>
          )}
        </section>
      </div>

      {mapResults && recommendationModel === 'essentia' && (
        <SoundMap
          data={mapResults}
          isLoading={isMapLoading}
          onClose={discardMap}
        />
      )}
    </section>
  );
}