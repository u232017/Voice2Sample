import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  AudioTrimSelection,
  FreesoundSearchFilters,
  FreesoundSearchRequest,
  RecordedAudio,
} from '../services/types';

export const defaultSearchFilters: FreesoundSearchFilters = {
  category: 'any',
  mood: 'any',
  duration: 'any',
  sort: 'relevance',
  license: 'any',
};

interface AudioContextType {
  currentAudio: RecordedAudio | null;
  trimSelection: AudioTrimSelection | null;
  searchRequest: FreesoundSearchRequest;
  isRecording: boolean;
  recordingDuration: number;
  setCurrentAudio: (audio: RecordedAudio | null) => void;
  setTrimSelection: (trim: AudioTrimSelection | null) => void;
  setSearchRequest: (request: FreesoundSearchRequest) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingDuration: (duration: number) => void;
  clearAudio: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAudio, setCurrentAudio] = useState<RecordedAudio | null>(null);
  const [trimSelection, setTrimSelection] = useState<AudioTrimSelection | null>(null);
  const [searchRequest, setSearchRequest] = useState<FreesoundSearchRequest>({
    query: '',
    filters: defaultSearchFilters,
    limit: 4,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const clearAudio = useCallback(() => {
    setCurrentAudio(null);
    setTrimSelection(null);
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const value: AudioContextType = {
    currentAudio,
    trimSelection,
    searchRequest,
    isRecording,
    recordingDuration,
    setCurrentAudio,
    setTrimSelection,
    setSearchRequest,
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
