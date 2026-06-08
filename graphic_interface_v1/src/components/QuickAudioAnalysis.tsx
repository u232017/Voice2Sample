import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Drum,
  Music2,
  Sparkles,
} from 'lucide-react';
import { audioAnalysisService } from '../services/audioAnalysisService';
import {
  AudioAnalysisResult,
  AudioTrimSelection,
  RecordedAudio,
  SimilarityFocus,
} from '../services/types';
import { audioService } from '../services/audio';

interface QuickAudioAnalysisProps {
  audio: RecordedAudio | null;
  trimSelection: AudioTrimSelection | null;
  focus: SimilarityFocus;
  onAnalysisChange: (analysis: AudioAnalysisResult | null) => void;
}

interface MetricRowProps {
  label: string;
  value: string;
}

const focusLabels: Record<SimilarityFocus, string> = {
  general: 'General',
  melodic: 'Melodic',
  bpm: 'BPM',
  timbre: 'Timbre',
};

const formatFrequency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return '--';
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} kHz`;
  }

  return `${Math.round(value)} Hz`;
};

const formatBpm = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return '--';
  }

  return `${Math.round(value)} BPM`;
};

const formatDecimal = (value: number | null, decimals = 3) => {
  if (value === null || !Number.isFinite(value)) {
    return '--';
  }

  return value.toFixed(decimals);
};

const formatPercentage = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return '--';
  }

  return `${Math.round(value * 100)}%`;
};

function MetricRow({
  label,
  value,
}: MetricRowProps) {
  return (
    <div className="analysis-metric-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <small className="descriptor-source essentia">
        Essentia.js
      </small>
    </div>
  );
}

export function QuickAudioAnalysis({
  audio,
  trimSelection,
  focus,
  onAnalysisChange,
}: QuickAudioAnalysisProps) {
  const [analysis, setAnalysis] =
    useState<AudioAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const analysisRequestIdRef = useRef(0);

  useEffect(() => {
    analysisRequestIdRef.current += 1;
    setAnalysis(null);
    setIsAnalyzing(false);
    setError(null);
    onAnalysisChange(null);
  }, [audio, trimSelection, onAnalysisChange]);

  const handleAnalyzeSelectedSegment = async () => {
    if (!audio || !trimSelection || isAnalyzing) {
      return;
    }

    const requestId = analysisRequestIdRef.current + 1;
    analysisRequestIdRef.current = requestId;

    try {
      setIsAnalyzing(true);
      setError(null);

      const result = await audioAnalysisService.analyze(
        audio,
        trimSelection
      );

      if (requestId !== analysisRequestIdRef.current) {
        return;
      }

      setAnalysis(result);
      onAnalysisChange(result);
    } catch (analysisError) {
      console.error(
        'Quick audio analysis failed:',
        analysisError
      );

      if (requestId !== analysisRequestIdRef.current) {
        return;
      }

      setAnalysis(null);
      onAnalysisChange(null);
      setError(
        'Essentia.js could not analyze the selected audio segment.'
      );
    } finally {
      if (requestId === analysisRequestIdRef.current) {
        setIsAnalyzing(false);
      }
    }
  };

  if (!audio) {
    return null;
  }

  const descriptors = analysis?.descriptors;

  return (
    <div className="quick-analysis-card">
      <div className="quick-analysis-head">
        <span className="quick-analysis-kicker">
          Audio descriptor analysis
        </span>

        <span
          className={`analysis-engine-pill ${
            analysis?.engine === 'essentia.js'
              ? 'essentia'
              : ''
          }`}
        >
          {analysis?.engine === 'essentia.js'
            ? 'Essentia.js'
            : 'Not analyzed'}
        </span>
      </div>

      <button
        type="button"
        className="primary-action search-main-button"
        onClick={handleAnalyzeSelectedSegment}
        disabled={!trimSelection || isAnalyzing}
      >
        <Sparkles className="h-5 w-5" />

        {isAnalyzing
          ? 'Analyzing selected segment...'
          : analysis
            ? 'Re-analyze selected segment'
            : 'Analyze selected segment'}
      </button>

      {!analysis && !isAnalyzing && !error && (
        <div className="essentia-ready-box">
          <strong>Analysis not started</strong>
          <p>Press analyze when the trim is ready.</p>
        </div>
      )}

      {isAnalyzing && (
        <div className="quick-analysis-loading">
          <Sparkles className="h-4 w-4" />
          Analyzing the selected segment with Essentia.js...
        </div>
      )}

      {error && (
        <p className="quick-analysis-error">
          {error}
        </p>
      )}

      {descriptors && (
        <>
          <div className="quick-analysis-grid precise-grid">
            <section className={focus === 'melodic' ? 'active' : ''}>
              <div className="descriptor-group-title">
                <Music2 className="h-4 w-4" />
                <span>Melodic</span>
              </div>

              <MetricRow
                label="Predominant pitch"
                value={formatFrequency(
                  descriptors.melody.estimatedPitch
                )}
              />

              <MetricRow
                label="Pitch confidence"
                value={formatPercentage(
                  descriptors.melody.pitchConfidence
                )}
              />
            </section>

            <section className={focus === 'bpm' ? 'active' : ''}>
              <div className="descriptor-group-title">
                <Drum className="h-4 w-4" />
                <span>BPM / rhythm</span>
              </div>

              <MetricRow
                label="BPM"
                value={formatBpm(descriptors.rhythm.bpm)}
              />

              <MetricRow
                label="Rhythm confidence"
                value={formatPercentage(
                  descriptors.rhythm.bpmConfidence
                )}
              />

              <MetricRow
                label="Onset rate"
                value={`${formatDecimal(
                  descriptors.rhythm.onsetRate,
                  2
                )}/s`}
              />
            </section>

            <section className={focus === 'timbre' ? 'active' : ''}>
              <div className="descriptor-group-title">
                <AudioLines className="h-4 w-4" />
                <span>Timbre</span>
              </div>

              <MetricRow
                label="Spectral centroid"
                value={formatFrequency(
                  descriptors.timbre.spectralCentroid
                )}
              />

              <MetricRow
                label="Spectral rolloff"
                value={formatFrequency(
                  descriptors.timbre.spectralRolloff
                )}
              />

              <MetricRow
                label="Spectral flatness"
                value={formatDecimal(
                  descriptors.timbre.spectralFlatness
                )}
              />

              <MetricRow
                label="ZCR"
                value={formatDecimal(
                  descriptors.timbre.zeroCrossingRate
                )}
              />
            </section>

          </div>

          <div className="quick-analysis-details">
            <span>
              Selected:{' '}
              {audioService.formatPreciseDuration(
                descriptors.selectedDuration
              )}
            </span>

            <span>
              Sample rate: {Math.round(descriptors.sampleRate)} Hz
            </span>

            <span>
              Channels: {descriptors.channels}
            </span>
          </div>

          <div className="analysis-focus-summary">
            <strong>Current recommendation context</strong>
            <p>
              Essentia / <b>{focusLabels[focus]}</b>
            </p>
            <span>
              The descriptor values above are the live metrics driving this search mode.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
