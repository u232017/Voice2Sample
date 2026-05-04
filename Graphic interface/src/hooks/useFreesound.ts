import { useState, useCallback } from 'react';
import { freesoundAPI } from '../services/freesound';
import { FreesoundSound, RecordedAudio } from '../services/types';

export const useFreesound = () => {
  const [results, setResults] = useState<FreesoundSound[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchSimilar = useCallback(async (audio: RecordedAudio, limit: number = 6) => {
    try {
      setError(null);
      setIsLoading(true);
      const similarSounds = await freesoundAPI.searchSimilar(audio.blob, limit);
      setResults(similarSounds);
      setIsLoading(false);
      return similarSounds;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search similar sounds';
      setError(errorMessage);
      setIsLoading(false);
      return [];
    }
  }, []);

  const search = useCallback(async (query: string, limit: number = 6) => {
    try {
      setError(null);
      setIsLoading(true);
      const sounds = await freesoundAPI.search(query, limit);
      setResults(sounds);
      setIsLoading(false);
      return sounds;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search sounds';
      setError(errorMessage);
      setIsLoading(false);
      return [];
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isLoading,
    error,
    searchSimilar,
    search,
    clearResults,
  };
};
