import React, { useRef, useState } from 'react';
import { MessageCircle, Play, Star } from 'lucide-react';
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
      className="compact-result-card"
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
        <button onClick={togglePreview} disabled={!previewUrl} className="compact-play-button" aria-label={`Play ${sound.name}`}>
          <Play className={`h-4 w-4 ${isPlaying ? 'fill-current' : ''}`} />
        </button>
        <span>{audioService.formatPreciseDuration(sound.duration || 0)}</span>
      </div>

      <div className="compact-result-body">
        <div className="compact-result-title">
          <h3>{sound.name}</h3>
          <p>{owner}</p>
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
          <span>{sound.num_downloads ?? 0} downloads</span>
          <span>
            <MessageCircle className="h-3.5 w-3.5" />
            {sound.num_comments ?? 0}
          </span>
        </div>
        <p className="compact-license">{sound.license || 'License not provided'}</p>
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
