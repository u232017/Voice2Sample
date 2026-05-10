import { useCallback, useState } from 'react';
import { recommendationAPI } from '../services/recommendations';
import { AudioTrimSelection, FreesoundSearchRequest, FreesoundSound, RecordedAudio } from '../services/types';

function getRecommendationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Backend is not running. Start it with: python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000';
  }

  if (message.startsWith('BACKEND_HTTP_500')) {
    return 'Dataset recommendation failed in the backend. Check the backend terminal for details.';
  }

  if (message.startsWith('BACKEND_HTTP_')) {
    return 'Backend request failed. Check that the local API and dataset are available.';
  }

  return 'Recommendation failed. Check that the local backend is running and the dataset is available.';
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
