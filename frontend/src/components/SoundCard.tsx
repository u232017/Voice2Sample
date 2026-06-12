import React, { useRef, useState } from 'react';
import {
  Clock3,
  ExternalLink,
  MessageCircle,
  Pause,
  Play,
  Star,
  Volume2,
} from 'lucide-react';
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
  const visualizationUrl = freesoundAPI.getVisualizationUrl(sound);
  const owner = sound.owner?.username || sound.username || 'Freesound user';
  const tags = sound.tags?.slice(0, 3) || [];
  const url = sound.url || `https://freesound.org/s/${sound.id}/`;
  const similarity =
    typeof sound.similarity === 'number' && Number.isFinite(sound.similarity)
      ? `${Math.round(sound.similarity * 100)}%`
      : null;

  const togglePreview = async (event: React.MouseEvent) => {
    event.stopPropagation();
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
    <article
      className="compact-result-card sound-card"
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      title="Open this sound on Freesound"
    >
      <div className="compact-result-wave">
        {visualizationUrl ? (
          <img src={visualizationUrl} alt={`Visualization for ${sound.name}`} />
        ) : (
          <div className="compact-wave-placeholder">
            <span>No waveform available</span>
          </div>
        )}
        <button
          onClick={togglePreview}
          disabled={!previewUrl}
          className="compact-play-button"
          aria-label={`Play ${sound.name}`}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span>{audioService.formatPreciseDuration(sound.duration || 0)}</span>
      </div>

      <div className="compact-result-body">
        <div className="sound-card-topline">
          <div className="compact-result-eyebrow">
            <span>Freesound match</span>
            <small>
              Open on Freesound
              <ExternalLink className="h-3.5 w-3.5" />
            </small>
          </div>

          <div className="sound-card-score">
            <span>{similarity ? 'Match score' : 'Preview'}</span>
            <strong>{similarity || 'Ready'}</strong>
          </div>
        </div>

        <div className="compact-result-title">
          <div>
            <h3 title={sound.name}>{sound.name}</h3>
            <p>{owner}</p>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="compact-tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}

        <div className="compact-result-meta">
          <span>
            <Star className="h-3.5 w-3.5" />
            {typeof sound.avg_rating === 'number' ? sound.avg_rating.toFixed(1) : 'n/a'}
          </span>
          <span>
            <Clock3 className="h-3.5 w-3.5" />
            {audioService.formatPreciseDuration(sound.duration || 0)}
          </span>
          <span>{sound.num_downloads ?? 0} downloads</span>
          <span>
            <MessageCircle className="h-3.5 w-3.5" />
            {sound.num_comments ?? 0}
          </span>
        </div>
        <p className="compact-license">{sound.license || 'License not provided'}</p>

        <div className="sound-card-actions">
          <button
            type="button"
            className="sound-card-preview"
            onClick={togglePreview}
            disabled={!previewUrl}
          >
            <Volume2 className="h-4 w-4" />
            {isPlaying ? 'Pause preview' : 'Play preview'}
          </button>

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="sound-card-link"
            onClick={(event) => event.stopPropagation()}
          >
            Open source
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

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
