import { ExternalLink, Info } from 'lucide-react';
import { ReactNode } from 'react';
import { FallingNotesBackground } from './FallingNotesBackground';
import { BrandLogo } from './BrandLogo';

interface LayoutProps {
  children: ReactNode;
  onHome?: () => void;
}

export function Layout({ children, onHome }: LayoutProps) {
  return (
    <div className="app-frame min-h-screen bg-slate-950 text-white">
      <FallingNotesBackground />
      <header className="app-header">
        <nav className="mx-auto flex h-[58px] max-w-7xl items-center justify-between px-4 md:px-6">
          <button onClick={onHome} className="app-brand-button" aria-label="Go home">
            <BrandLogo />
            <span className="app-brand-copy">
              <span className="block text-lg font-black leading-5 text-amber-300">Voice to Sample</span>
              <span className="text-xs font-medium text-lime-400/85">
                SonicMatch sound discovery
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

      <main className="app-main">{children}</main>
    </div>
  );
}
