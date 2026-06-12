import {
  AudioAnalysisResult,
  AudioDescriptorSources,
  AudioDescriptorSummary,
  AudioTrimSelection,
  DescriptorProvenance,
  RecordedAudio,
  SimilarityFocus,
} from './types';
import { audioService } from './audio';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const ESSENTIA_SOURCE: DescriptorProvenance = {
  source: 'essentia.js',
};

type UnknownResult = Record<string, unknown>;

interface BaseValues {
  rms: number | null;
  energy: number | null;
  dynamicComplexity: number | null;
  peakAmplitude: number;
  dynamicRange: number;
  zeroCrossingRate: number | null;
  spectralCentroid: number | null;
  spectralRolloff: number | null;
  spectralFlatness: number | null;
  bpm: number | null;
  bpmConfidence: number | null;
  onsetRate: number | null;
  percussiveScore: number;
  estimatedPitch: number | null;
  pitchConfidence: number | null;
  tonalScore: number;
  sources: AudioDescriptorSources;
  missing: string[];
}

type EssentiaInstance = {
  arrayToVector: (input: Float32Array) => unknown;
  vectorToArray?: (input: unknown) => Float32Array | number[];

  RMS?: (input: unknown) => UnknownResult;
  Energy?: (input: unknown) => UnknownResult;
  DynamicComplexity?: (
    input: unknown,
    frameSize?: number,
    sampleRate?: number
  ) => UnknownResult;
  ZeroCrossingRate?: (
    input: unknown,
    threshold?: number
  ) => UnknownResult;
  SpectralCentroidTime?: (
    input: unknown,
    sampleRate?: number
  ) => UnknownResult;

  Windowing?: (
    input: unknown,
    normalized?: boolean,
    size?: number,
    type?: string,
    zeroPadding?: number,
    zeroPhase?: boolean
  ) => UnknownResult;
  Spectrum?: (
    frame: unknown,
    size?: number
  ) => UnknownResult;
  RollOff?: (
    spectrum: unknown,
    cutoff?: number,
    sampleRate?: number
  ) => UnknownResult;
  Flatness?: (spectrum: unknown) => UnknownResult;

  Resample?: (
    input: unknown,
    inputSampleRate?: number,
    outputSampleRate?: number,
    quality?: number
  ) => UnknownResult;
  ResampleFFT?: (
    input: unknown,
    inputSize?: number,
    outputSize?: number
  ) => UnknownResult;

  RhythmExtractor?: (
    input: unknown,
    frameHop?: number,
    frameSize?: number,
    hopSize?: number,
    lastBeatInterval?: number,
    maxTempo?: number,
    minTempo?: number,
    numberFrames?: number,
    sampleRate?: number,
    tempoHints?: unknown[],
    tolerance?: number,
    useBands?: boolean,
    useOnset?: boolean
  ) => UnknownResult;
  RhythmExtractor2013?: (
    input: unknown,
    maxTempo?: number,
    method?: string,
    minTempo?: number
  ) => UnknownResult;
  OnsetRate?: (input: unknown) => UnknownResult;

  PredominantPitchMelodia?: (
    input: unknown,
    binResolution?: number,
    filterIterations?: number,
    frameSize?: number,
    guessUnvoiced?: boolean,
    harmonicWeight?: number,
    hopSize?: number,
    magnitudeCompression?: number,
    magnitudeThreshold?: number,
    maxFrequency?: number,
    minDuration?: number,
    minFrequency?: number,
    numberHarmonics?: number,
    peakDistributionThreshold?: number,
    peakFrameThreshold?: number,
    pitchContinuity?: number,
    referenceFrequency?: number,
    sampleRate?: number,
    timeContinuity?: number,
    voiceVibrato?: boolean,
    voicingTolerance?: number
  ) => UnknownResult;
};

type EssentiaConstructor = new (
  wasmModule: unknown,
  isDebug?: boolean
) => EssentiaInstance;

class AudioAnalysisService {
  private essentiaPromise: Promise<EssentiaInstance | null> | null = null;
  private worker: Worker | null = null;

  private getWorker(): Worker | null {
    if (this.worker) {
      return this.worker;
    }

    try {
      this.worker = new Worker(
        new URL('./essentiaWorker.ts', import.meta.url),
        { type: 'module' }
      );

      return this.worker;
    } catch (error) {
      console.warn(
        '[AudioAnalysisService] Web Worker unavailable, running Essentia.js on the main thread.',
        error
      );

      return null;
    }
  }

  private extractValuesViaWorker(
    samples: Float32Array,
    sampleRate: number
  ): Promise<BaseValues> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();

      if (!worker) {
        reject(new Error('no-worker'));
        return;
      }

      const onMessage = (event: MessageEvent) => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);

        if (event.data?.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.values as BaseValues);
        }
      };

      const onError = (event: ErrorEvent) => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        reject(new Error(event.message));
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ samples, sampleRate }, [samples.buffer]);
    });
  }

  async analyze(
    audio: RecordedAudio,
    trimSelection?: AudioTrimSelection | null
  ): Promise<AudioAnalysisResult> {
    const audioBuffer = await audioService.decodeAudio(audio.blob);
    const selectedSamples = this.extractSelectedMonoSamples(
      audioBuffer,
      trimSelection
    );

    const selectedDuration = selectedSamples.length / audioBuffer.sampleRate;

    const values = await this.extractValues(
      selectedSamples,
      audioBuffer.sampleRate
    );

    const descriptors: AudioDescriptorSummary = {
      duration: audioBuffer.duration,
      selectedDuration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,

      melody: {
        estimatedPitch: values.estimatedPitch,
        pitchConfidence: values.pitchConfidence,
        tonalScore: values.tonalScore,
        melodicLabel: this.melodicLabel(
          values.tonalScore,
          values.pitchConfidence,
          values.zeroCrossingRate
        ),
        pitchRangeLabel: this.pitchRangeLabel(values.estimatedPitch),
      },

      rhythm: {
        bpm: values.bpm,
        bpmConfidence: values.bpmConfidence,
        onsetRate: values.onsetRate,
        percussiveScore: values.percussiveScore,
        rhythmLabel: this.rhythmLabel(
          values.percussiveScore,
          values.onsetRate,
          selectedDuration
        ),
      },

      timbre: {
        spectralCentroid: values.spectralCentroid,
        spectralRolloff: values.spectralRolloff,
        zeroCrossingRate: values.zeroCrossingRate,
        spectralFlatness: values.spectralFlatness,
        brightnessLabel: this.brightnessLabel(values.spectralCentroid),
        timbreLabel: this.timbreLabel(
          values.spectralCentroid,
          values.zeroCrossingRate,
          values.spectralFlatness
        ),
      },

      energy: {
        rms: values.rms,
        energy: values.energy,
        dynamicComplexity: values.dynamicComplexity,
        peakAmplitude: values.peakAmplitude,
        dynamicRange: values.dynamicRange,
        energyLabel: this.energyLabel(values.rms),
      },
    };

    return {
      descriptors,
      sources: values.sources,
      query: this.createEssentiaQuery(descriptors, 'general', audio.name),
      notes: this.createNotes(values.missing),
      engine: 'essentia.js',
      hasApproximations: false,
    };
  }

  createEssentiaQuery(
    descriptors: AudioDescriptorSummary,
    focus: SimilarityFocus,
    _fileName?: string
  ): string {
    if (focus === 'melodic') {
      const label = descriptors.melody.melodicLabel;
      const range = descriptors.melody.pitchRangeLabel;
      const pitch = descriptors.melody.estimatedPitch;

      if (label === 'melodic') {
        if (range === 'low') return 'bass melody instrument loop';
        if (range === 'high') return 'lead melody synth high pitched';
        return 'melodic instrument loop tonal';
      }

      if (label === 'tonal') {
        if (pitch && pitch < 200) return 'bass note instrument low';
        if (pitch && pitch > 600) return 'high pitched note tonal synth';
        return 'tonal note instrument single';
      }

      if (label === 'noisy') return 'atonal noise texture harsh';
      return 'pad texture drone sustained';
    }

    if (focus === 'bpm') {
      const bpm = descriptors.rhythm.bpm;
      const rhythmLabel = descriptors.rhythm.rhythmLabel;
      const percussive = descriptors.rhythm.percussiveScore;

      if (bpm) {
        const rounded = Math.round(bpm / 5) * 5;
        if (percussive > 0.5) return `${rounded} bpm drum loop percussion`;
        return `${rounded} bpm rhythm loop`;
      }

      if (rhythmLabel === 'one-shot') return 'one shot percussion hit transient';
      if (rhythmLabel === 'percussive') return 'percussion drum hit rhythmic';
      if (rhythmLabel === 'loop-like') return 'rhythm loop beat pattern';
      return 'rhythm groove loop';
    }

    if (focus === 'timbre') {
      const timbre = descriptors.timbre.timbreLabel;
      const brightness = descriptors.timbre.brightnessLabel;

      if (timbre === 'bright') return 'bright crisp high frequency shimmer';
      if (timbre === 'dark') return 'dark muted low frequency warm';
      if (timbre === 'noisy') return 'noise texture rough gritty';
      if (timbre === 'textured') return 'textured granular complex timbre';
      if (brightness === 'bright') return 'clean bright tone sample';
      if (brightness === 'dark') return 'clean dark warm tone';
      return 'clean pure tone sample';
    }

    const parts: string[] = [];

    if (descriptors.energy.energyLabel === 'loud') {
      parts.push('energetic loud');
    } else if (descriptors.energy.energyLabel === 'quiet') {
      parts.push('soft quiet');
    }

    if (descriptors.timbre.timbreLabel === 'bright') {
      parts.push('bright');
    } else if (descriptors.timbre.timbreLabel === 'dark') {
      parts.push('dark');
    } else if (descriptors.timbre.timbreLabel === 'noisy') {
      parts.push('noisy');
    }

    const bpm = descriptors.rhythm.bpm;

    if (bpm) {
      parts.push(`${Math.round(bpm / 5) * 5}bpm`);
    } else if (descriptors.rhythm.rhythmLabel === 'percussive') {
      parts.push('percussive');
    } else if (descriptors.rhythm.rhythmLabel === 'sustained') {
      parts.push('sustained');
    }

    if (descriptors.melody.melodicLabel === 'melodic') {
      parts.push('melodic');
    } else if (descriptors.melody.melodicLabel === 'tonal') {
      parts.push('tonal');
    }

    return parts.length ? `${parts.join(' ')} sound sample` : 'sound texture sample';
  }

  private async extractValues(
    samples: Float32Array,
    sampleRate: number
  ): Promise<BaseValues> {
    try {
      return await this.extractValuesViaWorker(samples.slice(), sampleRate);
    } catch (workerError) {
      console.warn(
        '[AudioAnalysisService] Worker extraction failed, running Essentia.js on the main thread.',
        workerError
      );
    }

    const essentia = await this.getEssentia();

    if (!essentia) {
      throw new Error('Essentia.js could not be loaded.');
    }

    return this.extractWithEssentiaInstance(essentia, samples, sampleRate);
  }

  private extractWithEssentiaInstance(
    essentia: EssentiaInstance,
    inputSamples: Float32Array,
    sampleRate: number
  ): BaseValues {
    // Mismo recorte que el worker: analizar más de 15 s no mejora la
    // tarjeta y dispara el coste en WASM monohilo.
    const maxSamples = Math.floor(15 * sampleRate);
    const samples =
      inputSamples.length > maxSamples
        ? inputSamples.subarray(
            Math.floor((inputSamples.length - maxSamples) / 2),
            Math.floor((inputSamples.length - maxSamples) / 2) + maxSamples
          )
        : inputSamples;
    const vector = essentia.arrayToVector(samples);
    const missing: string[] = [];

    const rms = this.readNumber(
      essentia.RMS?.(vector),
      ['rms', 'RMS']
    );

    if (rms === null) missing.push('RMS');

    const energy = this.readNumber(
      essentia.Energy?.(vector),
      ['energy']
    );

    if (energy === null) missing.push('energy');

    const dynamicComplexity = this.readNumber(
      essentia.DynamicComplexity?.(vector, 0.2, sampleRate),
      ['dynamicComplexity']
    );

    if (dynamicComplexity === null) missing.push('dynamic complexity');

    const zeroCrossingRate = this.readNumber(
      essentia.ZeroCrossingRate?.(vector, 0.0001),
      ['zeroCrossingRate', 'zerocrossingrate']
    );

    if (zeroCrossingRate === null) missing.push('zero-crossing rate');

    const spectralCentroid = this.readNumber(
      essentia.SpectralCentroidTime?.(vector, sampleRate),
      ['centroid', 'spectralCentroid', 'spectral_centroid']
    );

    if (spectralCentroid === null) missing.push('spectral centroid');

    const spectral = this.extractSpectralDescriptors(
      essentia,
      samples,
      sampleRate
    );

    if (spectral.rolloff === null) missing.push('spectral rolloff');
    if (spectral.flatness === null) missing.push('spectral flatness');

    const melody = this.extractMelodyDescriptors(
      essentia,
      samples,
      sampleRate
    );

    if (melody.pitch === null) missing.push('predominant pitch');
    if (melody.confidence === null) missing.push('pitch confidence');

    const rhythm = this.extractRhythmDescriptors(
      essentia,
      vector,
      sampleRate
    );

    if (rhythm.bpm === null) missing.push('BPM');
    if (rhythm.confidence === null) missing.push('rhythm confidence');
    if (rhythm.onsetRate === null) missing.push('onset rate');

    const amplitude = this.extractAmplitudeStats(samples);

    const safeZcr = zeroCrossingRate ?? 0;
    const safePitchConfidence = melody.confidence ?? 0;
    const tonalScore = clamp(
      safePitchConfidence * 0.72 +
        (1 - safeZcr * 18) * 0.28,
      0,
      1
    );

    const safeOnsetRate = rhythm.onsetRate ?? 0;
    const percussiveScore = clamp(
      safeOnsetRate / 6,
      0,
      1
    );

    return {
      rms,
      energy,
      dynamicComplexity,
      peakAmplitude: amplitude.peakAmplitude,
      dynamicRange: amplitude.dynamicRange,
      zeroCrossingRate,
      spectralCentroid,
      spectralRolloff: spectral.rolloff,
      spectralFlatness: spectral.flatness,
      bpm: rhythm.bpm,
      bpmConfidence: rhythm.confidence,
      onsetRate: rhythm.onsetRate,
      percussiveScore,
      estimatedPitch: melody.pitch,
      pitchConfidence: melody.confidence,
      tonalScore,
      sources: this.essentiaSources(),
      missing,
    };
  }

  private extractSpectralDescriptors(
    essentia: EssentiaInstance,
    samples: Float32Array,
    sampleRate: number
  ): {
    rolloff: number | null;
    flatness: number | null;
  } {
    if (!essentia.Windowing || !essentia.Spectrum) {
      return {
        rolloff: null,
        flatness: null,
      };
    }

    // Sin solapamiento: para el promedio de rolloff/flatness de la tarjeta
    // basta, y reduce 4× las llamadas WASM (igual que en essentiaWorker).
    const frameSize = 2048;
    const hopSize = 4096;
    let rolloffSum = 0;
    let rolloffCount = 0;
    let flatnessSum = 0;
    let flatnessCount = 0;

    for (
      let start = 0;
      start + frameSize <= samples.length;
      start += hopSize
    ) {
      const frame = samples.slice(start, start + frameSize);
      const frameVector = essentia.arrayToVector(frame);

      const windowed = essentia.Windowing(
        frameVector,
        false,
        frameSize,
        'hann',
        0,
        false
      );

      const frameData =
        windowed.frame ||
        windowed.signal ||
        windowed.windowedFrame;

      if (!frameData) {
        continue;
      }

      const spectrum = essentia.Spectrum(frameData, frameSize);
      const spectrumData =
        spectrum.spectrum ||
        spectrum.frame ||
        spectrum.signal;

      if (!spectrumData) {
        continue;
      }

      const rolloff = this.readNumber(
        essentia.RollOff?.(spectrumData, 0.85, sampleRate),
        ['rollOff', 'rolloff', 'spectralRolloff']
      );

      if (rolloff !== null) {
        rolloffSum += rolloff;
        rolloffCount += 1;
      }

      const flatness = this.readNumber(
        essentia.Flatness?.(spectrumData),
        ['flatness']
      );

      if (flatness !== null) {
        flatnessSum += flatness;
        flatnessCount += 1;
      }
    }

    return {
      rolloff: rolloffCount ? rolloffSum / rolloffCount : null,
      flatness: flatnessCount ? flatnessSum / flatnessCount : null,
    };
  }

  private extractMelodyDescriptors(
    essentia: EssentiaInstance,
    samples: Float32Array,
    sampleRate: number
  ): {
    pitch: number | null;
    confidence: number | null;
  } {
    if (!essentia.PredominantPitchMelodia) {
      return {
        pitch: null,
        confidence: null,
      };
    }

    try {
      const vector =
        sampleRate === 44100
          ? essentia.arrayToVector(samples)
          : this.resampleTo44100(essentia, samples, sampleRate);

      if (!vector) {
        return {
          pitch: null,
          confidence: null,
        };
      }

      const result = essentia.PredominantPitchMelodia(
        vector,
        10,
        3,
        2048,
        false,
        0.8,
        // hop 512 (≈12 ms): 4× menos frames que el default 128, igual que
        // en essentiaWorker.
        512,
        1,
        40,
        20000,
        0.1,
        80,
        20,
        0.9,
        0.9,
        27.5625,
        440,
        44100,
        27.5625,
        false,
        0.2
      );

      const pitchValues = this.readVector(
        result.pitch || result.pitches,
        essentia
      );

      const confidenceValues = this.readVector(
        result.pitchConfidence ||
          result.pitchConfidences ||
          result.confidence,
        essentia
      );

      if (!pitchValues.length) {
        return {
          pitch: null,
          confidence: null,
        };
      }

      let weightedPitch = 0;
      let confidenceSum = 0;
      let confidenceTotal = 0;

      pitchValues.forEach((pitch, index) => {
        if (pitch <= 0 || !Number.isFinite(pitch)) {
          return;
        }

        const confidence =
          confidenceValues[index] ??
          confidenceValues[0] ??
          1;

        const safeConfidence = clamp(confidence, 0, 1);

        weightedPitch += pitch * safeConfidence;
        confidenceSum += safeConfidence;
        confidenceTotal += safeConfidence;
      });

      if (confidenceSum <= 0) {
        return {
          pitch: null,
          confidence: confidenceValues.length
            ? clamp(
                confidenceValues.reduce((sum, value) => sum + value, 0) /
                  confidenceValues.length,
                0,
                1
              )
            : null,
        };
      }

      return {
        pitch: weightedPitch / confidenceSum,
        confidence: clamp(
          confidenceTotal / Math.max(pitchValues.length, 1),
          0,
          1
        ),
      };
    } catch (error) {
      console.warn('Essentia.js could not calculate melody.', error);

      return {
        pitch: null,
        confidence: null,
      };
    }
  }

  private confidenceFromTicks(ticks: number[]): number | null {
    if (ticks.length < 3) {
      return null;
    }

    const intervals: number[] = [];

    for (let index = 1; index < ticks.length; index += 1) {
      const interval = ticks[index] - ticks[index - 1];

      if (interval > 0) {
        intervals.push(interval);
      }
    }

    if (intervals.length < 2) {
      return null;
    }

    const mean =
      intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      intervals.length;
    const variation = Math.sqrt(variance) / mean;

    // Beats perfectamente regulares → 1; variación del 50 % o más → 0.
    return clamp(1 - variation * 2, 0, 1);
  }

  private extractRhythmDescriptors(
    essentia: EssentiaInstance,
    vector: unknown,
    sampleRate: number
  ): {
    bpm: number | null;
    confidence: number | null;
    onsetRate: number | null;
  } {
    let bpm: number | null = null;
    let confidence: number | null = null;
    let onsetRate: number | null = null;

    try {
      const rhythm = essentia.RhythmExtractor?.(
        vector,
        1024,
        1024,
        256,
        0.1,
        208,
        40,
        1024,
        sampleRate,
        [],
        0.24,
        true,
        true
      );

      bpm = this.readNumber(
        rhythm,
        ['bpm']
      );

      if (rhythm) {
        confidence = this.confidenceFromTicks(
          this.readVector(rhythm.ticks, essentia)
        );
      }
    } catch (error) {
      console.warn('Essentia.js could not calculate BPM.', error);
    }

    // RhythmExtractor2013 'multifeature' es el algoritmo más lento del
    // análisis: solo como respaldo si el extractor rápido no encontró BPM.
    if (bpm === null || bpm <= 0) {
      try {
        const rhythm2013 = essentia.RhythmExtractor2013?.(
          vector,
          208,
          'multifeature',
          40
        );

        const extractedConfidence = this.readNumber(
          rhythm2013,
          ['confidence']
        );

        if (extractedConfidence !== null) {
          confidence = clamp(extractedConfidence, 0, 1);
        }

        const extractedBpm = this.readNumber(
          rhythm2013,
          ['bpm']
        );

        if (extractedBpm !== null && extractedBpm > 0) {
          bpm = extractedBpm;
        }
      } catch (error) {
        console.warn('Essentia.js could not calculate rhythm confidence.', error);
      }
    }

    try {
      onsetRate = this.readNumber(
        essentia.OnsetRate?.(vector),
        ['onsetRate']
      );
    } catch (error) {
      console.warn('Essentia.js could not calculate onset rate.', error);
    }

    return {
      bpm: bpm !== null && bpm > 0 ? bpm : null,
      confidence,
      onsetRate,
    };
  }

  private resampleTo44100(
    essentia: EssentiaInstance,
    samples: Float32Array,
    sampleRate: number
  ): unknown | null {
    if (sampleRate === 44100) {
      return essentia.arrayToVector(samples);
    }

    const sourceVector = essentia.arrayToVector(samples);

    try {
      const signal = essentia.Resample?.(
        sourceVector,
        sampleRate,
        44100,
        0
      ).signal;

      if (signal) {
        return signal;
      }
    } catch (error) {
      console.warn('Essentia.js Resample failed.', error);
    }

    try {
      if (!essentia.ResampleFFT) {
        return null;
      }

      const inputSize =
        samples.length % 2 === 0
          ? samples.length
          : samples.length - 1;

      if (inputSize < 2) {
        return null;
      }

      let outputSize = Math.round(
        inputSize * 44100 / sampleRate
      );

      if (outputSize % 2 !== 0) {
        outputSize += 1;
      }

      const input = essentia.arrayToVector(
        samples.slice(0, inputSize)
      );

      return essentia.ResampleFFT(
        input,
        inputSize,
        outputSize
      ).output || null;
    } catch (error) {
      console.warn('Essentia.js ResampleFFT failed.', error);
      return null;
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

  private extractSelectedMonoSamples(
    audioBuffer: AudioBuffer,
    trimSelection?: AudioTrimSelection | null
  ): Float32Array {
    const sampleRate = audioBuffer.sampleRate;

    const start = Math.floor(
      clamp(
        trimSelection?.start ?? 0,
        0,
        audioBuffer.duration
      ) * sampleRate
    );

    const end = Math.max(
      start + 1,
      Math.floor(
        clamp(
          trimSelection?.end ?? audioBuffer.duration,
          0,
          audioBuffer.duration
        ) * sampleRate
      )
    );

    const mono = new Float32Array(end - start);

    for (
      let channel = 0;
      channel < audioBuffer.numberOfChannels;
      channel += 1
    ) {
      const data = audioBuffer.getChannelData(channel);

      for (let index = 0; index < mono.length; index += 1) {
        mono[index] +=
          data[start + index] / audioBuffer.numberOfChannels;
      }
    }

    return mono;
  }

  private extractAmplitudeStats(samples: Float32Array): {
    peakAmplitude: number;
    dynamicRange: number;
  } {
    let peakAmplitude = 0;
    let minAmplitude = 1;
    let maxAmplitude = -1;

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];

      peakAmplitude = Math.max(peakAmplitude, Math.abs(sample));
      minAmplitude = Math.min(minAmplitude, sample);
      maxAmplitude = Math.max(maxAmplitude, sample);
    }

    return {
      peakAmplitude,
      dynamicRange: maxAmplitude - minAmplitude,
    };
  }

  private essentiaSources(): AudioDescriptorSources {
    return {
      melody: {
        estimatedPitch: ESSENTIA_SOURCE,
        pitchConfidence: ESSENTIA_SOURCE,
      },
      rhythm: {
        bpm: ESSENTIA_SOURCE,
        bpmConfidence: ESSENTIA_SOURCE,
        onsetRate: ESSENTIA_SOURCE,
      },
      timbre: {
        spectralCentroid: ESSENTIA_SOURCE,
        spectralRolloff: ESSENTIA_SOURCE,
        spectralFlatness: ESSENTIA_SOURCE,
        zeroCrossingRate: ESSENTIA_SOURCE,
      },
      energy: {
        rms: ESSENTIA_SOURCE,
        energy: ESSENTIA_SOURCE,
        dynamicComplexity: ESSENTIA_SOURCE,
      },
    };
  }

  private readNumber(
    result: UnknownResult | undefined,
    keys: string[]
  ): number | null {
    if (!result) {
      return null;
    }

    for (const key of keys) {
      const value = result[key];

      if (
        typeof value === 'number' &&
        Number.isFinite(value)
      ) {
        return value;
      }
    }

    return null;
  }

  private readVector(
    value: unknown,
    essentia: EssentiaInstance
  ): number[] {
    if (value instanceof Float32Array) {
      return Array.from(value);
    }

    if (Array.isArray(value)) {
      return value.filter(
        (item): item is number =>
          typeof item === 'number' &&
          Number.isFinite(item)
      );
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return [value];
    }

    if (value && essentia.vectorToArray) {
      return Array.from(
        essentia.vectorToArray(value)
      ).filter(
        (item): item is number =>
          typeof item === 'number' &&
          Number.isFinite(item)
      );
    }

    return [];
  }

  private energyLabel(
    rms: number | null
  ): 'quiet' | 'balanced' | 'loud' {
    if (rms === null) {
      return 'balanced';
    }

    if (rms < 0.04) {
      return 'quiet';
    }

    if (rms > 0.16) {
      return 'loud';
    }

    return 'balanced';
  }

  private brightnessLabel(
    centroid: number | null
  ): 'dark' | 'balanced' | 'bright' {
    if (centroid === null) {
      return 'balanced';
    }

    if (centroid < 900) {
      return 'dark';
    }

    if (centroid > 2600) {
      return 'bright';
    }

    return 'balanced';
  }

  private timbreLabel(
    centroid: number | null,
    zcr: number | null,
    flatness: number | null
  ): 'clean' | 'noisy' | 'bright' | 'dark' | 'textured' {
    const safeCentroid = centroid ?? 0;
    const safeZcr = zcr ?? 0;
    const safeFlatness = flatness ?? 0;

    if (safeFlatness > 0.55 || safeZcr > 0.14) {
      return 'noisy';
    }

    if (safeCentroid > 3200) {
      return 'bright';
    }

    if (safeCentroid > 0 && safeCentroid < 700) {
      return 'dark';
    }

    if (safeFlatness > 0.34) {
      return 'textured';
    }

    return 'clean';
  }

  private rhythmLabel(
    score: number,
    rate: number | null,
    duration: number
  ): 'one-shot' | 'percussive' | 'loop-like' | 'sustained' {
    const safeRate = rate ?? 0;

    if (duration < 1.3) {
      return 'one-shot';
    }

    if (score > 0.55 || safeRate > 2.8) {
      return 'percussive';
    }

    if (safeRate > 1.2) {
      return 'loop-like';
    }

    return 'sustained';
  }

  private melodicLabel(
    score: number,
    confidence: number | null,
    zcr: number | null
  ): 'melodic' | 'tonal' | 'textured' | 'noisy' {
    const safeConfidence = confidence ?? 0;
    const safeZcr = zcr ?? 0;

    if (score > 0.68 && safeConfidence > 0.38) {
      return 'melodic';
    }

    if (score > 0.48) {
      return 'tonal';
    }

    if (safeZcr > 0.16) {
      return 'noisy';
    }

    return 'textured';
  }

  private pitchRangeLabel(
    pitch: number | null
  ): string {
    if (!pitch) {
      return '--';
    }

    if (pitch < 160) {
      return 'low';
    }

    if (pitch < 500) {
      return 'mid';
    }

    return 'high';
  }

  private createNotes(missing: string[]): string[] {
    if (!missing.length) {
      return [
        'All displayed descriptor metrics were calculated with Essentia.js.',
      ];
    }

    return [
      `Essentia.js did not return a reliable value for: ${missing.join(', ')}. These fields are left empty instead of using approximations.`,
    ];
  }
}

export const audioAnalysisService = new AudioAnalysisService();