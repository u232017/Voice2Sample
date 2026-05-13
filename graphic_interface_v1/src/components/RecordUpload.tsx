// src/components/RecordUpload.tsx  — conectado a tu api.py
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
import { SoundCard }              from './SoundCard';
import { AudioWaveform }          from './AudioWaveform';
import { LoadingRecommendations } from './LoadingRecommendations';
import { useAudioRecorder }       from '../hooks/useAudioRecorder';
import { useFileUpload }          from '../hooks/useFileUpload';
import { useAudio }               from '../context/AudioContext';
import { useVoice2Sample }        from '../hooks/useVoice2Sample';
import { RecordedAudio }          from '../services/types';
import { audioService }           from '../services/audio';
import { V2SFiltros }             from '../services/voice2sample';

export function RecordUpload() {
  const { setCurrentAudio, setTrimSelection } = useAudio();
  const { results, isLoading, error, rangos, buscar, clearResults } = useVoice2Sample();

  const recorder   = useAudioRecorder();
  const fileUpload = useFileUpload();
  const fileInputRef   = useRef<HTMLInputElement | null>(null);
  const isMountedRef   = useRef(true);

  const [currentAudio, setLocalAudio]   = useState<RecordedAudio | null>(null);
  const [trimStart, setTrimStart]       = useState(0);
  const [trimEnd,   setTrimEnd]         = useState(0);
  const [showFilters, setShowFilters]   = useState(false);
  const [isTransition, setIsTransition] = useState(false);

  // ── Filtros KNN ──────────────────────────────────────────────────────────
  const [filtros, setFiltros] = useState<V2SFiltros>({});

  // Cuando llegan los rangos reales de la API, inicializamos los sliders
  useEffect(() => {
    if (rangos.bpm.min || rangos.pitch_mean.min) {
      setFiltros({
        min_bpm:   rangos.bpm.min,
        max_bpm:   rangos.bpm.max,
        min_pitch: rangos.pitch_mean.min,
        max_pitch: rangos.pitch_mean.max,
      });
    }
  }, [rangos]);

  const audioUrl = useMemo(() => {
    if (!currentAudio) return null;
    return URL.createObjectURL(currentAudio.blob);
  }, [currentAudio]);

  const duration    = Math.max(0, currentAudio?.metadata.duration || 0);
  const isValidTrim = currentAudio ? trimStart < trimEnd && trimEnd <= duration : false;
  const isSearching = isTransition || isLoading;
  const status      = recorder.isRecording ? 'recording' : currentAudio ? 'audio ready' : 'no audio';

  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

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
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  // ── Acciones ─────────────────────────────────────────────────────────────

  const handleRecord = async () => {
    if (recorder.isRecording) {
      const audio = await recorder.stopRecording();
      if (audio) setLocalAudio(audio);
      return;
    }
    const started = await recorder.startRecording();
    if (started) setLocalAudio(null);
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
    if (!currentAudio || !isValidTrim || isSearching) return;
    setIsTransition(true);
    setTrimSelection({ start: trimStart, end: trimEnd });
    try {
      await buscar(currentAudio.blob, filtros);
    } finally {
      if (isMountedRef.current) setIsTransition(false);
    }
  };

  // Re-lanza la búsqueda automáticamente cuando cambia un slider (si ya hay resultados)
  const handleSliderChange = (key: keyof V2SFiltros, value: number) => {
    const nuevos = { ...filtros, [key]: value };
    setFiltros(nuevos);
    if (currentAudio && results.length > 0) {
      buscar(currentAudio.blob, nuevos);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="app-page dashboard-page">
      <div className="dashboard-shell">

        {/* ── Panel izquierdo: tu audio ── */}
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
            <button
              className={recorder.isRecording ? 'danger-action' : 'primary-action'}
              onClick={handleRecord}
            >
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
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
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
                onRegionChange={(s, e) => {
                  setTrimStart(s); setTrimEnd(e);
                  setTrimSelection({ start: s, end: e });
                }}
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

        {/* ── Panel derecho: resultados KNN ── */}
        <section className="dashboard-panel freesound-panel">
          <div className="panel-heading">
            <div>
              <p>KNN recommendations</p>
              <h2>{results.length ? `${results.length} similar samples` : 'Ready when you are'}</h2>
            </div>
            <span className="tiny-note">Motor local · Essentia + KNN</span>
          </div>

          {/* Botón buscar */}
          <button
            className="primary-action search-main-button"
            onClick={runSearch}
            disabled={!currentAudio || !isValidTrim || isSearching}
          >
            <Search className="h-5 w-5" />
            {isSearching ? 'Searching...' : 'Search similar samples'}
          </button>

          {isSearching && <LoadingRecommendations />}

          {error && !isSearching && (
            <div className="status-message error compact-error">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}

          {!currentAudio && !isSearching && (
            <div className="recommendation-empty">
              <FileAudio className="h-7 w-7" />
              <p>Record or upload a sound to get recommendations.</p>
            </div>
          )}

          {currentAudio && !isSearching && !error && results.length === 0 && (
            <div className="recommendation-empty">
              <Search className="h-7 w-7" />
              <p>Press Search to find similar samples with the KNN engine.</p>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <>
              <div className="recommendation-list">
                {results.map((sound) => (
                  <SoundCard key={sound.id} sound={sound} />
                ))}
              </div>

              {/* ── Refine search con sliders reales ── */}
              <div className="refine-box">
                <button
                  className="refine-toggle"
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Refine search
                </button>

                {showFilters && (
                  <div className="chip-filter-group" style={{ gap: '1rem' }}>

                    <SliderFiltro
                      label="BPM mínimo"
                      min={rangos.bpm.min}
                      max={rangos.bpm.max}
                      value={filtros.min_bpm ?? rangos.bpm.min}
                      onChange={(v) => handleSliderChange('min_bpm', v)}
                    />
                    <SliderFiltro
                      label="BPM máximo"
                      min={rangos.bpm.min}
                      max={rangos.bpm.max}
                      value={filtros.max_bpm ?? rangos.bpm.max}
                      onChange={(v) => handleSliderChange('max_bpm', v)}
                    />
                    <SliderFiltro
                      label="Pitch mínimo (Hz)"
                      min={rangos.pitch_mean.min}
                      max={rangos.pitch_mean.max}
                      value={filtros.min_pitch ?? rangos.pitch_mean.min}
                      onChange={(v) => handleSliderChange('min_pitch', v)}
                    />
                    <SliderFiltro
                      label="Pitch máximo (Hz)"
                      min={rangos.pitch_mean.min}
                      max={rangos.pitch_mean.max}
                      value={filtros.max_pitch ?? rangos.pitch_mean.max}
                      onChange={(v) => handleSliderChange('max_pitch', v)}
                    />

                    <button
                      className="secondary-action small-action"
                      onClick={runSearch}
                      disabled={isSearching}
                    >
                      Apply filters
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

// ── Componente slider reutilizable ────────────────────────────────────────────

interface SliderFiltroProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}

function SliderFiltro({ label, min, max, value, onChange }: SliderFiltroProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        <span>{label}</span>
        <strong>{Math.round(value)}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={(max - min) / 100}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}