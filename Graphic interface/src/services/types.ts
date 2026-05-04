// Freesound API Response Types
export interface FreesoundSound {
  id: number;
  name: string;
  description: string;
  duration: number;
  samplerate: number;
  bitrate: number;
  channels: number;
  bitdepth: number;
  tags: string[];
  owner: {
    username: string;
    id: number;
  };
  previews: {
    'preview-hq-mp3': string;
    'preview-lq-mp3': string;
    'preview-hq-ogg': string;
    'preview-lq-ogg': string;
  };
  images: {
    waveform_m: string;
    waveform_l: string;
    spectral_m: string;
    spectral_l: string;
  };
  pack?: string;
  url: string;
  download: string;
  created: string;
  license: string;
  geotag?: {
    lat: number;
    lon: number;
    zoom: number;
  };
  similarity?: number;
}

export interface FreesoundSearchResponse {
  count: number;
  next?: string;
  previous?: string;
  results: FreesoundSound[];
}

export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export interface RecordedAudio {
  blob: Blob;
  metadata: AudioMetadata;
  arrayBuffer?: ArrayBuffer;
}

export interface SearchResult {
  sound: FreesoundSound;
  similarity?: number;
  previewUrl?: string;
}

export interface AppState {
  currentAudio?: RecordedAudio;
  searchResults: SearchResult[];
  isLoading: boolean;
  error?: string;
  isRecording: boolean;
}

export interface FreesoundError {
  code: number;
  message: string;
  details?: string;
}
