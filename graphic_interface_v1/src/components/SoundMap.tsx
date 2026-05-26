import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AudioLines, Map, Pause, Play, X } from 'lucide-react';
import { audioService } from '../services/audio';
import {
  SimilarityFocus,
  SoundMapPoint,
  SoundMapResponse,
} from '../services/types';

interface SoundMapProps {
  data: SoundMapResponse;
  activeFocus: SimilarityFocus;
  isLoading: boolean;
  onFocusChange: (focus: SimilarityFocus) => void;
  onClose: () => void;
}

interface PositionedSound {
  sound: SoundMapPoint;
  rank: number;
  x: number;
  y: number;
  colour: string;
  pointSize: number;
  opacity: number;
}

const focusOptions: Array<{
  value: SimilarityFocus;
  label: string;
  description: string;
}> = [
  {
    value: 'general',
    label: 'General',
    description: 'all acoustic features',
  },
  {
    value: 'melodic',
    label: 'Melodic',
    description: 'current melodic comparison criterion',
  },
  {
    value: 'energy',
    label: 'Energy',
    description: 'energy and intensity similarity',
  },
  {
    value: 'bpm',
    label: 'BPM',
    description: 'rhythmic and tempo similarity',
  },
  {
    value: 'timbre',
    label: 'Timbre',
    description: 'spectral colour similarity',
  },
];

const focusLabels: Record<SimilarityFocus, string> = {
  general: 'General',
  melodic: 'Melodic',
  energy: 'Energy',
  bpm: 'BPM',
  timbre: 'Timbre',
};

const pointPalettes: Record<SimilarityFocus, string[]> = {
  general: [
    '#45ddff',
    '#ff48c8',
    '#a86cff',
    '#ffcc3d',
    '#43ef98',
    '#ff674d',
    '#22d8c1',
    '#ff8c32',
    '#4f88ff',
    '#f95cff',
  ],
  melodic: [
    '#49e7ff',
    '#5e94ff',
    '#b168ff',
    '#ff43c8',
    '#32e0d0',
    '#ffd34d',
    '#7c5cff',
    '#35bfff',
  ],
  energy: [
    '#dfff42',
    '#49ef91',
    '#ffc83d',
    '#ff8037',
    '#ff4e9c',
    '#22dbb5',
    '#f3ff60',
    '#ff6049',
  ],
  bpm: [
    '#ff4d49',
    '#ff8838',
    '#ffc43f',
    '#ff43a6',
    '#ef53ff',
    '#ff6545',
    '#ffe45e',
    '#ff3564',
  ],
  timbre: [
    '#b064ff',
    '#41dfff',
    '#ff4ec9',
    '#45efc4',
    '#5c83ff',
    '#ffd145',
    '#ee58ff',
    '#26cbd8',
  ],
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MIN_VISUAL_RADIUS = 6;
const MAX_VISUAL_RADIUS = 46;

const getPreviewUrl = (sound: SoundMapPoint) =>
  sound.previews?.['preview-hq-mp3'] ||
  sound.previews?.['preview-lq-mp3'];

const getSimilarityValue = (sound: SoundMapPoint) =>
  typeof sound.similarity === 'number' && Number.isFinite(sound.similarity)
    ? Math.max(0, Math.min(1, sound.similarity))
    : 0;

const formatSimilarity = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return `${(value * 100).toFixed(1)}%`;
};

const formatBpm = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value)} BPM`;
};

const pseudoRandomUnit = (seed: number) => {
  const value = Math.sin(seed * 91.73 + 18.37) * 43758.5453123;

  return value - Math.floor(value);
};

const pointColour = (
  focus: SimilarityFocus,
  sound: SoundMapPoint,
  rank: number
) => {
  const palette = pointPalettes[focus];
  const idSeed = typeof sound.id === 'number' ? sound.id : rank;
  const index = Math.floor(
    pseudoRandomUnit(idSeed + rank * 11.7) * palette.length
  );

  return palette[Math.min(index, palette.length - 1)];
};

export function SoundMap({
  data,
  activeFocus,
  isLoading,
  onFocusChange,
  onClose,
}: SoundMapProps) {
  const orderedResults = useMemo(() => {
    return data.results
      .map((sound, originalIndex) => ({
        sound,
        originalIndex,
      }))
      .sort((first, second) => {
        const scoreDifference =
          getSimilarityValue(second.sound) - getSimilarityValue(first.sound);

        if (Math.abs(scoreDifference) > 0.0000001) {
          return scoreDifference;
        }

        return first.originalIndex - second.originalIndex;
      })
      .map(({ sound }) => sound);
  }, [data.results]);

  const positionedSounds = useMemo<PositionedSound[]>(() => {
    if (!orderedResults.length) {
      return [];
    }

    const bestSimilarity = getSimilarityValue(orderedResults[0]);
    const worstSimilarity = getSimilarityValue(
      orderedResults[orderedResults.length - 1]
    );

    /*
      Radius is fully continuous: it is computed from each raw similarity
      value returned by the backend, not from categories or distance bands.

      We expand the similarity range of the 50 visible sounds to the available
      drawing area so that even small differences can be perceived.
    */
    const visibleSimilaritySpread = Math.max(
      bestSimilarity - worstSimilarity,
      0.001
    );

    const availableRadius = MAX_VISUAL_RADIUS - MIN_VISUAL_RADIUS;

    return orderedResults.map((sound, index) => {
      const similarity = getSimilarityValue(sound);
      const differenceFromBest = bestSimilarity - similarity;

      const radius =
        MIN_VISUAL_RADIUS +
        (differenceFromBest / visibleSimilaritySpread) * availableRadius;

      /*
        Angle only distributes points around the input to make the view read
        as a cloud. It does not modify similarity: distance to the centre is
        controlled only by the backend percentage.
      */
      const seed =
        typeof sound.id === 'number' ? sound.id : index * 37 + 19;
      const angularNoise = (pseudoRandomUnit(seed) - 0.5) * 0.9;
      const angle = -Math.PI / 2 + index * GOLDEN_ANGLE + angularNoise;

      const x = 50 + Math.cos(angle) * radius * 1.02;
      const y = 50 + Math.sin(angle) * radius * 0.9;

      const closeness =
        1 - differenceFromBest / visibleSimilaritySpread;

      return {
        sound,
        rank: index + 1,
        x,
        y,
        colour: pointColour(activeFocus, sound, index + 1),
        pointSize:
          index < 4
            ? 17 - index
            : 6 + Math.max(0, Math.min(1, closeness)) * 5,
        opacity:
          0.62 + Math.max(0, Math.min(1, closeness)) * 0.32,
      };
    });
  }, [activeFocus, orderedResults]);

  const [selectedPoint, setSelectedPoint] = useState<SoundMapPoint | null>(
    orderedResults[0] ?? null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSelectedPoint(orderedResults[0] ?? null);
    setIsPlaying(false);
  }, [orderedResults]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  }, [selectedPoint]);

  const selectedPosition = selectedPoint
    ? positionedSounds.find((point) => point.sound.id === selectedPoint.id)
    : null;

  const selectedRank = selectedPosition?.rank ?? null;

  const selectedPreviewUrl = selectedPoint
    ? getPreviewUrl(selectedPoint)
    : undefined;

  const selectedTags = selectedPoint?.tags?.slice(0, 4) ?? [];

  const activeDescription =
    focusOptions.find((option) => option.value === activeFocus)?.description ||
    'acoustic similarity';

  const toggleSelectedPreview = async () => {
    const audio = audioRef.current;

    if (!audio || !selectedPreviewUrl) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  return (
    <section
      className={`sound-map-card map-focus-${activeFocus}`}
      aria-label="Audio similarity map"
    >
      <header className="sound-map-header">
        <div>
          <p className="sound-map-kicker">Dataset exploration</p>
          <h2>Audio Similarity Map</h2>

          <p className="sound-map-description">
            Each coloured point is a real dataset sound. Distance is continuous:
            the higher its acoustic match percentage, the closer it appears to
            your input.
          </p>
        </div>

        <div className="sound-map-header-actions">
          <span className="sound-map-pill real">
            {data.count} real sounds
          </span>

          <button
            type="button"
            className="sound-map-close"
            onClick={onClose}
            aria-label="Close audio similarity map"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="sound-map-focus-panel">
        <div>
          <p>Compare nearest sounds by</p>
          <span>
            Current comparison: {focusLabels[activeFocus]} - {activeDescription}.
          </span>
        </div>

        <div
          className="sound-map-focus-switch"
          role="group"
          aria-label="Map comparison criterion"
        >
          {focusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={activeFocus === option.value ? 'active' : ''}
              onClick={() => onFocusChange(option.value)}
              disabled={isLoading}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sound-map-layout">
        <div
          className="sound-map-stage atlas-cloud"
          role="img"
          aria-label={`Map of ${data.count} real sounds ordered by ${focusLabels[activeFocus]} similarity`}
        >
          <div className="atlas-cloud-grid" />
          <div className="atlas-cloud-wash wash-one" />
          <div className="atlas-cloud-wash wash-two" />
          <div className="atlas-cloud-wash wash-three" />

          <div className="atlas-map-note">
            Distance from input = acoustic match percentage
          </div>

          <div className="sound-map-input-ring">
            <span>Your input</span>
          </div>

          {positionedSounds.map(
            ({ sound, rank, x, y, colour, pointSize, opacity }) => {
              const style = {
                left: `${x}%`,
                top: `${y}%`,
                width: `${pointSize}px`,
                height: `${pointSize}px`,
                opacity,
                backgroundColor: colour,
                color: colour,
              } as CSSProperties;

              return (
                <button
                  key={`${sound.id}-${rank}`}
                  type="button"
                  className={`sound-map-point atlas-point ${
                    selectedPoint?.id === sound.id ? 'selected' : ''
                  } ${rank <= 4 ? 'top-result' : ''}`}
                  style={style}
                  onClick={() => setSelectedPoint(sound)}
                  aria-label={`${sound.name}, rank ${rank}, acoustic match ${formatSimilarity(
                    sound.similarity
                  )}`}
                  title={`${sound.name} - #${rank} - ${formatSimilarity(
                    sound.similarity
                  )} match`}
                >
                  {rank <= 4 && (
                    <b className="sound-map-rank-marker">#{rank}</b>
                  )}

                  <span className="sound-map-tooltip">
                    <strong>{sound.name}</strong>
                    <small>
                      #{rank} - {formatSimilarity(sound.similarity)} match
                    </small>
                  </span>
                </button>
              );
            }
          )}

          {isLoading && (
            <div className="sound-map-loading-overlay">
              Updating {focusLabels[activeFocus]} neighbours...
            </div>
          )}

          <div className="sound-map-legend">
            <span>
              <i className="legend-input" />
              Your input
            </span>

            <span>
              <i className="legend-top" />
              Top 4 matches
            </span>

            <span>
              <i className="legend-spectrum" />
              Colour separates sounds visually
            </span>
          </div>
        </div>

        <aside className="sound-map-selected">
          <div className="selected-sound-heading">
            <Map className="h-5 w-5" />

            <div>
              <span>Selected result</span>
              <h3>{selectedPoint?.name || 'Select a sound'}</h3>
            </div>
          </div>

          {selectedPoint ? (
            <>
              <div className="selected-criterion-row">
                <span
                  className="selected-colour-chip"
                  style={{
                    backgroundColor: selectedPosition?.colour || '#45ddff',
                  }}
                />

                <span className="selected-criterion-pill">
                  Compared by {focusLabels[activeFocus]}
                </span>
              </div>

              <div className="selected-sound-stats">
                <div className="highlight-stat">
                  <span>Acoustic match</span>
                  <strong>
                    {formatSimilarity(selectedPoint.similarity)}
                  </strong>
                </div>

                <div className="highlight-stat">
                  <span>Rank</span>
                  <strong>
                    #{selectedRank} of {data.count}
                  </strong>
                </div>

                <div>
                  <span>Duration</span>
                  <strong>
                    {audioService.formatPreciseDuration(
                      selectedPoint.duration || 0
                    )}
                  </strong>
                </div>

                {formatBpm(selectedPoint.bpm) && (
                  <div>
                    <span>BPM</span>
                    <strong>{formatBpm(selectedPoint.bpm)}</strong>
                  </div>
                )}
              </div>

              {selectedTags.length > 0 && (
                <div className="selected-sound-tags">
                  {selectedTags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}

              <p className="sound-map-score-note">
                This is the similarity value returned by the current backend.
                The map uses the raw score continuously, so even small
                differences place points at different distances from your
                input.
              </p>

              <button
                type="button"
                className="primary-action sound-map-play"
                onClick={toggleSelectedPreview}
                disabled={!selectedPreviewUrl}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}

                {isPlaying ? 'Pause sample' : 'Play sample'}
              </button>

              <p className="sound-map-license">
                {selectedPoint.license || 'License not provided'}
              </p>

              {selectedPreviewUrl && (
                <audio
                  ref={audioRef}
                  src={selectedPreviewUrl}
                  preload="none"
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              )}
            </>
          ) : (
            <div className="sound-map-no-selection">
              <AudioLines className="h-6 w-6" />
              Select one point to listen to the corresponding real dataset
              sound.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}