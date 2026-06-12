import {
  AudioAnalysisResult,
  FreesoundSearchFilters,
  FreesoundSearchRequest,
  FreesoundSearchResponse,
  FreesoundSound,
  SimilarityFocus,
} from './types';

const RAW_API_BASE = import.meta.env.VITE_FREESOUND_API_BASE || 'https://freesound.org/apiv2';
const API_BASE = RAW_API_BASE.replace('/api/v2', '/apiv2').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_FREESOUND_API_KEY;

const FALLBACK_QUERIES = [
  'ambient texture',
  'drum loop',
  'melodic loop',
  'synth one shot',
  'bright hit',
  'dark drone',
  'percussion',
  'piano note',
  'vocal texture',
  'foley impact',
];

const sortMap: Record<FreesoundSearchFilters['sort'], string> = {
  relevance: 'score',
  rating: 'rating_desc',
  downloads: 'downloads_desc',
  recent: 'created_desc',
};

interface RequestOptions {
  retries?: number;
  timeout?: number;
}

class FreesoundAPI {
  private apiKey: string;
  private baseUrl: string;
  private requestCache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheDuration = 2 * 60 * 1000;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error('FREESOUND_API_KEY_MISSING');
    }
  }

  private getCacheKey(method: string, params: Record<string, unknown>): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private isCacheValid(cacheEntry: { data: unknown; timestamp: number }): boolean {
    return Date.now() - cacheEntry.timestamp < this.cacheDuration;
  }

  private async fetchJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { retries = 1, timeout = 12000 } = options;
    let lastError: Error | null = null;
    this.ensureConfigured();

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        window.clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          console.error('Freesound HTTP error', {
            status: response.status,
            statusText: response.statusText,
            url,
            body,
          });
          throw new Error(`FREESOUND_HTTP_${response.status}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        window.clearTimeout(timeoutId);
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('FREESOUND_REQUEST_FAILED');
  }

  async search(request: FreesoundSearchRequest): Promise<FreesoundSound[]> {
    const query = this.resolveQuery(request);
    const filter = this.buildFilter(request.filters, request.focus);
    const limit = Math.min(Math.max(request.limit, 1), 4);
    const cacheKey = this.getCacheKey('search', {
      query,
      filter,
      limit,
      filters: request.filters,
      model: request.model,
      focus: request.focus,
      analysis: request.frontendAnalysis?.descriptors,
    });
    const cached = this.requestCache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      return cached.data as FreesoundSound[];
    }

    const url = new URL(`${this.baseUrl}/search/`);
    url.searchParams.set('query', query);
    url.searchParams.set('token', this.apiKey);
    url.searchParams.set('page_size', String(limit));
    url.searchParams.set('page', String(Math.floor(Math.random() * 3) + 1));
    url.searchParams.set('sort', sortMap[request.filters.sort]);
    url.searchParams.set(
      'fields',
      [
        'id',
        'name',
        'username',
        'duration',
        'tags',
        'previews',
        'images',
        'url',
        'license',
        'description',
        'created',
        'num_downloads',
        'avg_rating',
        'num_ratings',
        'num_comments',
        'samplerate',
        'channels',
        'bitrate',
      ].join(',')
    );

    if (filter) {
      url.searchParams.set('filter', filter);
    }

    const data = await this.fetchJson<FreesoundSearchResponse>(url.toString());
    const results = data.results.slice(0, limit);
    this.requestCache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  }

  getPreviewUrl(sound: FreesoundSound): string | undefined {
    return (
      sound.previews?.['preview-hq-mp3'] ||
      sound.previews?.['preview-lq-mp3'] ||
      sound.previews?.['preview-hq-ogg'] ||
      sound.previews?.['preview-lq-ogg']
    );
  }

  getWaveformUrl(sound: FreesoundSound): string | undefined {
    return sound.images?.waveform_m || sound.images?.waveform_l;
  }
    getVisualizationUrl(sound: FreesoundSound): string | undefined {
    return (
      this.getWaveformUrl(sound) ||
      sound.images?.spectral_m ||
      sound.images?.spectral_l
    );
  }

  async getSoundDetail(soundId: number): Promise<Partial<FreesoundSound> | null> {
    const cacheKey = this.getCacheKey('sound-detail', { soundId });
    const cached = this.requestCache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      return cached.data as FreesoundSound;
    }

    try {
      const url = new URL(`${this.baseUrl}/sounds/${soundId}/`);
      url.searchParams.set('token', this.apiKey);
      url.searchParams.set(
        'fields',
        [
          'id',
          'name',
          'username',
          'duration',
          'tags',
          'previews',
          'images',
          'url',
          'license',
          'description',
          'created',
          'num_downloads',
          'avg_rating',
          'num_ratings',
          'num_comments',
          'samplerate',
          'channels',
          'bitrate',
        ].join(',')
      );

      const detail = await this.fetchJson<FreesoundSound>(url.toString(), {
        retries: 1,
        timeout: 12000,
      });

      this.requestCache.set(cacheKey, {
        data: detail,
        timestamp: Date.now(),
      });

      return detail;
    } catch (error) {
      console.warn(`Could not load Freesound details for sound ${soundId}:`, error);
      return null;
    }
  }

  getHumanError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message === 'FREESOUND_API_KEY_MISSING') {
      return 'Freesound API key is missing. Add VITE_FREESOUND_API_KEY to .env.local.';
    }

    if (message.startsWith('FREESOUND_HTTP_401') || message.startsWith('FREESOUND_HTTP_403')) {
      return 'Freesound request failed. Check your API key permissions.';
    }

    if (message.startsWith('FREESOUND_HTTP_404')) {
      return 'Freesound endpoint was not found. Check the API base URL configuration.';
    }

    if (message.includes('AbortError')) {
      return 'Freesound request timed out. Check your network connection and try again.';
    }

    return 'Freesound request failed. Check your API key or network connection.';
  }

  clearCache(): void {
    this.requestCache.clear();
  }

  private resolveQuery(request: FreesoundSearchRequest): string {
    if (request.query.trim()) {
      return request.query.trim();
    }

    if (request.model === 'acoustic' && request.frontendAnalysis && request.focus) {
      return this.queryFromEssentia(request.frontendAnalysis, request.focus);
    }

    const terms: string[] = [request.filters.mood, request.filters.category].filter((term) => term !== 'any');

    if (request.filters.license === 'creative_commons') {
      terms.push('creative commons');
    }

    if (request.filters.license === 'commercial_friendly') {
      terms.push('cc0');
    }

    if (terms.length) {
      return terms.join(' ');
    }

    return FALLBACK_QUERIES[Math.floor(Math.random() * FALLBACK_QUERIES.length)];
  }

  private queryFromEssentia(analysis: AudioAnalysisResult, focus: SimilarityFocus): string {
    const d = analysis.descriptors;

    if (focus === 'melodic') {
      const label = d.melody.melodicLabel;
      const range = d.melody.pitchRangeLabel;
      const pitch = d.melody.estimatedPitch;
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
      const bpm = d.rhythm.bpm;
      const rhythmLabel = d.rhythm.rhythmLabel;
      const percussive = d.rhythm.percussiveScore;
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
      const timbre = d.timbre.timbreLabel;
      const brightness = d.timbre.brightnessLabel;
      if (timbre === 'bright') return 'bright crisp high frequency shimmer';
      if (timbre === 'dark') return 'dark muted low frequency warm';
      if (timbre === 'noisy') return 'noise texture rough gritty';
      if (timbre === 'textured') return 'textured granular complex timbre';
      if (brightness === 'bright') return 'clean bright tone sample';
      if (brightness === 'dark') return 'clean dark warm tone';
      return 'clean pure tone sample';
    }

    // general
    const parts: string[] = [];
    if (d.energy.energyLabel === 'loud') parts.push('energetic loud');
    else if (d.energy.energyLabel === 'quiet') parts.push('soft quiet');
    if (d.timbre.timbreLabel === 'bright') parts.push('bright');
    else if (d.timbre.timbreLabel === 'dark') parts.push('dark');
    else if (d.timbre.timbreLabel === 'noisy') parts.push('noisy');
    const bpm = d.rhythm.bpm;
    if (bpm) {
      parts.push(`${Math.round(bpm / 5) * 5}bpm`);
    } else if (d.rhythm.rhythmLabel === 'percussive') {
      parts.push('percussive');
    } else if (d.rhythm.rhythmLabel === 'sustained') {
      parts.push('sustained');
    }
    if (d.melody.melodicLabel === 'melodic') parts.push('melodic');
    else if (d.melody.melodicLabel === 'tonal') parts.push('tonal');
    return parts.length ? parts.join(' ') + ' sound sample' : 'sound texture sample';
  }

  private buildFilter(filters: FreesoundSearchFilters, focus?: SimilarityFocus): string {
    const parts: string[] = [];

    if (filters.duration === 'short') parts.push('duration:[0 TO 5]');
    if (filters.duration === 'medium') parts.push('duration:[5 TO 30]');
    if (filters.duration === 'long') parts.push('duration:[30 TO *]');

    // Focus-aware duration constraints when no explicit duration filter
    if (filters.duration === 'any') {
      if (focus === 'melodic') parts.push('duration:[0.5 TO *]'); // avoid sub-frame hits
      if (focus === 'bpm') parts.push('duration:[1 TO 60]');      // prefer loop lengths
    }

    return parts.join(' ');
  }
}

export const freesoundAPI = new FreesoundAPI(API_KEY, API_BASE);