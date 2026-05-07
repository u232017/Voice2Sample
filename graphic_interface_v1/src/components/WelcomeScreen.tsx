import { AudioWaveform, Headphones, Sparkles } from 'lucide-react';
import { FallingNotesBackground } from './FallingNotesBackground';
import { BrandLogo } from './BrandLogo';

interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <main className="welcome-screen">
      <div className="welcome-noise" aria-hidden="true" />
      <div className="welcome-orb amber" aria-hidden="true" />
      <div className="welcome-orb mint" aria-hidden="true" />
      <FallingNotesBackground />

      <section className="welcome-shell">
        <div className="welcome-copy">
          <div className="welcome-brand">
            <BrandLogo />
            <div>
              <strong>Voice to Sample</strong>
              <small>SonicMatch sound discovery</small>
            </div>
          </div>

          <div className="welcome-badge">
            <Sparkles className="h-4 w-4" />
            Powered by real Freesound previews
          </div>

          <h1>Discover the perfect sound</h1>
          <p>
            Record or upload a sound, trim the moment that matters, and explore related sounds
            from Freesound in a focused audio dashboard.
          </p>

          <div className="welcome-actions">
            <button className="welcome-start-button" onClick={onStart}>
              Start discovering
              <AudioWaveform className="h-5 w-5" />
            </button>
            <div className="welcome-account-note">
              <Headphones className="h-5 w-5" />
              <span>A Freesound account is required to use sound recommendations.</span>
            </div>
          </div>
        </div>

        <div className="welcome-visual" aria-hidden="true">
          <div className="welcome-disc">
            <div className="welcome-disc-rings" />
            <div className="welcome-logo-stage">
              <BrandLogo variant="hero" />
            </div>
          </div>
          <div className="welcome-wave-card">
            <div className="voice-sample-mark">
              <span />
              <span />
              <span />
            </div>
            <p>Voice to Sample</p>
            <small>Record. Trim. Discover.</small>
          </div>
        </div>
      </section>
    </main>
  );
}
