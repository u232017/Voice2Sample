import { useCallback, useState } from 'react';
import { freesoundAPI } from '../services/freesound';
import { recommendationAPI } from '../services/recommendations';
import { FreesoundSearchRequest, FreesoundSound, RecordedAudio, AudioTrimSelection } from '../services/types';

export const useFreesound = () => {
  const [results, setResults] = useState<FreesoundSound[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<FreesoundSearchRequest | null>(null);

  const searchExamples = useCallback(
    async (
      request: FreesoundSearchRequest,
      audio?: RecordedAudio,
      trim?: AudioTrimSelection | null
    ) => {
      try {
        setError(null);
        setIsLoading(true);
        setLastRequest(request);

        let sounds: FreesoundSound[];

        if (request.model === 'clap') {
          // CLAP: all 32 features via backend
          console.info('CLAP: sending audio to backend (all 32 features)');
          sounds = await recommendationAPI.recommend(request, audio, trim);
        } else if (request.model === 'essentia' && request.focus === 'general') {
          // Essentia General: backend KNN with perceptual feature subset
          // (rhythm + melody + timbre, no energy) so results differ from CLAP.
          console.info('Essentia General: sending audio to backend (perceptual KNN)');
          const essentiaGeneralRequest = { ...request, focus: 'essentia_general' as const };
          sounds = await recommendationAPI.recommend(essentiaGeneralRequest, audio, trim);
        } else if (request.model === 'essentia') {
          // Other Essentia focuses: text query to Freesound
          console.info(`Essentia (${request.focus}): Freesound text search`);
          sounds = await freesoundAPI.search({ ...request, limit: 4 });
        } else {
          // Plain Freesound text search (no model)
          console.info('Freesound: text-based search');
          sounds = await freesoundAPI.search({ ...request, limit: 4 });
        }

        setResults(sounds);
        return sounds;
      } catch (err) {
        console.error('Search failed:', err);
        const message = err instanceof Error ? err.message : String(err);

        if (message.startsWith('BACKEND_HTTP_')) {
          const status = message.replace('BACKEND_HTTP_', '');
          setError(`Backend error (HTTP ${status}). Make sure the Python server is running on port 8000.`);
        } else if (message === 'NO_AUDIO_SELECTED') {
          setError('No audio selected. Record or upload a sound first.');
        } else {
          setError(request.model
            ? 'Backend request failed. Make sure the Python server is running (uvicorn backend.app:app).'
            : freesoundAPI.getHumanError(err));
        }

        setResults([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

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