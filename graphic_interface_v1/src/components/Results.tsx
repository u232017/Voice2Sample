import { useEffect } from 'react';
import { AlertCircle, ArrowLeft, Database, RefreshCw, Search } from 'lucide-react';
import { SoundCard } from './SoundCard';
import { LoadingSpinner } from './LoadingSpinner';
import { useFreesound } from '../hooks/useFreesound';
import { useAudio } from '../context/AudioContext';
import { audioService } from '../services/audio';

interface ResultsProps {
  onBack: () => void;
}

export function Results({ onBack }: ResultsProps) {
  const { currentAudio, searchRequest, trimSelection } = useAudio();
  const { results, isLoading, error, lastRequest, searchExamples, clearResults } = useFreesound();

  useEffect(() => {
    if (currentAudio) {
      searchExamples(searchRequest);
    }
  }, [currentAudio, searchExamples, searchRequest]);

  const handleBack = () => {
    clearResults();
    onBack();
  };

  if (!currentAudio) {
    return (
      <section className="app-page grid min-h-[calc(100vh-76px)] place-items-center px-5">
        <div className="empty-state">
          <AlertCircle className="mx-auto h-8 w-8 text-amber-200" />
          <h1 className="mt-4 text-2xl font-bold text-white">No audio sample selected</h1>
          <button onClick={handleBack} className="primary-action mt-6">
            <ArrowLeft className="h-5 w-5" />
            Choose audio
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="app-page">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-kicker">Real Freesound API results</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-white md:text-5xl">
              4 sounds from Freesound
            </h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Temporary Freesound search mode is enabled. These are real Freesound results, not
              descriptor-matched recommendations yet.
            </p>
          </div>
          <button onClick={handleBack} className="secondary-action">
            <ArrowLeft className="h-5 w-5" />
            Back to audio
          </button>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="summary-card">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-300 text-slate-950">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Your audio sample</h2>
                <p className="text-sm text-slate-300">{currentAudio.name || 'Recorded sample'}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="metric-box">
                <span>Total</span>
                <strong>{audioService.formatPreciseDuration(currentAudio.metadata.duration)}</strong>
              </div>
              <div className="metric-box">
                <span>Selected</span>
                <strong>
                  {trimSelection
                    ? `${audioService.formatDuration(trimSelection.start)}-${audioService.formatDuration(trimSelection.end)}`
                    : 'Full'}
                </strong>
              </div>
              <div className="metric-box">
                <span>Channels</span>
                <strong>{currentAudio.metadata.channels}</strong>
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-lime-300 text-slate-950">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Search sent to Freesound</h2>
                <p className="text-sm text-slate-300">
                  Query:{' '}
                  <span className="font-semibold text-white">
                    {lastRequest?.query || 'generated from selected filters'}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-4">
              <div className="metric-box">
                <span>Category</span>
                <strong>{searchRequest.filters.category}</strong>
              </div>
              <div className="metric-box">
                <span>Mood</span>
                <strong>{searchRequest.filters.mood}</strong>
              </div>
              <div className="metric-box">
                <span>Duration</span>
                <strong>{searchRequest.filters.duration}</strong>
              </div>
              <div className="metric-box">
                <span>Sort</span>
                <strong>{searchRequest.filters.sort}</strong>
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="loading-panel">
            <LoadingSpinner />
          </div>
        )}

        {error && !isLoading && (
          <div className="status-message error">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
            <button onClick={() => searchExamples(searchRequest)} className="ghost-action ml-auto">
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && results.length === 0 && (
          <div className="empty-state">
            <Database className="mx-auto h-8 w-8 text-cyan-200" />
            <h2 className="mt-4 text-2xl font-bold text-white">No Freesound results found</h2>
            <p className="mt-2 text-slate-300">Try broader filters or search again.</p>
            <button onClick={() => searchExamples(searchRequest)} className="primary-action mt-6">
              <RefreshCw className="h-5 w-5" />
              Search again
            </button>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-4">
            {results.slice(0, 4).map((sound) => (
              <SoundCard key={sound.id} sound={sound} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
