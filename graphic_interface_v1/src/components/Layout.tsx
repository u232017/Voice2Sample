import { ExternalLink, Info, X } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { FallingNotesBackground } from './FallingNotesBackground';
import { BrandLogo } from './BrandLogo';

interface LayoutProps {
  children: ReactNode;
  onHome?: () => void;
}

export function Layout({ children, onHome }: LayoutProps) {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const aboutPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAboutOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (aboutPanelRef.current && !aboutPanelRef.current.contains(event.target as Node)) {
        setIsAboutOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAboutOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAboutOpen]);

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

          <div className="relative" ref={aboutPanelRef}>
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
              <button
                type="button"
                className="icon-button"
                title="About Voice to Sample"
                aria-label="About Voice to Sample"
                aria-expanded={isAboutOpen}
                aria-controls="about-voice-to-sample"
                onClick={() => setIsAboutOpen((open) => !open)}
              >
                <Info className="h-5 w-5" />
              </button>
            </div>

            {isAboutOpen ? (
              <section
                id="about-voice-to-sample"
                className="about-popover"
                role="dialog"
                aria-modal="false"
                aria-label="About Voice to Sample"
              >
                <div className="about-popover-header">
                  <h2>About Voice to Sample</h2>
                  <button
                    type="button"
                    className="about-close-button"
                    aria-label="Close information panel"
                    onClick={() => setIsAboutOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p>
                  Voice to Sample is a music-focused web application created as part of an
                  academic project. It helps music producers and sound creators find useful audio
                  samples more easily by recording or uploading a sound and getting similar results
                  to preview, compare, and download.
                </p>
                <p>
                  This interface is designed to keep sound discovery simple, visual, and creative,
                  blending frontend design, audio analysis, and recommendation concepts.
                </p>
              </section>
            ) : null}
          </div>
        </nav>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
