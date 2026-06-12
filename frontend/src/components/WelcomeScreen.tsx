import type { CSSProperties } from 'react';
import {
  ArrowUpRight,
  AudioLines,
  Disc3,
  Headphones,
  Mic,
  Music4,
  Scissors,
  Search,
  Sparkles,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { AudioOrbVisualizer } from './AudioOrbVisualizer';

interface WelcomeScreenProps {
  onStart: () => void;
}

const floatingCards = [
  {
    id: 'record',
    title: '1. Record',
    copy: 'Capture a sound or upload audio.',
    icon: Mic,
    tone: 'green',
    iconTone: 'green',
    className: 'card-record',
    waveTone: 'wave-orange',
  },
  {
    id: 'trim',
    title: '2. Trim',
    copy: 'Isolate the moment that matters.',
    icon: Scissors,
    tone: 'orange',
    iconTone: 'green',
    className: 'card-trim',
    waveTone: 'wave-blue',
  },
  {
    id: 'analyze',
    title: '3. Analyze',
    copy: 'Our engine extracts what makes it unique.',
    icon: AudioLines,
    tone: 'green',
    iconTone: 'green',
    className: 'card-analyze',
    waveTone: 'wave-blue',
  },
  {
    id: 'match',
    title: '4. Match',
    copy: 'Find the closest samples instantly.',
    icon: Search,
    tone: 'orange',
    iconTone: 'green',
    className: 'card-match',
    waveTone: 'wave-orange',
  },
];

const featureItems = [
  {
    title: 'Search like you know the sound.',
    copy: 'Humming, recording, or upload, we handle the rest.',
    icon: Search,
    tone: 'green',
  },
  {
    title: 'Compare. Refine. Get closer.',
    copy: 'Pitch-aware matching and melodic intelligence.',
    icon: AudioLines,
    tone: 'orange',
  },
  {
    title: 'Millions of samples. One workflow.',
    copy: 'Powered by Freesound and open audio.',
    icon: Music4,
    tone: 'green',
  },
  {
    title: 'Preview. Save. Create.',
    copy: 'Real previews, instant discovery, unlimited ideas.',
    icon: Headphones,
    tone: 'orange',
  },
];

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <main className="welcome-screen welcome-reference-shell">
      <div className="reference-background" aria-hidden="true">
        <div className="reference-grid" />
        <div className="reference-aura aura-left" />
        <div className="reference-aura aura-right" />
        <div className="reference-smoke smoke-left" />
        <div className="reference-smoke smoke-right" />
        <div className="reference-sparks">
          {Array.from({ length: 26 }).map((_, index) => (
            <span
              key={index}
              style={
                {
                  '--spark-index': index,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="reference-floor-eq">
          {Array.from({ length: 38 }).map((_, index) => (
            <span
              key={index}
              style={
                {
                  '--eq-index': index,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <section className="reference-shell">
        <header className="reference-header">
          <div className="reference-brand">
            <BrandLogo />
            <div>
              <strong>Voice 2 Sample</strong>
              <small>Music Sample Discovery</small>
            </div>
          </div>

          <div className="reference-header-actions">
            <button className="reference-workspace-button" onClick={onStart}>
              Open workspace
              <ArrowUpRight className="h-5 w-5" />
            </button>
          </div>
        </header>

        <section className="reference-hero">
          <div className="reference-copy">
            <div className="reference-badge">
              <Sparkles className="h-4 w-4" />
              Freesound-powered musical search
            </div>

            <h1>
              Find the <span className="gradient-green">right sample</span>
              <br />
              from a single
              <br />
              <span className="gradient-orange">sound.</span>
            </h1>

            <p>
              Record, trim, and search millions of samples from Freesound. Fast, accurate, and
              musical.
            </p>

            <div className="reference-cta-row">
              <button className="reference-primary-cta" onClick={onStart}>
                Open workspace
                <ArrowUpRight className="h-5 w-5" />
              </button>

              <div className="reference-account-pill">
                <Headphones className="h-5 w-5" />
                <span>Use a Freesound account to preview and save results.</span>
              </div>
            </div>

            <div className="reference-chip-row">
              <span>
                <Mic className="h-4 w-4" />
                Live input
              </span>
              <span>
                <Disc3 className="h-4 w-4" />
                Acoustic Search + CLAP
              </span>
              <span>
                <Sparkles className="h-4 w-4" />
                Real previews
              </span>
            </div>
          </div>

          <div className="reference-engine-stage" aria-hidden="true">
            <svg className="reference-links" viewBox="0 0 760 620" preserveAspectRatio="none">
              <path d="M158 184 C250 156, 274 178, 338 250" />
              <path d="M172 422 C246 394, 266 390, 336 350" />
              <path d="M595 176 C544 184, 502 210, 426 250" />
              <path d="M600 426 C526 408, 490 394, 424 350" />
            </svg>

            <AudioOrbVisualizer />

            {floatingCards.map(({ id, title, copy, icon: Icon, tone, iconTone, className, waveTone }) => (
              <article key={id} className={`reference-floating-card ${className} ${tone}`}>
                <div className={`reference-card-icon ${iconTone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <strong>{title}</strong>
                <p>{copy}</p>
                <div className={`reference-card-wave ${waveTone}`}>
                  {Array.from({ length: 14 }).map((_, index) => (
                    <span key={index} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="reference-features" id="discover">
          {featureItems.map(({ title, copy, icon: Icon, tone }) => (
            <article key={title} className={`reference-feature ${tone}`}>
              <div className="reference-feature-icon">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <strong>{title}</strong>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
