import React, { createContext, useContext, useState, useCallback } from 'react';
import { RecordedAudio } from '../services/types';

interface AudioContextType {
  currentAudio: RecordedAudio | null;
  isRecording: boolean;
  recordingDuration: number;
  setCurrentAudio: (audio: RecordedAudio | null) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingDuration: (duration: number) => void;
  clearAudio: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAudio, setCurrentAudio] = useState<RecordedAudio | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const clearAudio = useCallback(() => {
    setCurrentAudio(null);
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const value: AudioContextType = {
    currentAudio,
    isRecording,
    recordingDuration,
    setCurrentAudio,
    setIsRecording,
    setRecordingDuration,
    clearAudio,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
