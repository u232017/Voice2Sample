import { useEffect } from 'react';
import { AlertCircle, ArrowLeft, Database, RefreshCw } from 'lucide-react';
import { SoundCard } from './SoundCard';
import { LoadingSpinner } from './LoadingSpinner';
import { useFreesound } from '../hooks/useFreesound';
import { useAudio } from '../context/AudioContext';

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
      <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-10">
        <div className="results-hero mb-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-kicker">Freesound results</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-white md:text-5xl">
              Real sound matches
            </h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              4 real sounds from Freesound. Query: {lastRequest?.query || 'selected filters'}.
            </p>
          </div>
          <button onClick={handleBack} className="secondary-action">
            <ArrowLeft className="h-5 w-5" />
            Back to audio
          </button>
        </div>

        <div className="result-filter-strip mb-6">
          <span>{currentAudio.name || 'Audio sample'}</span>
          <span>{searchRequest.filters.category}</span>
          <span>{searchRequest.filters.mood}</span>
          <span>{searchRequest.filters.sort}</span>
          {trimSelection && <span>trim selected</span>}
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
          <div className="results-grid">
            {results.slice(0, 4).map((sound) => (
              <SoundCard key={sound.id} sound={sound} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
