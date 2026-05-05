import { useCallback, useState } from 'react';
import { freesoundAPI } from '../services/freesound';
import { FreesoundSearchRequest, FreesoundSound } from '../services/types';

export const useFreesound = () => {
  const [results, setResults] = useState<FreesoundSound[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<FreesoundSearchRequest | null>(null);

  const searchExamples = useCallback(async (request: FreesoundSearchRequest) => {
    try {
      setError(null);
      setIsLoading(true);
      setLastRequest(request);
      const sounds = await freesoundAPI.search({ ...request, limit: 4 });
      setResults(sounds);
      return sounds;
    } catch (err) {
      console.error('Freesound search failed:', err);
      setError(freesoundAPI.getHumanError(err));
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
