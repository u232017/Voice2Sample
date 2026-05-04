import React, { createContext, useContext, useState, useCallback } from 'react';
import { FreesoundSound } from '../services/types';

interface FreesoundContextType {
  results: FreesoundSound[];
  isLoading: boolean;
  error: string | null;
  setResults: (results: FreesoundSound[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearResults: () => void;
}

const FreesoundContext = createContext<FreesoundContextType | undefined>(undefined);

export const FreesoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [results, setResults] = useState<FreesoundSound[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const value: FreesoundContextType = {
    results,
    isLoading,
    error,
    setResults,
    setIsLoading,
    setError,
    clearResults,
  };

  return (
    <FreesoundContext.Provider value={value}>{children}</FreesoundContext.Provider>
  );
};

export const useFreesoundContext = (): FreesoundContextType => {
  const context = useContext(FreesoundContext);
  if (!context) {
    throw new Error('useFreesoundContext must be used within a FreesoundProvider');
  }
  return context;
};
