import { FreesoundSound, FreesoundSearchResponse, FreesoundError } from './types';

const API_BASE = import.meta.env.VITE_FREESOUND_API_BASE || 'https://freesound.org/api/v2';
const API_KEY = import.meta.env.VITE_FREESOUND_API_KEY;

if (!API_KEY) {
  throw new Error('VITE_FREESOUND_API_KEY is not defined. Please check your .env.local file');
}

interface RequestOptions {
  retries?: number;
  timeout?: number;
}

class FreesoundAPI {
  private apiKey: string;
  private baseUrl: string;
  private requestCache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private getCacheKey(method: string, params: Record<string, unknown>): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private isCacheValid(cacheEntry: { data: unknown; timestamp: number }): boolean {
    return Date.now() - cacheEntry.timestamp < this.cacheDuration;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestOptions = {}
  ): Promise<Response> {
    const { retries = 3, timeout = 10000 } = options;
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error: FreesoundError = {
            code: response.status,
            message: `HTTP ${response.status}: ${response.statusText}`,
          };
          throw new Error(JSON.stringify(error));
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < retries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }

    throw lastError || new Error('Failed to fetch after retries');
  }

  async getSound(soundId: number): Promise<FreesoundSound> {
    const cacheKey = this.getCacheKey('getSound', { soundId });
    const cached = this.requestCache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      return cached.data as FreesoundSound;
    }

    const url = `${this.baseUrl}/sounds/${soundId}/?token=${this.apiKey}`;
    const response = await this.fetchWithRetry(url);
    const data = (await response.json()) as FreesoundSound;

    this.requestCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async searchSimilar(
    audioBlob: Blob,
    limit: number = 6
  ): Promise<FreesoundSound[]> {
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('target', 'tag');
    formData.append('results_filter', 'tag');
    formData.append('num_results', String(limit));

    const url = `${this.baseUrl}/sounds/similar_sounds/?token=${this.apiKey}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as FreesoundSearchResponse;
      return data.results;
    } catch (error) {
      console.error('Error searching similar sounds:', error);
      throw error;
    }
  }

  async search(query: string, limit: number = 6): Promise<FreesoundSound[]> {
    const cacheKey = this.getCacheKey('search', { query, limit });
    const cached = this.requestCache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      return cached.data as FreesoundSound[];
    }

    const url = new URL(`${this.baseUrl}/sounds/search/`);
    url.searchParams.append('query', query);
    url.searchParams.append('token', this.apiKey);
    url.searchParams.append('limit', String(limit));
    url.searchParams.append('sort', 'rating_desc');

    const response = await this.fetchWithRetry(url.toString());
    const data = (await response.json()) as FreesoundSearchResponse;

    this.requestCache.set(cacheKey, { data: data.results, timestamp: Date.now() });
    return data.results;
  }

  getPreviewUrl(sound: FreesoundSound): string | undefined {
    return sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'];
  }

  getDownloadUrl(soundId: number): string {
    return `${this.baseUrl}/sounds/${soundId}/download/?token=${this.apiKey}`;
  }

  getWaveformUrl(sound: FreesoundSound): string | undefined {
    return sound.images?.waveform_m || sound.images?.waveform_l;
  }

  clearCache(): void {
    this.requestCache.clear();
  }
}

export const freesoundAPI = new FreesoundAPI(API_KEY, API_BASE);
