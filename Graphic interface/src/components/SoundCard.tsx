import React, { useRef, useState } from 'react';
import { ExternalLink, Play, Star } from 'lucide-react';
import { FreesoundSound } from '../services/types';
import { freesoundAPI } from '../services/freesound';
import { audioService } from '../services/audio';

interface SoundCardProps {
  sound: FreesoundSound;
}

export const SoundCard: React.FC<SoundCardProps> = ({ sound }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewUrl = freesoundAPI.getPreviewUrl(sound);
  const waveformUrl = freesoundAPI.getWaveformUrl(sound);
  const owner = sound.owner?.username || sound.username || 'Freesound user';
  const tag = sound.tags?.[0];

  const togglePreview = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  return (
    <article className="sound-result-card">
      <header className="sound-result-head">
        <div>
          <h3>{sound.name}</h3>
          <p>by {owner}</p>
        </div>
        {tag && <span className="sound-result-tag">{tag}</span>}
      </header>

      <div className="sound-result-wave">
        {waveformUrl ? (
          <img src={waveformUrl} alt="" />
        ) : (
          <div className="sound-result-placeholder" aria-hidden="true">
            {Array.from({ length: 22 }).map((_, index) => (
              <span key={index} style={{ height: `${22 + ((index * 19) % 64)}%` }} />
            ))}
          </div>
        )}
        <span>{audioService.formatPreciseDuration(sound.duration || 0)}</span>
      </div>

      <div className="sound-result-stats">
        <span>
          <Star className="h-4 w-4" />
          {typeof sound.avg_rating === 'number' ? sound.avg_rating.toFixed(1) : 'n/a'}
        </span>
        <span>{sound.num_downloads ?? 'n/a'} downloads</span>
        <span>{sound.license || 'License n/a'}</span>
      </div>

      <footer className="sound-result-actions">
        <button onClick={togglePreview} disabled={!previewUrl} className="sound-play-button">
          <Play className={`h-5 w-5 ${isPlaying ? 'fill-current' : ''}`} />
        </button>
        <a
          href={sound.url || `https://freesound.org/s/${sound.id}/`}
          target="_blank"
          rel="noreferrer"
          className="sound-open-button"
        >
          View on Freesound
          <ExternalLink className="h-4 w-4" />
        </a>
      </footer>

      {previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          preload="none"
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}
    </article>
  );
};
