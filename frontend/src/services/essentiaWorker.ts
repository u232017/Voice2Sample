/**
 * essentiaWorker.ts
 *
 * Web Worker used by the audio analysis card.
 * It only returns values calculated with Essentia.js.
 * If a descriptor cannot be calculated by Essentia.js, its value is returned
 * as null. No manual approximation fallback is generated here.
 */

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// La tarjeta de análisis es informativa: analizar más de este tiempo no
// mejora los descriptores mostrados y dispara el coste en WASM monohilo.
// Si la selección es más larga, se analiza la ventana central.
const MAX_ANALYSIS_SECONDS = 15;

function limitAnalysisWindow(
  samples: Float32Array,
  sampleRate: number
): Float32Array {
  const maxSamples = Math.floor(MAX_ANALYSIS_SECONDS * sampleRate);

  if (samples.length <= maxSamples) {
    return samples;
  }

  const start = Math.floor((samples.length - maxSamples) / 2);
  return samples.subarray(start, start + maxSamples);
}

type DescriptorProvenance = {
  source: 'essentia.js';
  note?: string;
};

type WorkerDescriptorSources = {
  melody: {
    estimatedPitch: DescriptorProvenance;
    pitchConfidence: DescriptorProvenance;
  };
  rhythm: {
    bpm: DescriptorProvenance;
    bpmConfidence: DescriptorProvenance;
    onsetRate: DescriptorProvenance;
  };
  timbre: {
    spectralCentroid: DescriptorProvenance;
    spectralRolloff: DescriptorProvenance;
    spectralFlatness: DescriptorProvenance;
    zeroCrossingRate: DescriptorProvenance;
  };
  energy: {
    rms: DescriptorProvenance;
    energy: DescriptorProvenance;
    dynamicComplexity: DescriptorProvenance;
  };
};

type WorkerBaseValues = {
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
  sources: WorkerDescriptorSources;
  missing: string[];
};

type UnknownResult = Record<string, unknown>;

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

const ESSENTIA_SOURCE: DescriptorProvenance = {
  source: 'essentia.js',
};

function readNumber(
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

function readVector(
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

function extractAmplitudeStats(samples: Float32Array): {
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

function sources(): WorkerDescriptorSources {
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

function extractSpectralDescriptors(
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

  // Hop grande a propósito: para el promedio de rolloff/flatness de la
  // tarjeta no hace falta solapar frames, y reduce 4× las llamadas WASM.
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

    const rolloff = readNumber(
      essentia.RollOff?.(spectrumData, 0.85, sampleRate),
      ['rollOff', 'rolloff', 'spectralRolloff']
    );

    if (rolloff !== null) {
      rolloffSum += rolloff;
      rolloffCount += 1;
    }

    const flatness = readNumber(
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

function resampleTo44100(
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
    console.warn('Essentia.js Resample failed in worker.', error);
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
    console.warn('Essentia.js ResampleFFT failed in worker.', error);
    return null;
  }
}

function extractMelodyDescriptors(
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
        : resampleTo44100(essentia, samples, sampleRate);

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
      // hop 512 (≈12 ms): 4× menos frames que el default 128. Para el
      // pitch promedio de la tarjeta la pérdida de resolución es irrelevante.
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

    const pitchValues = readVector(
      result.pitch || result.pitches,
      essentia
    );

    const confidenceValues = readVector(
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
    console.warn('Essentia.js could not calculate melody in worker.', error);

    return {
      pitch: null,
      confidence: null,
    };
  }
}

function confidenceFromTicks(ticks: number[]): number | null {
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

function extractRhythmDescriptors(
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

    bpm = readNumber(
      rhythm,
      ['bpm']
    );

    if (rhythm) {
      confidence = confidenceFromTicks(
        readVector(rhythm.ticks, essentia)
      );
    }
  } catch (error) {
    console.warn('Essentia.js could not calculate BPM in worker.', error);
  }

  // RhythmExtractor2013 'multifeature' es el algoritmo más lento de la
  // tarjeta de análisis: solo se usa como respaldo si el extractor
  // rápido no encontró BPM.
  if (bpm === null || bpm <= 0) {
    try {
      const rhythm2013 = essentia.RhythmExtractor2013?.(
        vector,
        208,
        'multifeature',
        40
      );

      const extractedConfidence = readNumber(
        rhythm2013,
        ['confidence']
      );

      if (extractedConfidence !== null) {
        confidence = clamp(extractedConfidence, 0, 1);
      }

      const extractedBpm = readNumber(
        rhythm2013,
        ['bpm']
      );

      if (extractedBpm !== null && extractedBpm > 0) {
        bpm = extractedBpm;
      }
    } catch (error) {
      console.warn('Essentia.js could not calculate rhythm confidence in worker.', error);
    }
  }

  try {
    onsetRate = readNumber(
      essentia.OnsetRate?.(vector),
      ['onsetRate']
    );
  } catch (error) {
    console.warn('Essentia.js could not calculate onset rate in worker.', error);
  }

  return {
    bpm: bpm !== null && bpm > 0 ? bpm : null,
    confidence,
    onsetRate,
  };
}

// El módulo WASM y la instancia se cargan una única vez por worker:
// recrearlos en cada análisis añadía segundos a cada ejecución.
let essentiaPromise: Promise<EssentiaInstance> | null = null;

function loadEssentia(): Promise<EssentiaInstance> {
  if (!essentiaPromise) {
    essentiaPromise = Promise.all([
      import('essentia.js/dist/essentia-wasm.es.js'),
      import('essentia.js/dist/essentia.js-core.es.js'),
    ]).then(([{ EssentiaWASM }, { default: Essentia }]) => {
      const EssentiaClass = Essentia as EssentiaConstructor;
      return new EssentiaClass(EssentiaWASM, false);
    });
  }

  return essentiaPromise;
}

async function extractWithEssentia(
  inputSamples: Float32Array,
  sampleRate: number
): Promise<WorkerBaseValues> {
  const essentia = await loadEssentia();
  const samples = limitAnalysisWindow(inputSamples, sampleRate);
  const vector = essentia.arrayToVector(samples);
  const missing: string[] = [];

  const rms = readNumber(
    essentia.RMS?.(vector),
    ['rms', 'RMS']
  );

  if (rms === null) missing.push('RMS');

  const energy = readNumber(
    essentia.Energy?.(vector),
    ['energy']
  );

  if (energy === null) missing.push('energy');

  const dynamicComplexity = readNumber(
    essentia.DynamicComplexity?.(vector, 0.2, sampleRate),
    ['dynamicComplexity']
  );

  if (dynamicComplexity === null) missing.push('dynamic complexity');

  const zeroCrossingRate = readNumber(
    essentia.ZeroCrossingRate?.(vector, 0.0001),
    ['zeroCrossingRate', 'zerocrossingrate']
  );

  if (zeroCrossingRate === null) missing.push('zero-crossing rate');

  const spectralCentroid = readNumber(
    essentia.SpectralCentroidTime?.(vector, sampleRate),
    ['centroid', 'spectralCentroid', 'spectral_centroid']
  );

  if (spectralCentroid === null) missing.push('spectral centroid');

  const spectral = extractSpectralDescriptors(
    essentia,
    samples,
    sampleRate
  );

  if (spectral.rolloff === null) missing.push('spectral rolloff');
  if (spectral.flatness === null) missing.push('spectral flatness');

  const melody = extractMelodyDescriptors(
    essentia,
    samples,
    sampleRate
  );

  if (melody.pitch === null) missing.push('predominant pitch');
  if (melody.confidence === null) missing.push('pitch confidence');

  const rhythm = extractRhythmDescriptors(
    essentia,
    vector,
    sampleRate
  );

  if (rhythm.bpm === null) missing.push('BPM');
  if (rhythm.confidence === null) missing.push('rhythm confidence');
  if (rhythm.onsetRate === null) missing.push('onset rate');

  const amplitude = extractAmplitudeStats(samples);
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
    sources: sources(),
    missing,
  };
}

self.onmessage = async (
  event: MessageEvent<{
    samples: Float32Array;
    sampleRate: number;
  }>
) => {
  try {
    const values = await extractWithEssentia(
      event.data.samples,
      event.data.sampleRate
    );

    self.postMessage({
      values,
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
};