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

export type RecommendationModel = 'essentia' | 'clap';
export type SimilarityFocus = 'melodic' | 'bpm' | 'timbre' | 'energy';
export type AudioAnalysisEngine = 'essentia.js' | 'web-audio-fallback';

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

export interface EssentiaTimbreDescriptors {
  spectralCentroid: number;
  spectralRolloff: number;
  zeroCrossingRate: number;
  spectralFlatness: number;
  brightnessLabel: 'dark' | 'balanced' | 'bright';
  timbreLabel: 'clean' | 'noisy' | 'bright' | 'dark' | 'textured';
}

export interface EssentiaRhythmDescriptors {
  bpm: number | null;
  bpmConfidence: number;
  onsetRate: number;
  percussiveScore: number;
  rhythmLabel: 'one-shot' | 'percussive' | 'loop-like' | 'sustained';
}

export interface EssentiaMelodyDescriptors {
  estimatedPitch: number | null;
  pitchConfidence: number;
  tonalScore: number;
  melodicLabel: 'melodic' | 'tonal' | 'textured' | 'noisy';
  pitchRangeLabel: string;
}

export interface EssentiaEnergyDescriptors {
  rms: number;
  energy: number;
  peakAmplitude: number;
  dynamicRange: number;
  energyLabel: 'quiet' | 'balanced' | 'loud';
}

export interface EssentiaDescriptorSummary {
  duration: number;
  selectedDuration: number;
  sampleRate: number;
  channels: number;
  timbre: EssentiaTimbreDescriptors;
  rhythm: EssentiaRhythmDescriptors;
  melody: EssentiaMelodyDescriptors;
  energy: EssentiaEnergyDescriptors;
}

export interface AudioDescriptorSummary extends EssentiaDescriptorSummary {}

export interface AudioAnalysisResult {
  descriptors: EssentiaDescriptorSummary;
  query: string;
  notes: string[];
  engine: AudioAnalysisEngine;
}

export interface EssentiaSearchPayload {
  model: 'essentia';
  focus: SimilarityFocus;
  trim: AudioTrimSelection;
  descriptors: EssentiaDescriptorSummary;
  suggestedQuery: string;
}

export interface ClapSearchPayload {
  model: 'clap';
  trim: AudioTrimSelection;
  note: 'CLAP search is expected to be handled by the backend using audio embeddings.';
}

export interface FreesoundSearchRequest {
  query: string;
  filters: FreesoundSearchFilters;
  limit: number;
  model?: RecommendationModel;
  focus?: SimilarityFocus;
  trimSelection?: AudioTrimSelection;
  frontendAnalysis?: AudioAnalysisResult | null;
  essentiaPayload?: EssentiaSearchPayload | null;
  clapPayload?: ClapSearchPayload | null;
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