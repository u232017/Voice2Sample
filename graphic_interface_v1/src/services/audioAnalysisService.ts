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
  rms: number;
  energy: number;
  dynamicComplexity: number;
  peakAmplitude: number;
  dynamicRange: number;
  zeroCrossingRate: number;
  spectralCentroid: number;
  spectralRolloff: number;
  spectralFlatness: number;
  bpm: number | null;
  bpmConfidence: number;
  onsetRate: number;
  percussiveScore: number;
  estimatedPitch: number | null;
  pitchConfidence: number;
  tonalScore: number;
  sources: AudioDescriptorSources;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private essentiaPromise: Promise<EssentiaInstance | null> | null = null;

  // Worker that runs WASM off the main thread so the UI never freezes.
  private worker: Worker | null = null;

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    try {
      this.worker = new Worker(
        new URL('./essentiaWorker.ts', import.meta.url),
        { type: 'module' }
      );
      return this.worker;
    } catch (e) {
      console.warn('[AudioAnalysisService] Web Worker unavailable, falling back to main thread.', e);
      return null;
    }
  }

  // Send samples to the worker and wait for the result.
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
      const onMessage = (e: MessageEvent) => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.values as BaseValues);
      };
      const onError = (e: ErrorEvent) => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        reject(new Error(e.message));
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      // Transfer the buffer so no copy is needed.
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

    const allSources = this.flattenSources(values.sources);
    const essentiaCount = allSources.filter(
      (source) => source.source === 'essentia.js'
    ).length;
    const hasApproximations = allSources.some(
      (source) => source.source === 'approximation'
    );

    const engine: AudioAnalysisResult['engine'] =
      essentiaCount === 0
        ? 'approximation'
        : hasApproximations
          ? 'mixed-analysis'
          : 'essentia.js';

    return {
      descriptors,
      sources: values.sources,
      query: this.createEssentiaQuery(descriptors, 'general', audio.name),
      notes: this.createNotes(engine),
      engine,
      hasApproximations,
    };
  }

  createEssentiaQuery(
    descriptors: AudioDescriptorSummary,
    focus: SimilarityFocus,
    _fileName?: string
  ): string {
    // Always derive the query from audio descriptors.
    // File names are unreliable as search terms and are ignored.

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

    // focus === 'general': combine ALL descriptor families for a balanced query
    const parts: string[] = [];

    if (descriptors.energy.energyLabel === 'loud') parts.push('energetic loud');
    else if (descriptors.energy.energyLabel === 'quiet') parts.push('soft quiet');

    if (descriptors.timbre.timbreLabel === 'bright') parts.push('bright');
    else if (descriptors.timbre.timbreLabel === 'dark') parts.push('dark');
    else if (descriptors.timbre.timbreLabel === 'noisy') parts.push('noisy');

    const bpm = descriptors.rhythm.bpm;
    if (bpm) {
      const rounded = Math.round(bpm / 5) * 5;
      parts.push(`${rounded}bpm`);
    } else if (descriptors.rhythm.rhythmLabel === 'percussive') {
      parts.push('percussive');
    } else if (descriptors.rhythm.rhythmLabel === 'sustained') {
      parts.push('sustained');
    }

    if (descriptors.melody.melodicLabel === 'melodic') parts.push('melodic');
    else if (descriptors.melody.melodicLabel === 'tonal') parts.push('tonal');

    if (parts.length === 0) return 'sound texture sample';
    return parts.join(' ') + ' sound sample';
  }

  private async extractValues(
    samples: Float32Array,
    sampleRate: number
  ): Promise<BaseValues> {
    // Try the Worker first -- keeps WASM off the main thread.
    try {
      const samplesCopy = samples.slice();
      return await this.extractValuesViaWorker(samplesCopy, sampleRate);
    } catch (workerError) {
      console.warn(
        "[AudioAnalysisService] Worker extraction failed, running on main thread.",
        workerError
      );
    }

    // Fallback: main-thread path (original behaviour)
    const values = this.extractFallbackValues(samples, sampleRate);
    const essentia = await this.getEssentia();

    if (!essentia) {
      return values;
    }

    const vector = essentia.arrayToVector(samples);

    const rms = this.tryNumeric(
      () => essentia.RMS?.(vector),
      ['rms', 'RMS'],
      values.rms,
      'RMS'
    );

    values.rms = rms.value;
    values.sources.energy.rms = rms.provenance;

    const energy = this.tryNumeric(
      () => essentia.Energy?.(vector),
      ['energy'],
      values.energy,
      'energy'
    );

    values.energy = energy.value;
    values.sources.energy.energy = energy.provenance;

    const dynamicComplexity = this.tryNumeric(
      () => essentia.DynamicComplexity?.(vector, 0.2, sampleRate),
      ['dynamicComplexity'],
      values.dynamicComplexity,
      'dynamic complexity'
    );

    values.dynamicComplexity = dynamicComplexity.value;
    values.sources.energy.dynamicComplexity = dynamicComplexity.provenance;

    const zeroCrossingRate = this.tryNumeric(
      () => essentia.ZeroCrossingRate?.(vector, 0.0001),
      ['zeroCrossingRate', 'zerocrossingrate'],
      values.zeroCrossingRate,
      'zero-crossing rate'
    );

    values.zeroCrossingRate = zeroCrossingRate.value;
    values.sources.timbre.zeroCrossingRate = zeroCrossingRate.provenance;

    const spectralCentroid = this.tryNumeric(
      () => essentia.SpectralCentroidTime?.(vector, sampleRate),
      ['centroid', 'spectralCentroid', 'spectral_centroid'],
      values.spectralCentroid,
      'spectral centroid'
    );

    values.spectralCentroid = spectralCentroid.value;
    values.sources.timbre.spectralCentroid = spectralCentroid.provenance;

    const spectral = this.trySpectralDescriptors(
      essentia,
      samples,
      sampleRate
    );

    if (spectral.rolloff !== null) {
      values.spectralRolloff = spectral.rolloff;
      values.sources.timbre.spectralRolloff = ESSENTIA_SOURCE;
    }

    if (spectral.flatness !== null) {
      values.spectralFlatness = spectral.flatness;
      values.sources.timbre.spectralFlatness = ESSENTIA_SOURCE;
    }

    /*
      PredominantPitchMelodia works with the real sample rate.
      If it does not detect a reliable pitch, the fallback value remains
      and is shown as Approximation in the interface.
    */
    const melody = this.tryMelodyDescriptors(
      essentia,
      vector,
      sampleRate
    );

    if (melody) {
      values.estimatedPitch = melody.pitch;
      values.pitchConfidence = melody.confidence;
      values.sources.melody.estimatedPitch = ESSENTIA_SOURCE;
      values.sources.melody.pitchConfidence = ESSENTIA_SOURCE;
    }

    /*
      BPM is calculated directly with Essentia at the original sample rate.
    */
    const bpm = this.tryBpm(
      essentia,
      vector,
      sampleRate
    );

    if (bpm !== null) {
      values.bpm = bpm;
      values.sources.rhythm.bpm = ESSENTIA_SOURCE;
    }

    /*
      Rhythm confidence and OnsetRate continue through a 44100 Hz path.
      Standard resampling is attempted first and ResampleFFT is used
      as a second attempt.
    */
    const vector44100 = this.tryResampleTo44100(
      essentia,
      samples,
      vector,
      sampleRate
    );

    if (vector44100) {
      const rhythm = this.tryRhythmConfidence(
        essentia,
        vector44100
      );

      if (rhythm) {
        values.bpmConfidence = rhythm.confidence;
        values.sources.rhythm.bpmConfidence = ESSENTIA_SOURCE;

        if (
          values.sources.rhythm.bpm.source !== 'essentia.js' &&
          rhythm.bpm !== null
        ) {
          values.bpm = rhythm.bpm;
          values.sources.rhythm.bpm = ESSENTIA_SOURCE;
        }
      }

      const onsetRate = this.tryOnsetRate(
        essentia,
        vector44100
      );

      if (onsetRate !== null) {
        values.onsetRate = onsetRate;
        values.percussiveScore = clamp(onsetRate / 4, 0, 1);
        values.sources.rhythm.onsetRate = ESSENTIA_SOURCE;
      }
    }

    /*
      This is an internal interpretation used only for the
      current text-based Freesound search.
    */
    values.tonalScore = clamp(
      values.pitchConfidence * 0.72 +
        (1 - values.zeroCrossingRate * 18) * 0.28,
      0,
      1
    );

    return values;
  }

  private tryNumeric(
    compute: () => UnknownResult | undefined,
    resultKeys: string[],
    fallback: number,
    name: string
  ): {
    value: number;
    provenance: DescriptorProvenance;
  } {
    try {
      const result = compute();
      const value = result
        ? this.readNumber(result, resultKeys)
        : null;

      if (value === null) {
        throw new Error(`${name} returned no numeric value.`);
      }

      return {
        value,
        provenance: ESSENTIA_SOURCE,
      };
    } catch (error) {
      console.warn(
        `Essentia.js could not calculate ${name}; approximation is kept.`,
        error
      );

      return {
        value: fallback,
        provenance: {
          source: 'approximation',
          note: `${name} is an approximate fallback.`,
        },
      };
    }
  }

  private trySpectralDescriptors(
    essentia: EssentiaInstance,
    samples: Float32Array,
    sampleRate: number
  ): {
    rolloff: number | null;
    flatness: number | null;
  } {
    try {
      if (!essentia.Windowing || !essentia.Spectrum) {
        return {
          rolloff: null,
          flatness: null,
        };
      }

      const frameSize = 2048;
      const hopSize = 1024;

      let rolloffSum = 0;
      let flatnessSum = 0;
      let rolloffCount = 0;
      let flatnessCount = 0;

      for (let start = 0; start < samples.length; start += hopSize) {
        const frame = new Float32Array(frameSize);

        frame.set(
          samples.slice(
            start,
            Math.min(start + frameSize, samples.length)
          )
        );

        const frameVector = essentia.arrayToVector(frame);
        const windowed = essentia.Windowing(
          frameVector,
          true,
          frameSize,
          'hann',
          0,
          true
        ).frame;

        if (!windowed) {
          continue;
        }

        const spectrum = essentia.Spectrum(
          windowed,
          frameSize
        ).spectrum;

        if (!spectrum) {
          continue;
        }

        if (essentia.RollOff) {
          const rolloff = this.readNumber(
            essentia.RollOff(spectrum, 0.85, sampleRate),
            ['rollOff', 'rolloff']
          );

          if (rolloff !== null) {
            rolloffSum += rolloff;
            rolloffCount += 1;
          }
        }

        if (essentia.Flatness) {
          const flatness = this.readNumber(
            essentia.Flatness(spectrum),
            ['flatness']
          );

          if (flatness !== null) {
            flatnessSum += flatness;
            flatnessCount += 1;
          }
        }
      }

      return {
        rolloff: rolloffCount
          ? rolloffSum / rolloffCount
          : null,
        flatness: flatnessCount
          ? flatnessSum / flatnessCount
          : null,
      };
    } catch (error) {
      console.warn(
        'Essentia.js could not calculate spectral descriptors; approximations are kept.',
        error
      );

      return {
        rolloff: null,
        flatness: null,
      };
    }
  }

  private tryMelodyDescriptors(
    essentia: EssentiaInstance,
    vector: unknown,
    sampleRate: number
  ): {
    pitch: number | null;
    confidence: number;
  } | null {
    try {
      if (!essentia.PredominantPitchMelodia) {
        return null;
      }

      const result = essentia.PredominantPitchMelodia(
        vector,
        10,
        3,
        2048,
        false,
        0.8,
        128,
        1,
        40,
        Math.min(20000, sampleRate / 2 - 1),
        100,
        80,
        20,
        0.9,
        0.9,
        27.5625,
        55,
        sampleRate,
        100,
        false,
        0.2
      );

      const pitches = this.readVector(
        result.pitch,
        essentia
      );
      const confidences = this.readVector(
        result.pitchConfidence,
        essentia
      );

      const voiced = pitches
        .map((pitch, index) => ({
          pitch,
          confidence: confidences[index] ?? 0,
        }))
        .filter(
          ({ pitch, confidence }) =>
            pitch > 0 &&
            Number.isFinite(pitch) &&
            confidence > 0 &&
            Number.isFinite(confidence)
        );

      if (!voiced.length) {
        console.warn(
          'Essentia.js did not detect a reliable predominant pitch; approximate melodic values are kept.'
        );

        return null;
      }

      const weightSum = voiced.reduce(
        (sum, item) => sum + item.confidence,
        0
      );

      return {
        pitch: voiced.reduce(
          (sum, item) => sum + item.pitch * item.confidence,
          0
        ) / weightSum,
        confidence: clamp(
          voiced.reduce(
            (sum, item) => sum + item.confidence,
            0
          ) / voiced.length,
          0,
          1
        ),
      };
    } catch (error) {
      console.warn(
        'Essentia.js could not calculate melody; approximate melodic values are kept.',
        error
      );

      return null;
    }
  }

  private tryBpm(
    essentia: EssentiaInstance,
    vector: unknown,
    sampleRate: number
  ): number | null {
    try {
      if (!essentia.RhythmExtractor) {
        return null;
      }

      const result = essentia.RhythmExtractor(
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

      const bpm = this.readNumber(result, ['bpm']);

      return bpm !== null && bpm > 0
        ? bpm
        : null;
    } catch (error) {
      console.warn(
        'Essentia.js could not calculate BPM; approximation is kept.',
        error
      );

      return null;
    }
  }

  private tryRhythmConfidence(
    essentia: EssentiaInstance,
    vector: unknown
  ): {
    bpm: number | null;
    confidence: number;
  } | null {
    try {
      if (!essentia.RhythmExtractor2013) {
        return null;
      }

      const result = essentia.RhythmExtractor2013(
        vector,
        208,
        'multifeature',
        40
      );

      const confidence = this.readNumber(
        result,
        ['confidence']
      );

      if (confidence === null) {
        return null;
      }

      const bpm = this.readNumber(result, ['bpm']);

      return {
        bpm: bpm !== null && bpm > 0
          ? bpm
          : null,
        confidence,
      };
    } catch (error) {
      console.warn(
        'Essentia.js could not calculate rhythm confidence; approximation is kept.',
        error
      );

      return null;
    }
  }

  private tryOnsetRate(
    essentia: EssentiaInstance,
    vector: unknown
  ): number | null {
    try {
      if (!essentia.OnsetRate) {
        return null;
      }

      return this.readNumber(
        essentia.OnsetRate(vector),
        ['onsetRate']
      );
    } catch (error) {
      console.warn(
        'Essentia.js could not calculate onset rate; approximation is kept.',
        error
      );

      return null;
    }
  }

  private tryResampleTo44100(
    essentia: EssentiaInstance,
    samples: Float32Array,
    vector: unknown,
    sampleRate: number
  ): unknown | null {
    if (sampleRate === 44100) {
      return vector;
    }

    try {
      const signal = essentia.Resample?.(
        vector,
        sampleRate,
        44100,
        0
      ).signal;

      if (signal) {
        return signal;
      }
    } catch (error) {
      console.warn(
        'Standard Essentia resampling failed; retrying with ResampleFFT.',
        error
      );
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

      const output = essentia.ResampleFFT(
        input,
        inputSize,
        outputSize
      ).output;

      return output || null;
    } catch (error) {
      console.warn(
        'Essentia resampling to 44100 Hz failed; rhythm confidence and onset rate remain approximate.',
        error
      );

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
      console.warn(
        'Essentia.js could not be loaded; all values remain approximate.',
        error
      );

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

  private extractFallbackValues(
    samples: Float32Array,
    sampleRate: number
  ): BaseValues {
    let energy = 0;
    let peakAmplitude = 0;
    let minAmplitude = 1;
    let maxAmplitude = -1;
    let zeroCrossings = 0;

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];

      energy += sample * sample;
      peakAmplitude = Math.max(
        peakAmplitude,
        Math.abs(sample)
      );
      minAmplitude = Math.min(minAmplitude, sample);
      maxAmplitude = Math.max(maxAmplitude, sample);

      if (
        index > 0 &&
        Math.sign(sample) !== Math.sign(samples[index - 1])
      ) {
        zeroCrossings += 1;
      }
    }

    const rms = Math.sqrt(
      energy / Math.max(samples.length, 1)
    );

    const rhythm = this.estimateRhythm(
      samples,
      sampleRate,
      rms
    );

    const pitch = this.estimatePitch(
      samples,
      sampleRate
    );

    const zeroCrossingRate =
      zeroCrossings / Math.max(samples.length, 1);

    return {
      rms,
      energy,
      dynamicComplexity: this.estimateDynamicComplexity(
        samples,
        sampleRate
      ),
      peakAmplitude,
      dynamicRange: maxAmplitude - minAmplitude,
      zeroCrossingRate,
      spectralCentroid: this.estimateSpectralCentroid(
        samples,
        sampleRate
      ),
      spectralRolloff: this.estimateSpectralRolloff(
        samples,
        sampleRate
      ),
      spectralFlatness: this.estimateSpectralFlatness(samples),
      bpm: rhythm.bpm,
      bpmConfidence: rhythm.confidence,
      onsetRate: rhythm.onsetRate,
      percussiveScore: rhythm.percussiveScore,
      estimatedPitch: pitch.pitch,
      pitchConfidence: pitch.confidence,
      tonalScore: clamp(
        pitch.confidence * 0.72 +
          (1 - zeroCrossingRate * 18) * 0.28,
        0,
        1
      ),
      sources: this.approximationSources(),
    };
  }

  private approximationSources(): AudioDescriptorSources {
    const approximation = (
      name: string
    ): DescriptorProvenance => ({
      source: 'approximation',
      note: `Essentia.js could not return a reliable ${name}; this value is an approximate fallback.`,
    });

    return {
      melody: {
        estimatedPitch: approximation('predominant pitch'),
        pitchConfidence: approximation('pitch confidence'),
      },
      rhythm: {
        bpm: approximation('BPM'),
        bpmConfidence: approximation('rhythm confidence'),
        onsetRate: approximation('onset rate'),
      },
      timbre: {
        spectralCentroid: approximation('spectral centroid'),
        spectralRolloff: approximation('spectral rolloff'),
        spectralFlatness: approximation('spectral flatness'),
        zeroCrossingRate: approximation('zero-crossing rate'),
      },
      energy: {
        rms: approximation('RMS'),
        energy: approximation('energy'),
        dynamicComplexity: approximation('dynamic complexity'),
      },
    };
  }

  private flattenSources(
    sources: AudioDescriptorSources
  ): DescriptorProvenance[] {
    return [
      sources.melody.estimatedPitch,
      sources.melody.pitchConfidence,
      sources.rhythm.bpm,
      sources.rhythm.bpmConfidence,
      sources.rhythm.onsetRate,
      sources.timbre.spectralCentroid,
      sources.timbre.spectralRolloff,
      sources.timbre.spectralFlatness,
      sources.timbre.zeroCrossingRate,
      sources.energy.rms,
      sources.energy.energy,
      sources.energy.dynamicComplexity,
    ];
  }

  private readNumber(
    result: UnknownResult,
    keys: string[]
  ): number | null {
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
          typeof item === 'number'
      );
    }

    if (typeof value === 'number') {
      return [value];
    }

    if (value && essentia.vectorToArray) {
      return Array.from(
        essentia.vectorToArray(value)
      );
    }

    return [];
  }

  private estimatePitch(
    samples: Float32Array,
    sampleRate: number
  ): {
    pitch: number | null;
    confidence: number;
  } {
    const length = Math.min(
      samples.length,
      Math.floor(sampleRate * 0.7)
    );

    if (length < sampleRate * 0.05) {
      return {
        pitch: null,
        confidence: 0,
      };
    }

    const minLag = Math.floor(sampleRate / 1000);
    const maxLag = Math.min(
      Math.floor(sampleRate / 80),
      length - 1
    );

    let zeroLag = 0;

    for (let index = 0; index < length; index += 1) {
      zeroLag += samples[index] * samples[index];
    }

    if (zeroLag <= 1e-8) {
      return {
        pitch: null,
        confidence: 0,
      };
    }

    let bestLag = 0;
    let bestCorrelation = 0;

    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let correlation = 0;

      for (let index = 0; index < length - lag; index += 1) {
        correlation +=
          samples[index] * samples[index + lag];
      }

      const normalized = correlation / zeroLag;

      if (normalized > bestCorrelation) {
        bestCorrelation = normalized;
        bestLag = lag;
      }
    }

    if (!bestLag) {
      return {
        pitch: null,
        confidence: 0,
      };
    }

    /*
      This is only shown when Essentia.js does not return
      a reliable predominant pitch, and the UI labels it
      clearly as Approximation.
    */
    return {
      pitch: sampleRate / bestLag,
      confidence: clamp(bestCorrelation, 0, 1),
    };
  }

  private estimateRhythm(
    samples: Float32Array,
    sampleRate: number,
    rms: number
  ): {
    bpm: number | null;
    confidence: number;
    onsetRate: number;
    percussiveScore: number;
  } {
    const frameSize = 1024;
    const hopSize = 512;
    const envelope: number[] = [];

    for (
      let start = 0;
      start + frameSize < samples.length;
      start += hopSize
    ) {
      let frameEnergy = 0;

      for (let index = start; index < start + frameSize; index += 1) {
        frameEnergy += samples[index] * samples[index];
      }

      envelope.push(frameEnergy / frameSize);
    }

    if (envelope.length < 4) {
      return {
        bpm: null,
        confidence: 0,
        onsetRate: 0,
        percussiveScore: 0,
      };
    }

    const average =
      envelope.reduce((sum, value) => sum + value, 0) /
      envelope.length;

    const flux: number[] = [];
    let onsets = 0;
    let totalFlux = 0;

    for (let index = 1; index < envelope.length; index += 1) {
      const value = Math.max(
        0,
        envelope[index] - envelope[index - 1]
      );

      flux.push(value);
      totalFlux += value;

      if (value > average * 0.7) {
        onsets += 1;
      }
    }

    const bpm = this.estimateBpmFromFlux(
      flux,
      sampleRate / hopSize
    );

    // percussiveScore: ratio of frames with sharp onset vs total frames.
    // Using peak-flux / mean-flux ratio is more stable than totalFlux/rms
    // because it doesn't deflate for loud (high RMS) percussive loops.
    const meanFlux = totalFlux / Math.max(flux.length, 1);
    const peakFlux = Math.max(...flux, 1e-9);
    const percussiveScore = clamp(
      (onsets / Math.max(envelope.length, 1)) * (peakFlux / Math.max(meanFlux * 2, 1e-9)),
      0,
      1
    );

    return {
      bpm: bpm.bpm,
      confidence: bpm.confidence,
      onsetRate:
        onsets /
        Math.max(samples.length / sampleRate, 0.001),
      percussiveScore,
    };
  }

  private estimateBpmFromFlux(
    flux: number[],
    rate: number
  ): {
    bpm: number | null;
    confidence: number;
  } {
    if (flux.length < 12) {
      return {
        bpm: null,
        confidence: 0,
      };
    }

    let bestLag = 0;
    let bestScore = 0;
    let totalScore = 0;

    const minLag = Math.max(
      1,
      Math.floor((60 / 180) * rate)
    );

    const maxLag = Math.min(
      flux.length - 1,
      Math.ceil((60 / 60) * rate)
    );

    for (let lag = minLag; lag <= maxLag; lag += 1) {
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

    return bestLag
      ? {
          bpm: clamp(
            (60 * rate) / bestLag,
            60,
            180
          ),
          confidence: clamp(
            bestScore / Math.max(totalScore, 1e-8),
            0,
            1
          ),
        }
      : {
          bpm: null,
          confidence: 0,
        };
  }

  private estimateDynamicComplexity(
    samples: Float32Array,
    sampleRate: number
  ): number {
    const frameSize = Math.max(
      1,
      Math.floor(sampleRate * 0.2)
    );

    const values: number[] = [];

    for (
      let start = 0;
      start < samples.length;
      start += frameSize
    ) {
      let energy = 0;
      const end = Math.min(
        samples.length,
        start + frameSize
      );

      for (let index = start; index < end; index += 1) {
        energy += samples[index] * samples[index];
      }

      values.push(
        20 *
          Math.log10(
            Math.max(
              Math.sqrt(
                energy / Math.max(end - start, 1)
              ),
              1e-8
            )
          )
      );
    }

    if (!values.length) {
      return 0;
    }

    const mean =
      values.reduce((sum, value) => sum + value, 0) /
      values.length;

    return values.reduce(
      (sum, value) => sum + Math.abs(value - mean),
      0
    ) / values.length;
  }

  private estimateSpectralCentroid(
    samples: Float32Array,
    sampleRate: number
  ): number {
    return this.roughSpectrumDescriptor(
      samples,
      sampleRate,
      'centroid'
    );
  }

  private estimateSpectralRolloff(
    samples: Float32Array,
    sampleRate: number
  ): number {
    return this.roughSpectrumDescriptor(
      samples,
      sampleRate,
      'rolloff'
    );
  }

  private estimateSpectralFlatness(
    samples: Float32Array
  ): number {
    return this.roughSpectrumDescriptor(
      samples,
      44100,
      'flatness'
    );
  }

  private roughSpectrumDescriptor(
    samples: Float32Array,
    sampleRate: number,
    mode: 'centroid' | 'rolloff' | 'flatness'
  ): number {
    const size = Math.min(2048, samples.length);

    if (size < 32) {
      return 0;
    }

    const step = Math.max(
      1,
      Math.floor(samples.length / size)
    );

    const magnitudes: number[] = [];

    for (let bin = 1; bin < size / 2; bin += 1) {
      magnitudes.push(
        Math.abs(
          samples[
            Math.min(
              bin * step,
              samples.length - 1
            )
          ]
        ) + 1e-8
      );
    }

    if (mode === 'flatness') {
      const geometric = Math.exp(
        magnitudes.reduce(
          (sum, value) => sum + Math.log(value),
          0
        ) / magnitudes.length
      );

      const arithmetic =
        magnitudes.reduce(
          (sum, value) => sum + value,
          0
        ) / magnitudes.length;

      return clamp(
        geometric / arithmetic,
        0,
        1
      );
    }

    if (mode === 'centroid') {
      const total = magnitudes.reduce(
        (sum, value) => sum + value,
        0
      );

      return magnitudes.reduce(
        (sum, value, index) =>
          sum +
          (((index + 1) * sampleRate) / size) * value,
        0
      ) / Math.max(total, 1e-8);
    }

    const energy = magnitudes.map(
      (value) => value * value
    );

    const target =
      energy.reduce(
        (sum, value) => sum + value,
        0
      ) * 0.85;

    let cumulative = 0;

    for (let index = 0; index < energy.length; index += 1) {
      cumulative += energy[index];

      if (cumulative >= target) {
        return ((index + 1) * sampleRate) / size;
      }
    }

    return sampleRate / 2;
  }

  private energyLabel(
    rms: number
  ): 'quiet' | 'balanced' | 'loud' {
    if (rms < 0.04) {
      return 'quiet';
    }

    if (rms > 0.16) {
      return 'loud';
    }

    return 'balanced';
  }

  private brightnessLabel(
    centroid: number
  ): 'dark' | 'balanced' | 'bright' {
    if (centroid < 900) {
      return 'dark';
    }

    if (centroid > 2600) {
      return 'bright';
    }

    return 'balanced';
  }

  private timbreLabel(
    centroid: number,
    zcr: number,
    flatness: number
  ): 'clean' | 'noisy' | 'bright' | 'dark' | 'textured' {
    if (flatness > 0.55 || zcr > 0.14) {
      return 'noisy';
    }

    if (centroid > 3200) {
      return 'bright';
    }

    if (centroid < 700) {
      return 'dark';
    }

    if (flatness > 0.34) {
      return 'textured';
    }

    return 'clean';
  }

  private rhythmLabel(
    score: number,
    rate: number,
    duration: number
  ): 'one-shot' | 'percussive' | 'loop-like' | 'sustained' {
    if (duration < 1.3) {
      return 'one-shot';
    }

    if (score > 0.55 || rate > 2.8) {
      return 'percussive';
    }

    if (rate > 1.2) {
      return 'loop-like';
    }

    return 'sustained';
  }

  private melodicLabel(
    score: number,
    confidence: number,
    zcr: number
  ): 'melodic' | 'tonal' | 'textured' | 'noisy' {
    if (score > 0.68 && confidence > 0.38) {
      return 'melodic';
    }

    if (score > 0.48) {
      return 'tonal';
    }

    if (zcr > 0.16) {
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

  private createNotes(
    engine: AudioAnalysisResult['engine']
  ): string[] {
    if (engine === 'essentia.js') {
      return [
        'All displayed descriptor metrics were calculated with Essentia.js.',
      ];
    }

    if (engine === 'mixed-analysis') {
      return [
        'Values labelled Approximation are fallbacks shown only when Essentia.js does not return a reliable value.',
      ];
    }

    return [
      'Essentia.js could not calculate the displayed metrics, so the shown values are approximate fallbacks.',
    ];
  }
}

export const audioAnalysisService = new AudioAnalysisService();