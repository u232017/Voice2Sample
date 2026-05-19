import { useCallback, useState } from 'react';
import { recommendationAPI } from '../services/recommendations';
import { freesoundAPI } from '../services/freesound';
import { AudioTrimSelection, FreesoundSearchRequest, FreesoundSound, RecordedAudio } from '../services/types';

function getRecommendationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith('FREESOUND_') || message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return freesoundAPI.getHumanError(error);
  }

  return 'Recommendation failed. Check your Freesound API key or try again with another audio sample.';
}

export const useFreesound = () => {
  const [results, setResults] = useState<FreesoundSound[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<FreesoundSearchRequest | null>(null);

  const searchExamples = useCallback(async (
    request: FreesoundSearchRequest,
    audio?: RecordedAudio,
    trim?: AudioTrimSelection | null
  ) => {
    try {
      setError(null);
      setIsLoading(true);
      setLastRequest(request);
      const sounds = await recommendationAPI.recommend({ ...request, limit: 4 }, audio, trim);
      setResults(sounds);
      return sounds;
    } catch (err) {
      console.error('Recommendation search failed:', err);
      setError(getRecommendationError(err));
      setResults([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setLastRequest(null);
  }, []);

  return {
    results,
    isLoading,
    error,
    lastRequest,
    searchExamples,
    clearResults,
  };
};
