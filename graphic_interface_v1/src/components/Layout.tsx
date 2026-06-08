import { ExternalLink, Info, X } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
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
    <div className="app-frame">
      <header className="app-header">
        <nav className="app-nav">
          <button onClick={onHome} className="app-brand-button" aria-label="Go home">
            <BrandLogo />
            <span className="app-brand-copy">
              <span>Voice 2 Sample</span>
              <span>SonicMatch discovery workstation</span>
            </span>
          </button>

          <div className="app-header-actions" ref={aboutPanelRef}>
            <div className="app-header-pills" aria-hidden="true">
              <span>Capture</span>
              <span>Analyze</span>
              <span>Discover</span>
            </div>

            <div className="app-icon-actions">
              <a
                href="https://freesound.org"
                target="_blank"
                rel="noreferrer"
                className="header-link-chip"
                title="Freesound"
                aria-label="Open Freesound"
              >
                <ExternalLink className="h-4 w-4" />
                Freesound
              </a>
              <button
                type="button"
                className="icon-button"
                title="About Voice 2 Sample"
                aria-label="About Voice 2 Sample"
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
                aria-label="About Voice 2 Sample"
              >
                <div className="about-popover-header">
                  <h2>About Voice 2 Sample</h2>
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
                  Voice 2 Sample is a music-focused web application created as part of an
                  academic project. It helps producers and sound designers capture a phrase,
                  analyze its characteristics, and navigate similar Freesound material without
                  leaving the same workspace.
                </p>
                <p>
                  This interface is designed as a compact discovery workstation, blending audio
                  analysis, trimming, recommendation models, and sample preview into one visual
                  flow.
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
