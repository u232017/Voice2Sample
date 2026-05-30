/**
 * essentiaWorker.ts
 *
 * Web Worker that loads Essentia WASM off the main thread.
 * The main thread sends a { samples: Float32Array, sampleRate: number }
 * message and receives back { values: BaseValues } or { error: string }.
 *
 * Place this file at:
 *   src/services/essentiaWorker.ts
 *
 * Vite will bundle it automatically when imported with
 *   new Worker(new URL('./essentiaWorker.ts', import.meta.url), { type: 'module' })
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const ESSENTIA_SOURCE = { source: 'essentia.js' as const };
const APPROX_SOURCE = (note: string) => ({ source: 'approximation' as const, note });

type UnknownResult = Record<string, unknown>;

// ─── Fallback arithmetic (no WASM) ───────────────────────────────────────────

function extractFallbackValues(samples: Float32Array, sampleRate: number) {
  const rms = Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / (samples.length || 1));
  const energy = samples.reduce((s, v) => s + v * v, 0) / (samples.length || 1);
  const peakAmplitude = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

  // ZCR
  let zc = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) zc++;
  }
  const zeroCrossingRate = samples.length > 1 ? zc / (samples.length - 1) : 0;

  // Spectral centroid (single DFT frame)
  const fSize = Math.min(2048, samples.length);
  const frame = samples.slice(0, fSize);
  const spectrum = new Float32Array(fSize / 2 + 1);
  const freqs = new Float32Array(spectrum.length);
  for (let k = 0; k < spectrum.length; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < fSize; n++) {
      const angle = (2 * Math.PI * k * n) / fSize;
      re += frame[n] * Math.cos(angle);
      im -= frame[n] * Math.sin(angle);
    }
    spectrum[k] = Math.sqrt(re * re + im * im);
    freqs[k] = (k * sampleRate) / fSize;
  }
  const specSum = spectrum.reduce((s, v) => s + v, 1e-9);
  const spectralCentroid = spectrum.reduce((s, v, i) => s + v * freqs[i], 0) / specSum;

  // BPM (envelope autocorrelation)
  const hopSz = 512;
  const frameSz = 1024;
  const envelope: number[] = [];
  for (let start = 0; start < samples.length - frameSz; start += hopSz) {
    const seg = samples.slice(start, start + frameSz);
    envelope.push(Math.sqrt(seg.reduce((s, v) => s + v * v, 0) / frameSz));
  }
  let bpm: number | null = null;
  let bpmConfidence = 0;
  if (envelope.length >= 12) {
    const fluxRate = sampleRate / hopSz;
    const minLag = Math.max(1, Math.round((60 / 180) * fluxRate));
    const maxLag = Math.min(envelope.length - 1, Math.round((60 / 60) * fluxRate));
    const flux = envelope.map((v, i) => i > 0 ? Math.max(0, v - envelope[i - 1]) : 0);
    let bestLag = 0, bestScore = 0, totalScore = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let score = 0;
      for (let i = lag; i < flux.length; i++) score += flux[i] * flux[i - lag];
      totalScore += score;
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }
    if (bestLag > 0 && bestScore > 0) {
      bpm = clamp((60 * fluxRate) / bestLag, 60, 180);
      bpmConfidence = clamp(bestScore / Math.max(totalScore, 1e-8), 0, 1);
    }
  }

  // Onset rate / percussive score
  const duration = samples.length / sampleRate;
  const envArr = envelope;
  const avg = envArr.reduce((s, v) => s + v, 0) / (envArr.length || 1);
  const onsets = envArr.filter((v, i) => i > 0 && v - envArr[i - 1] > avg * 0.7).length;
  const onsetRate = onsets / Math.max(duration, 0.001);
  const percussiveScore = clamp(onsetRate / 4, 0, 1);

  // Pitch (autocorrelation)
  const pitchLen = Math.min(samples.length, Math.round(sampleRate * 0.7));
  let estimatedPitch: number | null = null;
  let pitchConfidence = 0;
  if (pitchLen > sampleRate * 0.05) {
    const seg = samples.slice(0, pitchLen);
    const zeroCorrLag = seg.reduce((s, v) => s + v * v, 0);
    const minLagP = Math.max(1, Math.round(sampleRate / 1000));
    const maxLagP = Math.min(Math.round(sampleRate / 80), pitchLen - 1);
    let bestLagP = 0, bestCorr = 0;
    if (zeroCorrLag > 1e-8) {
      for (let lag = minLagP; lag <= maxLagP; lag++) {
        let c = 0;
        for (let i = 0; i < seg.length - lag; i++) c += seg[i] * seg[i + lag];
        c /= zeroCorrLag;
        if (c > bestCorr) { bestCorr = c; bestLagP = lag; }
      }
    }
    if (bestLagP > 0) {
      estimatedPitch = sampleRate / bestLagP;
      pitchConfidence = clamp(bestCorr, 0, 1);
    }
  }

  const tonalScore = clamp(pitchConfidence * 0.72 + (1 - zeroCrossingRate * 18) * 0.28, 0, 1);

  const approxSrc = APPROX_SOURCE('approximation fallback');
  return {
    rms, energy, dynamicComplexity: 0, peakAmplitude,
    dynamicRange: peakAmplitude,
    zeroCrossingRate, spectralCentroid,
    spectralRolloff: spectralCentroid * 1.6,
    spectralFlatness: 0.1,
    bpm, bpmConfidence, onsetRate, percussiveScore,
    estimatedPitch, pitchConfidence, tonalScore,
    sources: {
      energy: { rms: approxSrc, energy: approxSrc, dynamicComplexity: approxSrc },
      timbre: {
        spectralCentroid: approxSrc, spectralRolloff: approxSrc,
        zeroCrossingRate: approxSrc, spectralFlatness: approxSrc,
      },
      rhythm: { bpm: approxSrc, bpmConfidence: approxSrc, onsetRate: approxSrc },
      melody: { estimatedPitch: approxSrc, pitchConfidence: approxSrc },
    },
  };
}

// ─── Helpers to read Essentia results ────────────────────────────────────────

function readNumber(result: UnknownResult | undefined, keys: string[]): number | null {
  if (!result) return null;
  for (const key of keys) {
    const v = result[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function readVector(raw: unknown, essentia: any): number[] {
  if (!raw) return [];
  try {
    const arr = essentia.vectorToArray?.(raw);
    if (arr) return Array.from(arr as ArrayLike<number>);
  } catch (_) {}
  if (Array.isArray(raw)) return raw.filter((v): v is number => typeof v === 'number');
  return [];
}

// ─── Main extraction with WASM ────────────────────────────────────────────────

async function extractWithEssentia(samples: Float32Array, sampleRate: number) {
  const values = extractFallbackValues(samples, sampleRate);

  let essentia: any;
  try {
    const [{ EssentiaWASM }, { default: EssentiaLib }] = await Promise.all([
      import('essentia.js/dist/essentia-wasm.es.js'),
      import('essentia.js/dist/essentia.js-core.es.js'),
    ]);
    essentia = new (EssentiaLib as any)(EssentiaWASM, false);
  } catch (e) {
    console.warn('[essentiaWorker] WASM load failed, using fallback values', e);
    return values;
  }

  const vector = essentia.arrayToVector(samples);

  // RMS
  try {
    const v = readNumber(essentia.RMS?.(vector), ['rms', 'RMS']);
    if (v !== null) { values.rms = v; values.sources.energy.rms = ESSENTIA_SOURCE; }
  } catch (_) {}

  // Energy
  try {
    const v = readNumber(essentia.Energy?.(vector), ['energy']);
    if (v !== null) { values.energy = v; values.sources.energy.energy = ESSENTIA_SOURCE; }
  } catch (_) {}

  // DynamicComplexity
  try {
    const v = readNumber(essentia.DynamicComplexity?.(vector, 0.2, sampleRate), ['dynamicComplexity']);
    if (v !== null) { values.dynamicComplexity = v; values.sources.energy.dynamicComplexity = ESSENTIA_SOURCE; }
  } catch (_) {}

  // ZCR
  try {
    const v = readNumber(essentia.ZeroCrossingRate?.(vector, 0.0001), ['zeroCrossingRate', 'zerocrossingrate']);
    if (v !== null) { values.zeroCrossingRate = v; values.sources.timbre.zeroCrossingRate = ESSENTIA_SOURCE; }
  } catch (_) {}

  // SpectralCentroid
  try {
    const v = readNumber(essentia.SpectralCentroidTime?.(vector, sampleRate), ['centroid', 'spectralCentroid', 'spectral_centroid']);
    if (v !== null) { values.spectralCentroid = v; values.sources.timbre.spectralCentroid = ESSENTIA_SOURCE; }
  } catch (_) {}

  // Spectral rolloff + flatness (frame-by-frame)
  try {
    if (essentia.Windowing && essentia.Spectrum) {
      const frameSize = 2048, hopSize = 1024;
      let rolloffSum = 0, flatnessSum = 0, rolloffCount = 0, flatnessCount = 0;
      for (let start = 0; start < samples.length; start += hopSize) {
        const frame = new Float32Array(frameSize);
        frame.set(samples.slice(start, Math.min(start + frameSize, samples.length)));
        const fv = essentia.arrayToVector(frame);
        const windowed = (essentia.Windowing(fv, true, frameSize, 'hann', 0, true) as UnknownResult).frame;
        if (!windowed) continue;
        const spectrum = (essentia.Spectrum(windowed, frameSize) as UnknownResult).spectrum;
        if (!spectrum) continue;
        if (essentia.RollOff) {
          const v = readNumber(essentia.RollOff(spectrum, 0.85, sampleRate) as UnknownResult, ['rollOff', 'rolloff']);
          if (v !== null) { rolloffSum += v; rolloffCount++; }
        }
        if (essentia.Flatness) {
          const v = readNumber(essentia.Flatness(spectrum) as UnknownResult, ['flatness']);
          if (v !== null) { flatnessSum += v; flatnessCount++; }
        }
      }
      if (rolloffCount) { values.spectralRolloff = rolloffSum / rolloffCount; values.sources.timbre.spectralRolloff = ESSENTIA_SOURCE; }
      if (flatnessCount) { values.spectralFlatness = flatnessSum / flatnessCount; values.sources.timbre.spectralFlatness = ESSENTIA_SOURCE; }
    }
  } catch (_) {}

  // Pitch (PredominantPitchMelodia)
  try {
    if (essentia.PredominantPitchMelodia) {
      const result = essentia.PredominantPitchMelodia(
        vector, 10, 3, 2048, false, 0.8, 128, 1, 40,
        Math.min(20000, sampleRate / 2 - 1), 100, 80, 20,
        0.9, 0.9, 27.5625, 55, sampleRate, 100, false, 0.2
      ) as UnknownResult;
      const pitches = readVector(result.pitch, essentia);
      const confs = readVector(result.pitchConfidence, essentia);
      const voiced = pitches
        .map((p, i) => ({ pitch: p, conf: confs[i] ?? 0 }))
        .filter(({ pitch, conf }) => pitch > 0 && Number.isFinite(pitch) && conf > 0);
      if (voiced.length) {
        const wSum = voiced.reduce((s, v) => s + v.conf, 0);
        values.estimatedPitch = voiced.reduce((s, v) => s + v.pitch * v.conf, 0) / wSum;
        values.pitchConfidence = clamp(voiced.reduce((s, v) => s + v.conf, 0) / voiced.length, 0, 1);
        values.sources.melody.estimatedPitch = ESSENTIA_SOURCE;
        values.sources.melody.pitchConfidence = ESSENTIA_SOURCE;
      }
    }
  } catch (_) {}

  // BPM (RhythmExtractor)
  try {
    if (essentia.RhythmExtractor) {
      const result = essentia.RhythmExtractor(
        vector, 1024, 1024, 256, 0.1, 208, 40, 1024, sampleRate, [], 0.24, true, true
      ) as UnknownResult;
      const bpm = readNumber(result, ['bpm']);
      if (bpm !== null && bpm > 0) { values.bpm = bpm; values.sources.rhythm.bpm = ESSENTIA_SOURCE; }
    }
  } catch (_) {}

  // Resample to 44100 for rhythm confidence + onset rate
  let vector44100: unknown = null;
  try {
    if (sampleRate === 44100) {
      vector44100 = vector;
    } else if (essentia.Resample) {
      const sig = (essentia.Resample(vector, sampleRate, 44100, 0) as UnknownResult).signal;
      if (sig) vector44100 = sig;
    }
    if (!vector44100 && essentia.ResampleFFT) {
      const inSz = samples.length % 2 === 0 ? samples.length : samples.length - 1;
      let outSz = Math.round(inSz * 44100 / sampleRate);
      if (outSz % 2 !== 0) outSz++;
      if (inSz >= 2) {
        const inp = essentia.arrayToVector(samples.slice(0, inSz));
        const out = (essentia.ResampleFFT(inp, inSz, outSz) as UnknownResult).output;
        if (out) vector44100 = out;
      }
    }
  } catch (_) {}

  if (vector44100) {
    // RhythmExtractor2013 (confidence)
    try {
      if (essentia.RhythmExtractor2013) {
        const result = essentia.RhythmExtractor2013(vector44100, 208, 'multifeature', 40) as UnknownResult;
        const conf = readNumber(result, ['confidence']);
        if (conf !== null) {
          values.bpmConfidence = conf;
          values.sources.rhythm.bpmConfidence = ESSENTIA_SOURCE;
          if (values.sources.rhythm.bpm.source !== 'essentia.js') {
            const bpm2 = readNumber(result, ['bpm']);
            if (bpm2 !== null && bpm2 > 0) { values.bpm = bpm2; values.sources.rhythm.bpm = ESSENTIA_SOURCE; }
          }
        }
      }
    } catch (_) {}

    // OnsetRate
    try {
      if (essentia.OnsetRate) {
        const v = readNumber(essentia.OnsetRate(vector44100) as UnknownResult, ['onsetRate']);
        if (v !== null) {
          values.onsetRate = v;
          values.percussiveScore = clamp(v / 4, 0, 1);
          values.sources.rhythm.onsetRate = ESSENTIA_SOURCE;
        }
      }
    } catch (_) {}
  }

  // Tonal score
  values.tonalScore = clamp(
    values.pitchConfidence * 0.72 + (1 - values.zeroCrossingRate * 18) * 0.28,
    0, 1
  );

  return values;
}

// ─── Worker message handler ───────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
  const { samples, sampleRate } = event.data;
  try {
    const values = await extractWithEssentia(samples, sampleRate);
    self.postMessage({ values });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};