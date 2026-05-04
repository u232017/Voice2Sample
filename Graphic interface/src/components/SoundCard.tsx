import React, { useState } from 'react';
import { Download, Play, Pause } from 'lucide-react';
import { FreesoundSound } from '../services/types';
import { freesoundAPI } from '../services/freesound';

interface SoundCardProps {
  sound: FreesoundSound;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
}

export const SoundCard: React.FC<SoundCardProps> = ({ sound, isPlaying, onPlay, onPause }) => {
  const [isHovered, setIsHovered] = useState(false);
  const previewUrl = freesoundAPI.getPreviewUrl(sound);
  const downloadUrl = freesoundAPI.getDownloadUrl(sound.id);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="bg-gradient-to-br from-freesound-darker via-freesound-dark to-freesound-darker border border-freesound-yellow/10 rounded-lg overflow-hidden hover:border-freesound-yellow/30 transition-all duration-300 hover:shadow-lg hover:shadow-freesound-yellow/20"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-freesound-yellow/10 to-freesound-orange/10 border-b border-freesound-yellow/10">
        <h3 className="font-bold text-white truncate hover:text-freesound-yellow transition-colors">
          {sound.name}
        </h3>
        <p className="text-sm text-freesound-yellow/70 truncate">by {sound.owner.username}</p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-freesound-yellow/5 p-2 rounded">
            <span className="text-freesound-yellow/60">Duration</span>
            <p className="font-semibold text-white">{formatDuration(sound.duration)}</p>
          </div>
          <div className="bg-freesound-orange/5 p-2 rounded">
            <span className="text-freesound-orange/60">Sample Rate</span>
            <p className="font-semibold text-white">{(sound.samplerate / 1000).toFixed(1)}kHz</p>
          </div>
          <div className="bg-freesound-green/5 p-2 rounded">
            <span className="text-freesound-green/60">Bitrate</span>
            <p className="font-semibold text-white">{sound.bitrate / 1000}kbps</p>
          </div>
          <div className="bg-freesound-yellow/5 p-2 rounded">
            <span className="text-freesound-yellow/60">Channels</span>
            <p className="font-semibold text-white">{sound.channels}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {sound.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 bg-freesound-orange/10 text-freesound-orange rounded-full border border-freesound-orange/20"
            >
              {tag}
            </span>
          ))}
          {sound.tags.length > 3 && (
            <span className="text-xs px-2 py-1 text-freesound-yellow/60">+{sound.tags.length - 3}</span>
          )}
        </div>

        {/* Description */}
        {sound.description && (
          <p className="text-xs text-freesound-yellow/50 line-clamp-2">{sound.description}</p>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-freesound-darker/50 border-t border-freesound-yellow/10 flex gap-2">
        {previewUrl && (
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-freesound-yellow to-freesound-orange hover:from-freesound-orange hover:to-freesound-green text-freesound-darker font-semibold py-2 rounded-lg transition-all transform hover:scale-105"
          >
            {isPlaying ? (
              <>
                <Pause size={16} /> Pausar
              </>
            ) : (
              <>
                <Play size={16} /> Escuchar
              </>
            )}
          </button>
        )}
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-freesound-green/10 hover:bg-freesound-green/20 text-freesound-green border border-freesound-green/30 font-semibold py-2 px-3 rounded-lg transition-all"
        >
          <Download size={16} />
          {isHovered && <span className="text-xs">Descargar</span>}
        </a>
      </div>
    </div>
  );
};
