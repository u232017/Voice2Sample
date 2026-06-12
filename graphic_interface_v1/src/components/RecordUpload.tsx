import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AudioLines,
  ChevronDown,
  ChevronRight,
  FileAudio,
  Mic,
  Radar,
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
  short: string;
}> = [
  { value: 'general', label: 'General', short: 'Balanced' },
  { value: 'melodic', label: 'Melodic', short: 'Pitch-led' },
  { value: 'bpm', label: 'BPM', short: 'Tempo-led' },
  { value: 'timbre', label: 'Timbre', short: 'Texture-led' },
];

const recommendationModels: Array<{
  value: RecommendationModel;
  title: string;
  summary: string;
}> = [
  { value: 'essentia', title: 'Essentia', summary: 'Descriptor-based matching' },
  { value: 'clap', title: 'CLAP', summary: 'Global audio embedding' },
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
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);

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

  const isRecommendationLoading = isSearchTransition || isLoading;
  const hasResults = results.length > 0;
  const isResultsView =
    isRecommendationLoading ||
    hasResults ||
    Boolean(error);

  const status = recorder.isRecording
    ? 'recording'
    : currentAudio
      ? 'audio ready'
      : 'no audio';

  const activeFocusOption = similarityOptions.find(
    (option) => option.value === similarityFocus
  );

  const activeModeLabel =
    recommendationModel === 'essentia'
      ? `Essentia / ${activeFocusOption?.label || 'General'}`
      : 'CLAP / Global';

  const activeModeHint =
    recommendationModel === 'essentia'
      ? `${activeFocusOption?.short || 'Balanced'} similarity active`
      : 'Embedding search active';

  const hasAnalysisReady =
    Boolean(frontendAnalysis?.descriptors) &&
    frontendAnalysis?.engine === 'essentia.js';

  const trimSelection = useMemo(() => {
    if (!currentAudio || !isValidTrim) {
      return null;
    }

    return {
      start: trimStart,
      end: trimEnd,
    };
  }, [currentAudio, isValidTrim, trimStart, trimEnd]);

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
    setIsModeMenuOpen(false);
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
    <section className="app-page studio-page">
      <div className="studio-shell">
        <div className="studio-grid">
          <section className="dashboard-panel capture-panel clean-panel">
            <div className="panel-heading panel-heading-spread">
              <div>
                <p>Audio entry</p>
                <h2>Source audio</h2>
              </div>

              <span
                className={`status-pill ${
                  recorder.isRecording ? 'recording' : currentAudio ? 'ready' : ''
                }`}
              >
                {status}
              </span>
            </div>

            <div className="capture-toolbar">
              <div className="quick-actions">
                <button
                  className={recorder.isRecording ? 'danger-action' : 'primary-action'}
                  onClick={handleRecord}
                >
                  {recorder.isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
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
              </div>

              <div className="capture-status-row">
                <div className="clean-stat-card">
                  <span>Clip</span>
                  <strong>{currentAudio?.name || 'No file loaded'}</strong>
                </div>
                <div className="clean-stat-card">
                  <span>Trim</span>
                  <strong>
                    {currentAudio && isValidTrim
                      ? `${audioService.formatPreciseDuration(trimStart)} - ${audioService.formatPreciseDuration(trimEnd)}`
                      : '--'}
                  </strong>
                </div>
                <div className="clean-stat-card">
                  <span>Analysis</span>
                  <strong>{frontendAnalysis ? 'Ready' : 'Pending'}</strong>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => handleFileSelected(event.target.files?.[0])}
            />

            {(recorder.error || fileUpload.error) && (
              <div className="status-message error compact-error">
                <AlertCircle className="h-5 w-5" />
                <p>{recorder.error || fileUpload.error}</p>
              </div>
            )}

            <div className="workbench-panel clean-workbench">
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
                <div className="capture-empty-state compact">
                  <div className="capture-empty-copy">
                    <AudioLines className="h-6 w-6" />
                    <strong>
                      {recorder.isRecording
                        ? audioService.formatDuration(recorder.duration)
                        : 'No waveform yet'}
                    </strong>
                    <p>
                      {recorder.isRecording
                        ? 'Recording from microphone'
                        : 'Record or upload audio to begin.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section
            className={`dashboard-panel discovery-panel clean-panel ${
              hasResults ? 'results-active' : ''
            }`}
          >
            {!hasResults && (
              <div className="panel-heading panel-heading-spread">
                <div>
                  <p>Discovery engine</p>
                  <h2>Recommendations</h2>
                </div>

                <span className="tiny-note">{activeModeLabel}</span>
              </div>
            )}

            {!isResultsView && (
              <>
                <div className="engine-switch">
                  {recommendationModels.map((model) => (
                    <button
                      key={model.value}
                      type="button"
                      className={`engine-switch-button ${
                        recommendationModel === model.value ? 'active' : ''
                      }`}
                      onClick={() => selectRecommendationModel(model.value)}
                    >
                      <strong>{model.title}</strong>
                      <span>{model.summary}</span>
                    </button>
                  ))}
                </div>

                {recommendationModel === 'essentia' && (
                  <div className="focus-switch">
                    {similarityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`focus-switch-button ${
                          similarityFocus === option.value ? 'active' : ''
                        }`}
                        onClick={() => selectSimilarityFocus(option.value)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.short}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className={`discovery-action-row ${isResultsView ? 'results-mode' : ''}`}>
              <button
                type="button"
                className={`discovery-mode-chip ${isModeMenuOpen ? 'open' : ''} ${
                  isResultsView ? 'interactive' : ''
                }`}
                onClick={() => {
                  if (isResultsView) {
                    setIsModeMenuOpen((open) => !open);
                  }
                }}
                disabled={!isResultsView}
                aria-expanded={isResultsView ? isModeMenuOpen : undefined}
                aria-label={
                  isResultsView
                    ? 'Open active mode settings'
                    : 'Current active mode'
                }
              >
                <span>Active mode</span>
                <strong>{activeModeLabel}</strong>
                <small>{activeModeHint}</small>
                <ChevronDown className="h-4 w-4" />
              </button>

              <button
                className="primary-action search-main-button"
                onClick={runSearch}
                disabled={
                  !currentAudio ||
                  !isValidTrim ||
                  !hasAnalysisReady ||
                  isRecommendationLoading
                }
                title={!hasAnalysisReady ? 'Analyze audio first' : undefined}
              >
                <Search className="h-5 w-5" />
                {isRecommendationLoading
                  ? 'Searching Freesound...'
                  : isResultsView
                    ? 'Refresh results'
                    : recommendationModel === 'essentia'
                      ? `Search by ${
                          similarityOptions.find((option) => option.value === similarityFocus)?.label
                        }`
                      : 'Search with CLAP'}
              </button>
            </div>

            {isResultsView && isModeMenuOpen && (
              <div className="results-mode-menu">
                <div className="results-mode-menu-group">
                  <span>Model</span>
                  <div className="results-mode-menu-options model-options">
                    {recommendationModels.map((model) => (
                      <button
                        key={model.value}
                        type="button"
                        className={`results-mode-option ${
                          recommendationModel === model.value ? 'active' : ''
                        }`}
                        onClick={() => selectRecommendationModel(model.value)}
                      >
                        <strong>{model.title}</strong>
                        <small>{model.summary}</small>
                      </button>
                    ))}
                  </div>
                </div>

                {recommendationModel === 'essentia' && (
                  <div className="results-mode-menu-group">
                    <span>Focus</span>
                    <div className="results-mode-menu-options focus-options">
                      {similarityOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`results-mode-option ${
                            similarityFocus === option.value ? 'active' : ''
                          }`}
                          onClick={() => selectSimilarityFocus(option.value)}
                        >
                          <strong>{option.label}</strong>
                          <small>{option.short}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                <p>Record or upload a sound to unlock recommendations.</p>
              </div>
            )}

            {currentAudio && !isRecommendationLoading && !error && results.length === 0 && (
              <div className="recommendation-empty">
                <Search className="h-7 w-7" />
                <p>Run the search when your clip is ready.</p>
              </div>
            )}

            {!isRecommendationLoading && results.length > 0 && (
              <>
                <div className="results-rack-header workstation-results-header">
                  <div className="results-title-cluster">
                    <div>
                      <span>Recommended samples</span>
                      <strong>Closest matches</strong>
                    </div>
                    <small className="results-count-badge">
                      {results.length} result{results.length === 1 ? '' : 's'}
                    </small>
                  </div>

                  <div className="results-header-actions">
                    <div className="results-context-pill">
                      <span>{activeModeLabel}</span>
                      <ChevronDown className="h-4 w-4" />
                    </div>

                    {recommendationModel === 'essentia' && (
                      <button
                        type="button"
                        className="sound-map-trigger-card premium-map-trigger"
                        onClick={loadRealSoundMap}
                        disabled={isMapLoading}
                      >
                        <div className="map-trigger-orb">
                          <Radar className="h-5 w-5" />
                        </div>

                        <div className="map-trigger-copy">
                          <strong>{isMapLoading ? 'Building similarity map' : 'Open similarity map'}</strong>
                          <p>Explore sonic relationships</p>
                        </div>

                        <span className="map-trigger-arrow">
                          <ChevronRight className="h-5 w-5" />
                        </span>
                      </button>
                    )}
                  </div>
                </div>

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
