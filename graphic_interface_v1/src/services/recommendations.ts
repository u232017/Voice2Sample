import { AudioTrimSelection, FreesoundSearchRequest, FreesoundSound, RecordedAudio } from './types';

const RAW_BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || 'http://127.0.0.1:8000/api';
const BACKEND_API_BASE = RAW_BACKEND_API_BASE.replace(/\/$/, '');

interface BackendRecommendationResponse {
  engine: string;
  error?: string | null;
  results: FreesoundSound[];
}

function absolutizeBackendUrl(url?: string): string | undefined {
  if (!url || /^https?:\/\//i.test(url)) return url;
  return `${BACKEND_API_BASE}${url.startsWith('/api') ? url.slice(4) : url}`;
}

function normalizeBackendSound(sound: FreesoundSound): FreesoundSound {
  return {
    ...sound,
    url: absolutizeBackendUrl(sound.url),
    previews: {
      ...sound.previews,
      'preview-hq-mp3': absolutizeBackendUrl(sound.previews?.['preview-hq-mp3']),
      'preview-lq-mp3': absolutizeBackendUrl(sound.previews?.['preview-lq-mp3']),
      'preview-hq-ogg': absolutizeBackendUrl(sound.previews?.['preview-hq-ogg']),
      'preview-lq-ogg': absolutizeBackendUrl(sound.previews?.['preview-lq-ogg']),
    },
    download: absolutizeBackendUrl(sound.download),
  };
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeAudioBufferToWav(audioBuffer: AudioBuffer, trim?: AudioTrimSelection | null): Blob {
  const sampleRate = audioBuffer.sampleRate;
  const channelCount = audioBuffer.numberOfChannels;
  const safeStart = trim ? Math.max(0, Math.min(trim.start, audioBuffer.duration)) : 0;
  const safeEnd = trim ? Math.max(safeStart, Math.min(trim.end, audioBuffer.duration)) : audioBuffer.duration;
  const startSample = Math.floor(safeStart * sampleRate);
  const endSample = Math.max(startSample + 1, Math.floor(safeEnd * sampleRate));
  const frameCount = Math.min(audioBuffer.length, endSample) - startSample;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + frameCount * blockAlign);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + frameCount * blockAlign, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, frameCount * blockAlign, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < frameCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channel = audioBuffer.getChannelData(channelIndex);
      const sample = Math.max(-1, Math.min(1, channel[startSample + sampleIndex] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

async function prepareBackendAudio(audio: RecordedAudio, trim?: AudioTrimSelection | null): Promise<Blob> {
  try {
    const context = new AudioContext();
    const sourceBuffer = await audio.blob.arrayBuffer();
    const decoded = await context.decodeAudioData(sourceBuffer.slice(0));
    const wavBlob = encodeAudioBufferToWav(decoded, trim);
    await context.close();
    return wavBlob;
  } catch (error) {
    console.warn('Could not transcode browser audio to WAV before backend upload:', error);
    return audio.blob;
  }
}

class RecommendationAPI {
  async recommend(
    request: FreesoundSearchRequest,
    audio?: RecordedAudio,
    trim?: AudioTrimSelection | null
  ): Promise<FreesoundSound[]> {
    if (!audio) {
      throw new Error('NO_AUDIO_SELECTED');
    }

    const formData = new FormData();
    const backendAudio = await prepareBackendAudio(audio, trim);
    formData.append('audio', backendAudio, `${audio.name || 'voice2sample-input'}.wav`);
    formData.append('limit', String(Math.min(Math.max(request.limit, 1), 4)));

    const response = await fetch(`${BACKEND_API_BASE}/recommendations`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`BACKEND_HTTP_${response.status}`);
    }

    const data = (await response.json()) as BackendRecommendationResponse;

    if (data.error) {
      console.warn('Backend recommendation warning:', data.error);
    }

    return data.results.map(normalizeBackendSound);
  }
}

export const recommendationAPI = new RecommendationAPI();
