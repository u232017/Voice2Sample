// Freesound API response types
export interface FreesoundSound {
  id: number;
  name: string;
  description?: string;
  duration?: number;
  samplerate?: number;
  bitrate?: number;
  channels?: number;
  bitdepth?: number;
  tags?: string[];
  username?: string;
  owner?: {
    username: string;
    id: number;
  };
  previews?: {
    'preview-hq-mp3'?: string;
    'preview-lq-mp3'?: string;
    'preview-hq-ogg'?: string;
    'preview-lq-ogg'?: string;
  };
  images?: {
    waveform_m?: string;
    waveform_l?: string;
    spectral_m?: string;
    spectral_l?: string;
  };
  pack?: string;
  url?: string;
  download?: string;
  created?: string;
  license?: string;
  num_downloads?: number;
  avg_rating?: number;
  num_ratings?: number;
  num_comments?: number;
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

export type AudioSourceKind = 'recording' | 'upload';

export interface RecordedAudio {
  blob: Blob;
  metadata: AudioMetadata;
  arrayBuffer?: ArrayBuffer;
  name?: string;
  source: AudioSourceKind;
  mimeType?: string;
}

export type SearchCategory =
  | 'any'
  | 'ambience'
  | 'music loop'
  | 'foley'
  | 'nature'
  | 'urban'
  | 'percussion'
  | 'synth'
  | 'voice';

export type SearchMood = 'any' | 'calm' | 'dark' | 'bright' | 'energetic' | 'mysterious';
export type SearchDuration = 'any' | 'short' | 'medium' | 'long';
export type SearchSort = 'relevance' | 'rating' | 'downloads' | 'recent';
export type SearchLicense = 'any' | 'creative_commons' | 'commercial_friendly';

export interface AudioTrimSelection {
  start: number;
  end: number;
}

export interface FreesoundSearchFilters {
  category: SearchCategory;
  mood: SearchMood;
  duration: SearchDuration;
  sort: SearchSort;
  license: SearchLicense;
}

export interface FreesoundSearchRequest {
  query: string;
  filters: FreesoundSearchFilters;
  limit: number;
}

export interface AudioDescriptorSummary {
  duration: number;
  sampleRate: number;
  channels: number;
  rms: number;
  peakAmplitude: number;
  zeroCrossingRate: number;
  spectralCentroid: number;
  energyLabel: 'quiet' | 'balanced' | 'loud';
  brightnessLabel: 'dark' | 'balanced' | 'bright';
}

export interface AudioAnalysisResult {
  descriptors: AudioDescriptorSummary;
  query: string;
  notes: string[];
  engine: 'web-audio-fallback' | 'essentia';
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
