import { AudioTrimSelection, FreesoundSearchRequest, FreesoundSound, RecordedAudio } from './types';
import { audioAnalysisService } from './audioAnalysisService';
import { freesoundAPI } from './freesound';

function mergeSoundWithFreesoundDetail(
  sound: FreesoundSound,
  detail: Partial<FreesoundSound>
): FreesoundSound {
  return {
    ...detail,
    ...sound,
    previews: {
      'preview-hq-mp3':
        sound.previews?.['preview-hq-mp3'] ?? detail.previews?.['preview-hq-mp3'],
      'preview-lq-mp3':
        sound.previews?.['preview-lq-mp3'] ?? detail.previews?.['preview-lq-mp3'],
      'preview-hq-ogg':
        sound.previews?.['preview-hq-ogg'] ?? detail.previews?.['preview-hq-ogg'],
      'preview-lq-ogg':
        sound.previews?.['preview-lq-ogg'] ?? detail.previews?.['preview-lq-ogg'],
    },
    images: {
      spectral_m: sound.images?.spectral_m ?? detail.images?.spectral_m,
      waveform_m: sound.images?.waveform_m ?? detail.images?.waveform_m,
      waveform_l: sound.images?.waveform_l ?? detail.images?.waveform_l,
      spectral_l: sound.images?.spectral_l ?? detail.images?.spectral_l,
    },
  };
}

class RecommendationAPI {
  private async hydrateMissingVisualizations(sounds: FreesoundSound[]): Promise<FreesoundSound[]> {
    const soundsMissingVisualization = sounds.filter((sound) => !freesoundAPI.getVisualizationUrl(sound));
    if (!soundsMissingVisualization.length) {
      return sounds;
    }

    const detailsById = new Map<number, Partial<FreesoundSound>>();
    await Promise.all(
      soundsMissingVisualization.map(async (sound) => {
        const detail = await freesoundAPI.getSoundDetail(sound.id);
        if (detail) {
          detailsById.set(sound.id, detail);
        }
      })
    );

    return sounds.map((sound) => {
      const detail = detailsById.get(sound.id);
      if (!detail) {
        return sound;
      }
      return mergeSoundWithFreesoundDetail(sound, detail);
    });
  }

  async recommend(
    request: FreesoundSearchRequest,
    audio?: RecordedAudio,
    _trim?: AudioTrimSelection | null
  ): Promise<FreesoundSound[]> {
    const analysis = audio ? await audioAnalysisService.analyze(audio) : null;
    const searchRequest: FreesoundSearchRequest = {
      ...request,
      query: request.query.trim() || analysis?.query || '',
      limit: Math.min(Math.max(request.limit, 1), 4),
    };

    const results = await freesoundAPI.search(searchRequest);
    return this.hydrateMissingVisualizations(results);
  }
}

export const recommendationAPI = new RecommendationAPI();
