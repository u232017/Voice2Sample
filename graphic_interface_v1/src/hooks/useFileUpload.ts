import { useState, useCallback } from 'react';
import { audioService } from '../services/audio';
import { RecordedAudio } from '../services/types';

export const useFileUpload = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File): Promise<RecordedAudio | null> => {
    try {
      setError(null);
      setIsLoading(true);
      const audio = await audioService.processFile(file);
      setIsLoading(false);
      return audio;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  }, []);

  return {
    isLoading,
    error,
    uploadFile,
  };
};
