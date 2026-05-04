import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { FreesoundWaveform } from './FreesoundWaveform';
import { SoundCard } from './SoundCard';
import { LoadingSpinner } from './LoadingSpinner';
import { useFreesound } from '../hooks/useFreesound';
import { useAudio } from '../context/AudioContext';
import { audioService } from '../services/audio';

interface ResultsProps {
  onBack: () => void;
}

export function Results({ onBack }: ResultsProps) {
  const { currentAudio } = useAudio();
  const { results, isLoading, error, searchSimilar, clearResults } = useFreesound();
  const [playingId, setPlayingId] = useState<number | null>(null);

  useEffect(() => {
    if (currentAudio) {
      searchSimilar(currentAudio, 6);
    }
  }, [currentAudio]);

  const handleBack = () => {
    clearResults();
    onBack();
  };

  if (!currentAudio) {
    return (
      <div className="min-h-[calc(100vh-89px)] flex items-center justify-center bg-freesound-darker">
        <button
          onClick={onBack}
          className="px-6 py-3 text-freesound-yellow hover:text-freesound-orange transition-colors"
        >
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-89px)] px-8 py-12 bg-freesound-darker">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold mb-2 text-white">Sonidos Similares Encontrados</h2>
            <p className="text-freesound-yellow/70">
              {results.length} resultados de la base de datos de Freesound
            </p>
          </div>
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-xl flex items-center gap-2 border-2 border-freesound-yellow/30 hover:border-freesound-yellow/60 text-freesound-yellow hover:text-freesound-orange transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
        </div>

        {/* Original Sound Panel */}
        <div
          className="rounded-2xl p-6 mb-8 border-2"
          style={{
            background: '#1a1a1a',
            borderColor: 'rgba(245, 212, 66, 0.3)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 flex-1">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #f5d442, #f5a742)',
                  boxShadow: '0 4px 20px rgba(245, 212, 66, 0.4)',
                }}
              >
                <span className="text-lg text-freesound-darker">▶</span>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-bold text-white">Tu Sonido Original</h3>
                  <span className="px-3 py-1 rounded-full text-xs bg-freesound-yellow/20 text-freesound-yellow">
                    Fuente
                  </span>
                </div>
                <FreesoundWaveform
                  isPlaying={playingId === 0}
                  duration={audioService.formatDuration(currentAudio.metadata.duration)}
                  progress={playingId === 0 ? 0.4 : 0}
                  height="h-16"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-900/10 border-2 border-red-500/30 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-3">{error}</p>
            <button
              onClick={() => searchSimilar(currentAudio, 6)}
              className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-freesound-yellow/60 mb-3">No se encontraron sonidos similares</p>
            <button
              onClick={() => searchSimilar(currentAudio, 6)}
              className="px-6 py-2 bg-freesound-yellow/20 hover:bg-freesound-yellow/30 text-freesound-yellow rounded-lg transition-colors"
            >
              Buscar de nuevo
            </button>
          </div>
        )}

        {/* Results Grid */}
        {!isLoading && results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((sound) => (
              <SoundCard
                key={sound.id}
                sound={sound}
                isPlaying={playingId === sound.id}
                onPlay={() => setPlayingId(sound.id)}
                onPause={() => setPlayingId(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
