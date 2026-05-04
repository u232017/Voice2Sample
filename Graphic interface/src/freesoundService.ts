// Freesound API Service
// Handles all interactions with the Freesound API

const FREESOUND_API_KEY = import.meta.env.VITE_FREESOUND_API_KEY || '';
const FREESOUND_BASE_URL = 'https://freesound.org/api/v2';

export interface FreesoundSound {
  id: number;
  name: string;
  url: string;
  description: string;
  duration: number;
  username: string;
  previews: {
    'preview-hq-mp3': string;
    'preview-lq-mp3': string;
  };
  images: {
    waveform_l: string;
    waveform_m: string;
    waveform_s: string;
  };
  tags: Array<{ name: string }>;
  categories: Array<{ name: string }>;
  analysis: {
    duration?: number;
    loudness?: number;
    [key: string]: any;
  };
}

export interface SearchParams {
  query: string;
  filter?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

class FreesoundService {
  private apiKey: string;

  constructor(apiKey: string = FREESOUND_API_KEY) {
    this.apiKey = apiKey;
  }

  /**
   * Search for sounds in Freesound database
   */
  async search(params: SearchParams): Promise<FreesoundSound[]> {
    if (!this.apiKey) {
      console.warn('Freesound API key not configured');
      return [];
    }

    try {
      const queryParams = new URLSearchParams({
        query: params.query,
        filter: params.filter || '',
        sort: params.sort || 'relevance',
        limit: String(params.limit || 10),
        offset: String(params.offset || 0),
        fields: 'id,name,url,description,duration,username,previews,images,tags,analysis',
        token: this.apiKey,
      });

      const response = await fetch(
        `${FREESOUND_BASE_URL}/search/text/?${queryParams}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching Freesound:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific sound
   */
  async getSound(soundId: number): Promise<FreesoundSound | null> {
    if (!this.apiKey) {
      console.warn('Freesound API key not configured');
      return null;
    }

    try {
      const response = await fetch(
        `${FREESOUND_BASE_URL}/sounds/${soundId}/?token=${this.apiKey}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching sound details:', error);
      return null;
    }
  }

  /**
   * Get waveform image URL for a sound
   */
  getWaveformUrl(sound: FreesoundSound, size: 'large' | 'medium' | 'small' = 'large'): string {
    const sizeMap = {
      large: 'waveform_l',
      medium: 'waveform_m',
      small: 'waveform_s',
    };
    return sound.images?.[sizeMap[size]] || '';
  }

  /**
   * Get preview audio URL
   */
  getPreviewUrl(sound: FreesoundSound, quality: 'hq' | 'lq' = 'hq'): string {
    const key = quality === 'hq' ? 'preview-hq-mp3' : 'preview-lq-mp3';
    return sound.previews?.[key] || '';
  }
}

export const freesoundService = new FreesoundService();
