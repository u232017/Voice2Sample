import { AudioAnalysisResult, AudioDescriptorSummary, RecordedAudio } from './types';
import { audioService } from './audio';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

class AudioAnalysisService {
  async analyze(audio: RecordedAudio): Promise<AudioAnalysisResult> {
    const descriptors = await this.extractFallbackDescriptors(audio);

    return {
      descriptors,
      query: this.createTemporaryFreesoundQuery(descriptors, audio.name),
      engine: 'web-audio-fallback',
      notes: [
        'Essentia is not wired into this frontend yet.',
        'This query is a temporary Freesound text-search fallback until descriptor matching is connected.',
      ],
    };
  }

  async extractFallbackDescriptors(audio: RecordedAudio): Promise<AudioDescriptorSummary> {
    const audioBuffer = await audioService.decodeAudio(audio.blob);
    const channelData = audioBuffer.getChannelData(0);
    let sumSquares = 0;
    let peakAmplitude = 0;
    let zeroCrossings = 0;

    for (let index = 0; index < channelData.length; index += 1) {
      const sample = channelData[index];
      sumSquares += sample * sample;
      peakAmplitude = Math.max(peakAmplitude, Math.abs(sample));

      if (index > 0 && Math.sign(sample) !== Math.sign(channelData[index - 1])) {
        zeroCrossings += 1;
      }
    }

    const rms = Math.sqrt(sumSquares / channelData.length);
    const zeroCrossingRate = zeroCrossings / channelData.length;
    const spectralCentroid = this.estimateSpectralCentroid(channelData, audioBuffer.sampleRate);

    return {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      rms,
      peakAmplitude,
      zeroCrossingRate,
      spectralCentroid,
      energyLabel: rms < 0.04 ? 'quiet' : rms > 0.16 ? 'loud' : 'balanced',
      brightnessLabel:
        spectralCentroid < 900 ? 'dark' : spectralCentroid > 2600 ? 'bright' : 'balanced',
    };
  }

  createTemporaryFreesoundQuery(descriptors: AudioDescriptorSummary, fileName?: string): string {
    const fileTokens = fileName
      ?.replace(/\.[a-z0-9]+$/i, '')
      .split(/[\s_-]+/)
      .filter((token) => token.length > 2 && !/^\d+$/.test(token))
      .slice(0, 2);

    if (fileTokens?.length) {
      return fileTokens.join(' ');
    }

    if (descriptors.duration < 1.5) {
      return descriptors.brightnessLabel === 'bright' ? 'click percussion' : 'short impact';
    }

    if (descriptors.energyLabel === 'loud') {
      return descriptors.brightnessLabel === 'bright' ? 'metal hit' : 'drum impact';
    }

    if (descriptors.energyLabel === 'quiet') {
      return descriptors.brightnessLabel === 'dark' ? 'soft ambience' : 'subtle texture';
    }

    return descriptors.brightnessLabel === 'bright' ? 'bright tone' : 'field recording';
  }

  private estimateSpectralCentroid(samples: Float32Array, sampleRate: number): number {
    const fftSize = Math.min(2048, samples.length);
    if (fftSize < 32) {
      return 0;
    }

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
}

export const audioAnalysisService = new AudioAnalysisService();
