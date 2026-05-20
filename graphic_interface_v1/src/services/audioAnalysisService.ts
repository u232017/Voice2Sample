import {
  AudioAnalysisResult,
  AudioDescriptorSummary,
  AudioTrimSelection,
  RecordedAudio,
  SimilarityFocus,
} from './types';
import { audioService } from './audio';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface BaseValues {
  rms: number;
  energy: number;
  peakAmplitude: number;
  zeroCrossingRate: number;
  spectralCentroid: number;
  spectralRolloff: number;
  spectralFlatness: number;
  dynamicRange: number;
  onsetRate: number;
  percussiveScore: number;
  bpm: number | null;
  bpmConfidence: number;
  estimatedPitch: number | null;
  pitchConfidence: number;
  tonalScore: number;
  engine: AudioAnalysisResult['engine'];
}

type EssentiaInstance = {
  arrayToVector: (input: Float32Array) => unknown;
  RMS?: (input: unknown) => Record<string, number>;
  Energy?: (input: unknown) => Record<string, number>;
  ZeroCrossingRate?: (input: unknown, threshold?: number) => Record<string, number>;
  SpectralCentroidTime?: (input: unknown, sampleRate?: number) => Record<string, number>;
};

type EssentiaConstructor = new (wasmModule: unknown, isDebug?: boolean) => EssentiaInstance;

class AudioAnalysisService {
  private essentiaPromise: Promise<EssentiaInstance | null> | null = null;

  async analyze(audio: RecordedAudio, trimSelection?: AudioTrimSelection | null): Promise<AudioAnalysisResult> {
    const audioBuffer = await audioService.decodeAudio(audio.blob);
    const selectedSamples = this.extractSelectedMonoSamples(audioBuffer, trimSelection);
    const selectedDuration = selectedSamples.length / audioBuffer.sampleRate;
    const baseValues = await this.extractValues(selectedSamples, audioBuffer.sampleRate);

    const descriptors: AudioDescriptorSummary = {
      duration: audioBuffer.duration,
      selectedDuration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      energy: {
        rms: baseValues.rms,
        energy: baseValues.energy,
        peakAmplitude: baseValues.peakAmplitude,
        dynamicRange: baseValues.dynamicRange,
        energyLabel: this.energyLabel(baseValues.rms),
      },
      timbre: {
        spectralCentroid: baseValues.spectralCentroid,
        spectralRolloff: baseValues.spectralRolloff,
        zeroCrossingRate: baseValues.zeroCrossingRate,
        spectralFlatness: baseValues.spectralFlatness,
        brightnessLabel: this.brightnessLabel(baseValues.spectralCentroid),
        timbreLabel: this.timbreLabel(
          baseValues.spectralCentroid,
          baseValues.zeroCrossingRate,
          baseValues.spectralFlatness
        ),
      },
      rhythm: {
        bpm: baseValues.bpm,
        bpmConfidence: baseValues.bpmConfidence,
        onsetRate: baseValues.onsetRate,
        percussiveScore: baseValues.percussiveScore,
        rhythmLabel: this.rhythmLabel(baseValues.percussiveScore, baseValues.onsetRate, selectedDuration),
      },
      melody: {
        estimatedPitch: baseValues.estimatedPitch,
        pitchConfidence: baseValues.pitchConfidence,
        tonalScore: baseValues.tonalScore,
        melodicLabel: this.melodicLabel(baseValues.tonalScore, baseValues.pitchConfidence, baseValues.zeroCrossingRate),
        pitchRangeLabel: this.pitchRangeLabel(baseValues.estimatedPitch),
      },
    };

    return {
      descriptors,
      query: this.createEssentiaQuery(descriptors, 'melodic', audio.name),
      engine: baseValues.engine,
      notes: this.createNotes(baseValues.engine),
    };
  }

  createEssentiaQuery(
    descriptors: AudioDescriptorSummary,
    focus: SimilarityFocus,
    fileName?: string
  ): string {
    const fileTokens = fileName
      ?.replace(/\.[a-z0-9]+$/i, '')
      .split(/[\s_-]+/)
      .filter((token) => token.length > 2 && !/^\d+$/.test(token))
      .slice(0, 2);

    if (fileTokens?.length) {
      return fileTokens.join(' ');
    }

    if (focus === 'melodic') {
      if (descriptors.melody.melodicLabel === 'melodic') return 'melodic loop tone';
      if (descriptors.melody.melodicLabel === 'tonal') return 'tonal one shot';
      return descriptors.timbre.timbreLabel === 'noisy' ? 'noisy texture' : 'sound texture';
    }

    if (focus === 'bpm') {
      if (descriptors.rhythm.bpm) return `${Math.round(descriptors.rhythm.bpm)} bpm loop`;
      if (descriptors.rhythm.rhythmLabel === 'percussive') return 'percussive rhythm hit';
      return 'rhythmic loop';
    }

    if (focus === 'energy') {
      if (descriptors.energy.energyLabel === 'loud') return 'loud impact hit';
      if (descriptors.energy.energyLabel === 'quiet') return 'soft ambience texture';
      return 'balanced sound effect';
    }

    if (descriptors.timbre.brightnessLabel === 'bright') return 'bright timbre sound';
    if (descriptors.timbre.brightnessLabel === 'dark') return 'dark timbre sound';
    if (descriptors.timbre.timbreLabel === 'noisy') return 'noisy texture';
    return 'clean texture';
  }

  private async extractValues(samples: Float32Array, sampleRate: number): Promise<BaseValues> {
    const fallback = this.extractFallbackValues(samples, sampleRate);

    try {
      const essentia = await this.getEssentia();
      if (!essentia) return fallback;

      const vector = essentia.arrayToVector(samples);
      const rmsResult = essentia.RMS?.(vector) || {};
      const energyResult = essentia.Energy?.(vector) || {};
      const zcrResult = essentia.ZeroCrossingRate?.(vector, 0.0001) || {};
      const centroidResult = essentia.SpectralCentroidTime?.(vector, sampleRate) || {};

      return {
        ...fallback,
        rms: this.readNumber(rmsResult, ['rms', 'RMS'], fallback.rms),
        energy: this.readNumber(energyResult, ['energy'], fallback.energy),
        zeroCrossingRate: this.readNumber(
          zcrResult,
          ['zeroCrossingRate', 'zerocrossingrate'],
          fallback.zeroCrossingRate
        ),
        spectralCentroid: this.readNumber(
          centroidResult,
          ['centroid', 'spectralCentroid', 'spectral_centroid'],
          fallback.spectralCentroid
        ),
        engine: 'essentia.js',
      };
    } catch (error) {
      console.warn('Essentia.js failed. Using Web Audio fallback descriptors.', error);
      return fallback;
    }
  }

  private async getEssentia(): Promise<EssentiaInstance | null> {
    if (!this.essentiaPromise) {
      this.essentiaPromise = this.loadEssentia();
    }

    return this.essentiaPromise;
  }

  private async loadEssentia(): Promise<EssentiaInstance | null> {
    try {
      const [{ EssentiaWASM }, { default: Essentia }] = await Promise.all([
        import('essentia.js/dist/essentia-wasm.es.js'),
        import('essentia.js/dist/essentia.js-core.es.js'),
      ]);
      const EssentiaClass = Essentia as EssentiaConstructor;
      return new EssentiaClass(EssentiaWASM, false);
    } catch (error) {
      console.warn('Essentia.js could not be loaded.', error);
      return null;
    }
  }

  private extractSelectedMonoSamples(audioBuffer: AudioBuffer, trimSelection?: AudioTrimSelection | null): Float32Array {
    const sampleRate = audioBuffer.sampleRate;
    const startTime = clamp(trimSelection?.start ?? 0, 0, audioBuffer.duration);
    const endTime = clamp(trimSelection?.end ?? audioBuffer.duration, startTime, audioBuffer.duration);
    const startIndex = Math.floor(startTime * sampleRate);
    const endIndex = Math.max(startIndex + 1, Math.floor(endTime * sampleRate));
    const length = endIndex - startIndex;
    const mono = new Float32Array(length);

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        mono[index] += channelData[startIndex + index] / audioBuffer.numberOfChannels;
      }
    }

    return mono;
  }

  private extractFallbackValues(samples: Float32Array, sampleRate: number): BaseValues {
    let sumSquares = 0;
    let peakAmplitude = 0;
    let zeroCrossings = 0;
    let minAmplitude = 1;
    let maxAmplitude = -1;

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];
      const absolute = Math.abs(sample);
      sumSquares += sample * sample;
      peakAmplitude = Math.max(peakAmplitude, absolute);
      minAmplitude = Math.min(minAmplitude, sample);
      maxAmplitude = Math.max(maxAmplitude, sample);

      if (index > 0 && Math.sign(sample) !== Math.sign(samples[index - 1])) {
        zeroCrossings += 1;
      }
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, samples.length));
    const zeroCrossingRate = zeroCrossings / Math.max(1, samples.length);
    const spectralCentroid = this.estimateSpectralCentroid(samples, sampleRate);
    const spectralRolloff = this.estimateSpectralRolloff(samples, sampleRate);
    const spectralFlatness = this.estimateSpectralFlatness(samples);
    const rhythm = this.estimateRhythm(samples, sampleRate, rms);
    const pitch = this.estimatePitch(samples, sampleRate);
    const tonalScore = clamp((pitch.confidence * 0.72) + ((1 - zeroCrossingRate * 18) * 0.28), 0, 1);

    return {
      rms,
      energy: sumSquares,
      peakAmplitude,
      zeroCrossingRate,
      spectralCentroid,
      spectralRolloff,
      spectralFlatness,
      dynamicRange: maxAmplitude - minAmplitude,
      onsetRate: rhythm.onsetRate,
      percussiveScore: rhythm.percussiveScore,
      bpm: rhythm.bpm,
      bpmConfidence: rhythm.bpmConfidence,
      estimatedPitch: pitch.pitch,
      pitchConfidence: pitch.confidence,
      tonalScore,
      engine: 'web-audio-fallback',
    };
  }

  private estimateSpectralCentroid(samples: Float32Array, sampleRate: number): number {
    const fftSize = Math.min(2048, samples.length);
    if (fftSize < 32) return 0;

    let weightedSum = 0;
    let magnitudeSum = 0;
    const step = Math.max(1, Math.floor(samples.length / fftSize));

    for (let bin = 1; bin < fftSize / 2; bin += 1) {
      const index = clamp(bin * step, 0, samples.length - 1);
      const magnitude = Math.abs(samples[index]);
      const frequency = (bin * sampleRate) / fftSize;
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum === 0 ? 0 : weightedSum / magnitudeSum;
  }

  private estimateSpectralRolloff(samples: Float32Array, sampleRate: number): number {
    const fftSize = Math.min(2048, samples.length);
    if (fftSize < 32) return 0;

    const energies: number[] = [];
    let totalEnergy = 0;
    const step = Math.max(1, Math.floor(samples.length / fftSize));

    for (let bin = 1; bin < fftSize / 2; bin += 1) {
      const magnitude = Math.abs(samples[clamp(bin * step, 0, samples.length - 1)]);
      const energy = magnitude * magnitude;
      energies.push(energy);
      totalEnergy += energy;
    }

    const target = totalEnergy * 0.85;
    let cumulative = 0;

    for (let index = 0; index < energies.length; index += 1) {
      cumulative += energies[index];
      if (cumulative >= target) {
        return ((index + 1) * sampleRate) / fftSize;
      }
    }

    return sampleRate / 2;
  }

  private estimateSpectralFlatness(samples: Float32Array): number {
    const fftSize = Math.min(2048, samples.length);
    if (fftSize < 32) return 0;

    const step = Math.max(1, Math.floor(samples.length / fftSize));
    let logSum = 0;
    let linearSum = 0;
    let count = 0;

    for (let bin = 1; bin < fftSize / 2; bin += 1) {
      const magnitude = Math.abs(samples[clamp(bin * step, 0, samples.length - 1)]) + 1e-8;
      logSum += Math.log(magnitude);
      linearSum += magnitude;
      count += 1;
    }

    const geometricMean = Math.exp(logSum / Math.max(1, count));
    const arithmeticMean = linearSum / Math.max(1, count);
    return clamp(geometricMean / Math.max(arithmeticMean, 1e-8), 0, 1);
  }

  private estimateRhythm(samples: Float32Array, sampleRate: number, rms: number) {
    const frameSize = 1024;
    const hopSize = 512;
    const envelope: number[] = [];

    for (let start = 0; start + frameSize < samples.length; start += hopSize) {
      let frameEnergy = 0;
      for (let index = start; index < start + frameSize; index += 1) {
        frameEnergy += samples[index] * samples[index];
      }
      envelope.push(frameEnergy / frameSize);
    }

    if (envelope.length < 4) {
      return { onsetRate: 0, percussiveScore: 0, bpm: null, bpmConfidence: 0 };
    }

    const flux: number[] = [];
    let onsetCount = 0;
    let positiveFluxSum = 0;
    const averageEnergy = envelope.reduce((sum, value) => sum + value, 0) / envelope.length;
    const threshold = averageEnergy * 0.7;

    for (let index = 1; index < envelope.length; index += 1) {
      const positiveFlux = Math.max(0, envelope[index] - envelope[index - 1]);
      flux.push(positiveFlux);
      positiveFluxSum += positiveFlux;
      if (positiveFlux > threshold) onsetCount += 1;
    }

    const duration = samples.length / sampleRate;
    const onsetRate = onsetCount / Math.max(duration, 0.001);
    const percussiveScore = clamp(positiveFluxSum / Math.max(rms * flux.length, 0.0001), 0, 1);
    const bpmEstimate = this.estimateBpmFromFlux(flux, sampleRate / hopSize);

    return {
      onsetRate,
      percussiveScore,
      bpm: bpmEstimate.bpm,
      bpmConfidence: bpmEstimate.confidence,
    };
  }

  private estimateBpmFromFlux(flux: number[], fluxRate: number): { bpm: number | null; confidence: number } {
    if (flux.length < 12) return { bpm: null, confidence: 0 };

    const minBpm = 60;
    const maxBpm = 180;
    const minLag = Math.floor((60 / maxBpm) * fluxRate);
    const maxLag = Math.ceil((60 / minBpm) * fluxRate);
    let bestLag = 0;
    let bestScore = 0;
    let totalScore = 0;

    for (let lag = Math.max(1, minLag); lag <= Math.min(maxLag, flux.length - 1); lag += 1) {
      let score = 0;
      for (let index = lag; index < flux.length; index += 1) {
        score += flux[index] * flux[index - lag];
      }

      totalScore += score;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }

    if (!bestLag || bestScore <= 0) return { bpm: null, confidence: 0 };

    return {
      bpm: clamp((60 * fluxRate) / bestLag, minBpm, maxBpm),
      confidence: clamp(bestScore / Math.max(totalScore, 1e-8), 0, 1),
    };
  }

  private estimatePitch(samples: Float32Array, sampleRate: number): { pitch: number | null; confidence: number } {
    const maxSamples = Math.min(samples.length, Math.floor(sampleRate * 0.7));
    if (maxSamples < sampleRate * 0.05) return { pitch: null, confidence: 0 };

    const minFrequency = 80;
    const maxFrequency = 1000;
    const minLag = Math.floor(sampleRate / maxFrequency);
    const maxLag = Math.floor(sampleRate / minFrequency);
    let bestLag = 0;
    let bestCorrelation = 0;
    let zeroLag = 0;

    for (let index = 0; index < maxSamples; index += 1) {
      zeroLag += samples[index] * samples[index];
    }

    if (zeroLag <= 1e-8) return { pitch: null, confidence: 0 };

    for (let lag = minLag; lag <= Math.min(maxLag, maxSamples - 1); lag += 1) {
      let correlation = 0;
      for (let index = 0; index < maxSamples - lag; index += 1) {
        correlation += samples[index] * samples[index + lag];
      }

      const normalized = correlation / zeroLag;
      if (normalized > bestCorrelation) {
        bestCorrelation = normalized;
        bestLag = lag;
      }
    }

    if (!bestLag || bestCorrelation < 0.18) return { pitch: null, confidence: clamp(bestCorrelation, 0, 1) };

    return {
      pitch: sampleRate / bestLag,
      confidence: clamp(bestCorrelation, 0, 1),
    };
  }

  private readNumber(source: Record<string, number>, keys: string[], fallback: number): number {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return fallback;
  }

  private energyLabel(rms: number) {
    if (rms < 0.04) return 'quiet' as const;
    if (rms > 0.16) return 'loud' as const;
    return 'balanced' as const;
  }

  private brightnessLabel(spectralCentroid: number) {
    if (spectralCentroid < 900) return 'dark' as const;
    if (spectralCentroid > 2600) return 'bright' as const;
    return 'balanced' as const;
  }

  private timbreLabel(spectralCentroid: number, zcr: number, flatness: number) {
    if (flatness > 0.55 || zcr > 0.14) return 'noisy' as const;
    if (spectralCentroid > 3200) return 'bright' as const;
    if (spectralCentroid < 700) return 'dark' as const;
    if (flatness > 0.34) return 'textured' as const;
    return 'clean' as const;
  }

  private rhythmLabel(percussiveScore: number, onsetRate: number, duration: number) {
    if (duration < 1.3) return 'one-shot' as const;
    if (percussiveScore > 0.55 || onsetRate > 2.8) return 'percussive' as const;
    if (onsetRate > 1.2) return 'loop-like' as const;
    return 'sustained' as const;
  }

  private melodicLabel(tonalScore: number, pitchConfidence: number, zeroCrossingRate: number) {
    if (tonalScore > 0.68 && pitchConfidence > 0.38) return 'melodic' as const;
    if (tonalScore > 0.48) return 'tonal' as const;
    if (zeroCrossingRate > 0.16) return 'noisy' as const;
    return 'textured' as const;
  }

  private pitchRangeLabel(pitch: number | null): string {
    if (!pitch) return '--';
    if (pitch < 160) return 'low';
    if (pitch < 500) return 'mid';
    return 'high';
  }

  private createNotes(engine: AudioAnalysisResult['engine']): string[] {
    if (engine === 'essentia.js') {
      return [
        'Essentia.js analyzed the selected audio directly in the browser.',
        'The descriptors are used for the Essentia search mode: timbre, rhythm, melody and energy.',
      ];
    }

    return [
      'Essentia.js could not be loaded, so the browser fallback calculated equivalent descriptors.',
      'The same descriptor structure is kept so the interface can still run.',
    ];
  }
}

export const audioAnalysisService = new AudioAnalysisService();