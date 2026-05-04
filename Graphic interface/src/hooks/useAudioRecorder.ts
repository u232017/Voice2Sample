import { useState, useCallback, useEffect } from 'react';
import { audioService } from '../services/audio';
import { RecordedAudio } from '../services/types';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setDuration(audioService.getRecordingDuration());
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      await audioService.startRecording();
      setIsRecording(true);
      setDuration(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<RecordedAudio | null> => {
    try {
      setIsRecording(false);
      const audio = await audioService.stopRecording();
      setDuration(0);
      return audio;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      return null;
    }
  }, []);

  return {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording,
  };
};
