import { AudioWaveform, ExternalLink, Info } from 'lucide-react';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  onHome: () => void;
}

export function Layout({ children, onHome }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-amber-300/10 bg-[#171717]/95 backdrop-blur-xl">
        <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 md:px-8">
          <button onClick={onHome} className="flex items-center gap-3 text-left" aria-label="Go home">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-300 text-black shadow-lg shadow-amber-400/20">
              <AudioWaveform className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-2xl font-black leading-6 text-amber-300">SonicMatch</span>
              <span className="text-sm font-medium text-lime-400/85">
                Freesound sound discovery
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <a
              href="https://freesound.org"
              target="_blank"
              rel="noreferrer"
              className="icon-button hidden sm:grid"
              title="Freesound"
              aria-label="Open Freesound"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
            <button className="icon-button" title="About this flow" aria-label="About this flow">
              <Info className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}
