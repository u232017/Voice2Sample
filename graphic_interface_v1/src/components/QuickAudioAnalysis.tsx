import { useEffect, useState } from 'react';
import { Activity, AudioLines, Drum, Music2, Sparkles } from 'lucide-react';
import { audioAnalysisService } from '../services/audioAnalysisService';
import { AudioAnalysisResult, AudioTrimSelection, RecordedAudio, SimilarityFocus } from '../services/types';
import { audioService } from '../services/audio';

interface QuickAudioAnalysisProps {
  audio: RecordedAudio | null;
  trimSelection: AudioTrimSelection | null;
  focus: SimilarityFocus;
  onAnalysisChange: (analysis: AudioAnalysisResult | null) => void;
}

const labelText = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace('-', ' ');

const formatFrequency = (value: number | null) => {
  if (!value || !Number.isFinite(value)) return '--';
  if (value >= 1000) return `${(value / 1000).toFixed(1)} kHz`;
  return `${Math.round(value)} Hz`;
};

const formatBpm = (value: number | null) => {
  if (!value || !Number.isFinite(value)) return '--';
  return `${Math.round(value)} BPM`;
};

export function QuickAudioAnalysis({ audio, trimSelection, focus, onAnalysisChange }: QuickAudioAnalysisProps) {
  const [analysis, setAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const result = await audioAnalysisService.analyze(audio, trimSelection);

        if (!cancelled) {
          setAnalysis(result);
          onAnalysisChange(result);
        }
      } catch (analysisError) {
        console.error('Quick audio analysis failed:', analysisError);

        if (!cancelled) {
          setAnalysis(null);
          onAnalysisChange(null);
          setError('Essentia analysis is not available for this audio yet.');
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

  if (!audio) return null;

  const descriptors = analysis?.descriptors;

  return (
    <div className="quick-analysis-card">
      <div className="quick-analysis-head">
        <div>
          <span className="quick-analysis-kicker">Essentia.js analysis</span>
          <h3>Timbre, rhythm and melody descriptors</h3>
        </div>

        <span className={`analysis-engine-pill ${analysis?.engine === 'essentia.js' ? 'essentia' : ''}`}>
          {analysis?.engine || 'analyzing'}
        </span>
      </div>

      {isAnalyzing && (
        <div className="quick-analysis-loading">
          <Sparkles className="h-4 w-4" />
          Analyzing the selected segment...
        </div>
      )}

      {error && <p className="quick-analysis-error">{error}</p>}

      {descriptors && (
        <>
          <div className="quick-analysis-grid">
            <div className={focus === 'melodic' ? 'active' : ''}>
              <Music2 className="h-4 w-4" />
              <span>Melodic</span>
              <strong>{labelText(descriptors.melody.melodicLabel)}</strong>
              <small>{formatFrequency(descriptors.melody.estimatedPitch)}</small>
            </div>

            <div className={focus === 'bpm' ? 'active' : ''}>
              <Drum className="h-4 w-4" />
              <span>BPM / rhythm</span>
              <strong>{formatBpm(descriptors.rhythm.bpm)}</strong>
              <small>{labelText(descriptors.rhythm.rhythmLabel)}</small>
            </div>

            <div className={focus === 'timbre' ? 'active' : ''}>
              <AudioLines className="h-4 w-4" />
              <span>Timbre</span>
              <strong>{labelText(descriptors.timbre.timbreLabel)}</strong>
              <small>{formatFrequency(descriptors.timbre.spectralCentroid)}</small>
            </div>

            <div className={focus === 'energy' ? 'active' : ''}>
              <Activity className="h-4 w-4" />
              <span>Energy</span>
              <strong>{labelText(descriptors.energy.energyLabel)}</strong>
              <small>RMS {descriptors.energy.rms.toFixed(3)}</small>
            </div>
          </div>

          <div className="quick-analysis-details">
            <span>Selected: {audioService.formatPreciseDuration(descriptors.selectedDuration)}</span>
            <span>Onsets: {descriptors.rhythm.onsetRate.toFixed(2)}/s</span>
            <span>ZCR: {descriptors.timbre.zeroCrossingRate.toFixed(3)}</span>
            <span>Pitch confidence: {(descriptors.melody.pitchConfidence * 100).toFixed(0)}%</span>
          </div>

          <div className="essentia-ready-box">
            <strong>Essentia search ready</strong>
            <p>
              These descriptors are extracted in the frontend and will be used when the Essentia model is selected.
              The current priority is <b>{focus}</b> similarity.
            </p>
          </div>
        </>
      )}
    </div>
  );
}