import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  AudioLines,
  Drum,
  Music2,
  Sparkles,
} from 'lucide-react';
import { audioAnalysisService } from '../services/audioAnalysisService';
import {
  AudioAnalysisResult,
  AudioTrimSelection,
  DescriptorProvenance,
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
  provenance: DescriptorProvenance;
}

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

const formatDecimal = (value: number, decimals = 3) => {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return value.toFixed(decimals);
};

const formatPercentage = (value: number) => {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return `${Math.round(value * 100)}%`;
};

function MetricRow({
  label,
  value,
  provenance,
}: MetricRowProps) {
  return (
    <div className="analysis-metric-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <small
        className={`descriptor-source ${
          provenance.source === 'essentia.js'
            ? 'essentia'
            : 'approximation'
        }`}
      >
        {provenance.source === 'essentia.js'
          ? 'Essentia.js'
          : 'Approximation'}
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

  useEffect(() => {
    if (!audio || !trimSelection) {
      setAnalysis(null);
      setError(null);
      onAnalysisChange(null);
      return;
    }

    let cancelled = false;

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsAnalyzing(true);
        setError(null);

        const result = await audioAnalysisService.analyze(
          audio,
          trimSelection
        );

        if (!cancelled) {
          setAnalysis(result);
          onAnalysisChange(result);
        }
      } catch (analysisError) {
        console.error(
          'Quick audio analysis failed:',
          analysisError
        );

        if (!cancelled) {
          setAnalysis(null);
          onAnalysisChange(null);
          setError(
            'The selected audio segment could not be analyzed.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [audio, trimSelection, onAnalysisChange]);

  if (!audio) {
    return null;
  }

  const descriptors = analysis?.descriptors;
  const sources = analysis?.sources;

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
              : analysis?.engine === 'mixed-analysis'
                ? 'mixed'
                : 'approximation'
          }`}
        >
          {analysis?.engine === 'essentia.js'
            ? 'Essentia.js'
            : analysis?.engine === 'mixed-analysis'
              ? 'Mixed analysis'
              : analysis?.engine === 'approximation'
                ? 'Approximation'
                : 'Analyzing'}
        </span>
      </div>

      {isAnalyzing && (
        <div className="quick-analysis-loading">
          <Sparkles className="h-4 w-4" />
          Analyzing the selected segment...
        </div>
      )}

      {error && (
        <p className="quick-analysis-error">
          {error}
        </p>
      )}

      {descriptors && sources && (
        <>
          {analysis.hasApproximations && (
            <div className="analysis-approximation-notice">
              <AlertTriangle className="h-4 w-4" />
              <p>
                Values marked <strong>Approximation</strong> are fallback
                estimates shown when Essentia.js cannot return a reliable
                value for that descriptor in the selected audio segment.
              </p>
            </div>
          )}

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
                provenance={sources.melody.estimatedPitch}
              />

              <MetricRow
                label="Pitch confidence"
                value={formatPercentage(
                  descriptors.melody.pitchConfidence
                )}
                provenance={sources.melody.pitchConfidence}
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
                provenance={sources.rhythm.bpm}
              />

              <MetricRow
                label="Rhythm confidence"
                value={formatPercentage(
                  descriptors.rhythm.bpmConfidence
                )}
                provenance={sources.rhythm.bpmConfidence}
              />

              <MetricRow
                label="Onset rate"
                value={`${formatDecimal(
                  descriptors.rhythm.onsetRate,
                  2
                )}/s`}
                provenance={sources.rhythm.onsetRate}
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
                provenance={sources.timbre.spectralCentroid}
              />

              <MetricRow
                label="Spectral rolloff"
                value={formatFrequency(
                  descriptors.timbre.spectralRolloff
                )}
                provenance={sources.timbre.spectralRolloff}
              />

              <MetricRow
                label="Spectral flatness"
                value={formatDecimal(
                  descriptors.timbre.spectralFlatness
                )}
                provenance={sources.timbre.spectralFlatness}
              />

              <MetricRow
                label="ZCR"
                value={formatDecimal(
                  descriptors.timbre.zeroCrossingRate
                )}
                provenance={sources.timbre.zeroCrossingRate}
              />
            </section>

            <section className={focus === 'energy' ? 'active' : ''}>
              <div className="descriptor-group-title">
                <Activity className="h-4 w-4" />
                <span>Energy</span>
              </div>

              <MetricRow
                label="RMS"
                value={formatDecimal(descriptors.energy.rms)}
                provenance={sources.energy.rms}
              />

              <MetricRow
                label="Energy"
                value={formatDecimal(
                  descriptors.energy.energy,
                  2
                )}
                provenance={sources.energy.energy}
              />

              <MetricRow
                label="Dynamic complexity"
                value={formatDecimal(
                  descriptors.energy.dynamicComplexity,
                  2
                )}
                provenance={sources.energy.dynamicComplexity}
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

          <div className="essentia-ready-box">
            <strong>Essentia search ready</strong>

            <p>
              Metrics tagged <b>Essentia.js</b> are calculated using
              Essentia algorithms. Values tagged <b>Approximation</b> are
              fallback estimates used only when a reliable Essentia value is
              unavailable. Current priority: <b>{focus}</b> similarity.
            </p>
          </div>
        </>
      )}
    </div>
  );
}