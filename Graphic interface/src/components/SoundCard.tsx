import React, { useRef, useState } from 'react';
import { ExternalLink, MessageSquare, Play, Star, Tag } from 'lucide-react';
import { FreesoundSound } from '../services/types';
import { freesoundAPI } from '../services/freesound';
import { audioService } from '../services/audio';

interface SoundCardProps {
  sound: FreesoundSound;
}

const formatDate = (date?: string) => {
  if (!date) return 'Unknown date';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(
    new Date(date)
  );
};

const cleanDescription = (description?: string) => {
  if (!description?.trim()) return 'Real Freesound result. Open the original page for full details.';
  return description.replace(/<[^>]+>/g, '').trim();
};

export const SoundCard: React.FC<SoundCardProps> = ({ sound }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewUrl = freesoundAPI.getPreviewUrl(sound);
  const waveformUrl = freesoundAPI.getWaveformUrl(sound);
  const owner = sound.owner?.username || sound.username || 'Freesound user';
  const tags = sound.tags || [];

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
    <article className="freesound-row">
      <div className="result-waveform">
        {waveformUrl ? (
          <img src={waveformUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="mini-wave h-full" aria-hidden="true">
            {Array.from({ length: 26 }).map((_, index) => (
              <span key={index} style={{ height: `${24 + ((index * 17) % 68)}%` }} />
            ))}
          </div>
        )}
        <button
          className="wave-play"
          onClick={togglePreview}
          disabled={!previewUrl}
          aria-label={`Play ${sound.name}`}
        >
          <Play className={`h-5 w-5 ${isPlaying ? 'fill-current' : ''}`} />
        </button>
        <span className="wave-duration">{audioService.formatPreciseDuration(sound.duration || 0)}</span>
        {previewUrl && (
          <audio
            ref={audioRef}
            src={previewUrl}
            preload="none"
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        )}
      </div>

      <div className="result-main">
        <div>
          <h3 className="text-xl font-bold leading-snug text-white">{sound.name}</h3>
          <p className="mt-1 text-sm text-slate-300">
            by <span className="font-semibold text-cyan-100">{owner}</span> · {formatDate(sound.created)}
          </p>
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-slate-300">{cleanDescription(sound.description)}</p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 7).map((tag) => (
              <span key={tag} className="tag-pill">
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <aside className="result-meta">
        <div className="meta-grid">
          <div>
            <span>Rating</span>
            <strong>
              <Star className="h-4 w-4" />
              {typeof sound.avg_rating === 'number' ? sound.avg_rating.toFixed(1) : 'n/a'}
            </strong>
          </div>
          <div>
            <span>Ratings</span>
            <strong>{sound.num_ratings ?? 'n/a'}</strong>
          </div>
          <div>
            <span>Downloads</span>
            <strong>{sound.num_downloads ?? 'n/a'}</strong>
          </div>
          <div>
            <span>Comments</span>
            <strong>
              <MessageSquare className="h-4 w-4" />
              {sound.num_comments ?? 'n/a'}
            </strong>
          </div>
        </div>

        <p className="line-clamp-2 text-xs leading-5 text-slate-400">{sound.license || 'License not provided'}</p>

        <a
          href={sound.url || `https://freesound.org/s/${sound.id}/`}
          target="_blank"
          rel="noreferrer"
          className="card-link"
        >
          View on Freesound
          <ExternalLink className="h-4 w-4" />
        </a>
      </aside>
    </article>
  );
};
