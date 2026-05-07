import { ArrowRight, Database, FileAudio, Mic, SlidersHorizontal, Waves } from 'lucide-react';

interface HomeProps {
  onNavigate: (mode: 'record' | 'upload') => void;
}

const bars = [34, 62, 44, 78, 52, 88, 38, 70, 48, 82, 58, 92, 42, 74, 54, 84, 46, 66];

export function Home({ onNavigate }: HomeProps) {
  return (
    <section className="app-page overflow-hidden">
      <div className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 py-10 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            <Waves className="h-4 w-4" />
            Audio Descriptor-Based Sound Discovery
          </div>

          <h1 className="max-w-4xl text-5xl font-bold leading-[1.02] text-white md:text-7xl">
            SonicMatch
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 md:text-xl">
            Record or upload a sound, preview and trim it, choose simple filters, then load 4 real
            sound examples from Freesound while Essentia descriptor matching is prepared.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button className="primary-action" onClick={() => onNavigate('record')}>
              <Mic className="h-5 w-5" />
              Record sound
              <ArrowRight className="h-5 w-5" />
            </button>
            <button className="secondary-action" onClick={() => onNavigate('upload')}>
              <FileAudio className="h-5 w-5" />
              Upload audio
            </button>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="feature-tile">
              <SlidersHorizontal className="h-5 w-5 text-cyan-200" />
              <span>Essentia-ready flow</span>
            </div>
            <div className="feature-tile">
              <Database className="h-5 w-5 text-lime-200" />
              <span>Real Freesound results</span>
            </div>
            <div className="feature-tile">
              <Waves className="h-5 w-5 text-amber-200" />
              <span>Preview before analysis</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="sound-panel">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Guided Flow
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">From sample to results</h2>
              </div>
              <div className="rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 text-sm font-semibold text-lime-100">
                Live API
              </div>
            </div>

            <div className="my-8 flex h-44 items-end gap-2 rounded-lg border border-white/10 bg-slate-950/70 px-4 py-5">
              {bars.map((height, index) => (
                <div
                  key={index}
                  className="wave-bar"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${index * 70}ms`,
                  }}
                />
              ))}
            </div>

            <div className="space-y-3">
              {[
                'Choose audio',
                'Trim and preview',
                'Pick filters',
                'Search Freesound',
              ].map((item, index) => (
                <div key={item} className="flow-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
