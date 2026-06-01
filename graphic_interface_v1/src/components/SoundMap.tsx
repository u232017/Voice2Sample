import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AudioLines, Map, Pause, Play, X } from 'lucide-react';
import { audioService } from '../services/audio';
import {
  CombinedSoundMapPoint,
  CombinedSoundMapResponse,
  SimilarityFocus,
  SoundMapFilter,
} from '../services/types';

interface SoundMapProps {
  data: CombinedSoundMapResponse;
  isLoading: boolean;
  onClose: () => void;
}

interface PositionedSound {
  sound: CombinedSoundMapPoint;
  x: number;
  y: number;
  colour: string;
  pointSize: number;
  opacity: number;
}

interface FocusSimilarityStats {
  best: number;
  worst: number;
  spread: number;
}

const filterOptions: Array<{
  value: SoundMapFilter;
  label: string;
  description: string;
}> = [
  {
    value: 'all',
    label: 'All',
    description: '200 combined results',
  },
  {
    value: 'general',
    label: 'General',
    description: '50 global acoustic matches',
  },
  {
    value: 'melodic',
    label: 'Melodic',
    description: '50 melodic matches',
  },
  {
    value: 'bpm',
    label: 'BPM',
    description: '50 rhythm and tempo matches',
  },
  {
    value: 'timbre',
    label: 'Timbre',
    description: '50 spectral colour matches',
  },
];

const focusLabels: Record<SimilarityFocus, string> = {
  general: 'General',
  melodic: 'Melodic',
  bpm: 'BPM',
  timbre: 'Timbre',
};

const focusColours: Record<SimilarityFocus, string> = {
  general: '#00e7ff',
  melodic: '#ff2bd6',
  bpm: '#ff3030',
  timbre: '#55ff38',
};

const focusSoftColours: Record<SimilarityFocus, string> = {
  general: 'rgba(0, 231, 255, 0.36)',
  melodic: 'rgba(255, 43, 214, 0.36)',
  bpm: 'rgba(255, 48, 48, 0.36)',
  timbre: 'rgba(85, 255, 56, 0.36)',
};

const focusOrder: SimilarityFocus[] = [
  'general',
  'melodic',
  'bpm',
  'timbre',
];

const MIN_VISUAL_RADIUS = 7;
const MAX_VISUAL_RADIUS = 45;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getPreviewUrl = (sound: CombinedSoundMapPoint) =>
  sound.previews?.['preview-hq-mp3'] ||
  sound.previews?.['preview-lq-mp3'];

const getSimilarityValue = (sound: CombinedSoundMapPoint) =>
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

const clampMapPosition = (value: number) => {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(4, Math.min(96, value));
};

const pseudoRandomUnit = (seed: string) => {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  const value = Math.sin(hash * 12.9898) * 43758.5453123;

  return value - Math.floor(value);
};

const getFilterLabel = (filter: SoundMapFilter) => {
  if (filter === 'all') {
    return 'All';
  }

  return focusLabels[filter];
};

const createFocusStats = (
  sounds: CombinedSoundMapPoint[]
): Record<SimilarityFocus, FocusSimilarityStats> => {
  return focusOrder.reduce((accumulator, focus) => {
    const focusSounds = sounds.filter((sound) => sound.focus === focus);
    const similarities = focusSounds.map(getSimilarityValue);

    const best = similarities.length ? Math.max(...similarities) : 1;
    const worst = similarities.length ? Math.min(...similarities) : 0;

    accumulator[focus] = {
      best,
      worst,
      spread: Math.max(best - worst, 0.000001),
    };

    return accumulator;
  }, {} as Record<SimilarityFocus, FocusSimilarityStats>);
};

const getBackendDirectionAngle = (sound: CombinedSoundMapPoint) => {
  const baseX = Number.isFinite(sound.x) ? sound.x * 100 : 50;
  const baseY = Number.isFinite(sound.y) ? sound.y * 100 : 50;
  const deltaX = baseX - 50;
  const deltaY = baseY - 50;
  const length = Math.hypot(deltaX, deltaY);

  if (length > 0.5) {
    return Math.atan2(deltaY, deltaX);
  }

  return pseudoRandomUnit(`${sound.mapKey}-fallback-angle`) * Math.PI * 2;
};

const getSimilarityRadius = (
  sound: CombinedSoundMapPoint,
  stats: FocusSimilarityStats
) => {
  const similarity = getSimilarityValue(sound);

  const normalizedBySimilarity =
    (similarity - stats.worst) / stats.spread;

  const normalizedByRank =
    1 - (sound.rank - 1) / Math.max(sound.groupCount - 1, 1);

  const normalized = clamp(
    Number.isFinite(normalizedBySimilarity)
      ? normalizedBySimilarity
      : normalizedByRank,
    0,
    1
  );

  return (
    MIN_VISUAL_RADIUS +
    (1 - normalized) * (MAX_VISUAL_RADIUS - MIN_VISUAL_RADIUS)
  );
};

export function SoundMap({ data, isLoading, onClose }: SoundMapProps) {
  const [activeFilter, setActiveFilter] = useState<SoundMapFilter>('all');
  const [selectedPoint, setSelectedPoint] =
    useState<CombinedSoundMapPoint | null>(data.results[0] ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const focusStats = useMemo(
    () => createFocusStats(data.results),
    [data.results]
  );

  const visibleResults = useMemo(() => {
    const filtered =
      activeFilter === 'all'
        ? data.results
        : data.results.filter((sound) => sound.focus === activeFilter);

    return [...filtered].sort((first, second) => {
      if (first.focus !== second.focus) {
        return focusOrder.indexOf(first.focus) - focusOrder.indexOf(second.focus);
      }

      return first.rank - second.rank;
    });
  }, [activeFilter, data.results]);

  const positionedSounds = useMemo<PositionedSound[]>(() => {
    if (!visibleResults.length) {
      return [];
    }

    return visibleResults.map((sound) => {
      const stats = focusStats[sound.focus];
      const radius = getSimilarityRadius(sound, stats);

      /*
        The backend coordinates are used only to preserve the Audio Atlas style
        direction of the cloud. The actual distance from the input is controlled
        by the similarity percentage inside each comparison mode.
      */
      const angle =
        getBackendDirectionAngle(sound) +
        (pseudoRandomUnit(`${sound.mapKey}-angle`) - 0.5) * 0.18;

      const normalizedCloseness = clamp(
        1 -
          (radius - MIN_VISUAL_RADIUS) /
            Math.max(MAX_VISUAL_RADIUS - MIN_VISUAL_RADIUS, 0.000001),
        0,
        1
      );

      return {
        sound,
        x: clampMapPosition(50 + Math.cos(angle) * radius),
        y: clampMapPosition(50 + Math.sin(angle) * radius),
        colour: focusColours[sound.focus],
        pointSize:
          sound.rank <= 4
            ? 21 - Math.min(sound.rank, 3) * 1.4
            : 8.5 + normalizedCloseness * 6.5,
        opacity: 0.72 + normalizedCloseness * 0.24,
      };
    });
  }, [focusStats, visibleResults]);

  useEffect(() => {
    if (!visibleResults.length) {
      setSelectedPoint(null);
      setIsPlaying(false);
      return;
    }

    const currentSelectionStillVisible =
      selectedPoint &&
      visibleResults.some((sound) => sound.mapKey === selectedPoint.mapKey);

    if (!currentSelectionStillVisible) {
      setSelectedPoint(visibleResults[0]);
      setIsPlaying(false);
    }
  }, [selectedPoint, visibleResults]);

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
    ? positionedSounds.find(
        (point) => point.sound.mapKey === selectedPoint.mapKey
      )
    : null;

  const selectedPreviewUrl = selectedPoint
    ? getPreviewUrl(selectedPoint)
    : undefined;

  const selectedTags = selectedPoint?.tags?.slice(0, 4) ?? [];

  const activeDescription =
    filterOptions.find((option) => option.value === activeFilter)
      ?.description || 'combined results';

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
      className={`sound-map-card map-filter-${activeFilter}`}
      aria-label="Audio similarity map"
    >
      <header className="sound-map-header">
        <div>
          <p className="sound-map-kicker">Dataset exploration</p>
          <h2>Audio Similarity Map</h2>

          <p className="sound-map-description">
            This map combines 200 real matches: 50 by General, 50 by Melodic,
            50 by BPM and 50 by Timbre. Colours identify the comparison mode,
            and each point is placed closer to your input when its match
            percentage is higher within that mode.
          </p>
        </div>

        <div className="sound-map-header-actions">
          <span className="sound-map-pill real">
            {data.count} real matches
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
          <p>Show results by</p>
          <span>
            Current view: {getFilterLabel(activeFilter)} - {activeDescription}.
          </span>
        </div>

        <div
          className="sound-map-focus-switch"
          role="group"
          aria-label="Map result filter"
        >
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={activeFilter === option.value ? 'active' : ''}
              onClick={() => setActiveFilter(option.value)}
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
          aria-label={`Map showing ${visibleResults.length} sounds for ${getFilterLabel(activeFilter)}`}
        >
          <div className="atlas-cloud-grid" />
          <div className="atlas-cloud-wash wash-one" />
          <div className="atlas-cloud-wash wash-two" />
          <div className="atlas-cloud-wash wash-three" />

          <div className="atlas-map-note">
            {visibleResults.length} visible points
          </div>

          <div className="sound-map-input-ring">
            <span>Your input</span>
          </div>

          {positionedSounds.map(({ sound, x, y, colour, pointSize, opacity }) => {
            const style = {
              left: `${x}%`,
              top: `${y}%`,
              width: `${pointSize}px`,
              height: `${pointSize}px`,
              opacity,
              backgroundColor: colour,
              color: colour,
              '--point-soft-colour': focusSoftColours[sound.focus],
            } as CSSProperties;

            return (
              <button
                key={sound.mapKey}
                type="button"
                className={`sound-map-point atlas-point ${
                  selectedPoint?.mapKey === sound.mapKey ? 'selected' : ''
                } ${sound.rank <= 4 ? 'top-result' : ''}`}
                style={style}
                onClick={() => setSelectedPoint(sound)}
                aria-label={`${sound.name}, ${sound.focusLabel}, rank ${sound.rank}, acoustic match ${formatSimilarity(
                  sound.similarity
                )}`}
                title={`${sound.name} - ${sound.focusLabel} #${sound.rank} - ${formatSimilarity(
                  sound.similarity
                )} match`}
              >
                {sound.rank <= 4 && (
                  <b className="sound-map-rank-marker">
                    {sound.focusLabel[0]}#{sound.rank}
                  </b>
                )}

                <span className="sound-map-tooltip">
                  <strong>{sound.name}</strong>
                  <small>
                    {sound.focusLabel} #{sound.rank} -{' '}
                    {formatSimilarity(sound.similarity)} match
                  </small>
                </span>
              </button>
            );
          })}

          {isLoading && (
            <div className="sound-map-loading-overlay">
              Building combined similarity map...
            </div>
          )}

          <div className="sound-map-legend">
            <span>
              <i className="legend-input" />
              Your input
            </span>

            <span>
              <i className="legend-general" />
              General
            </span>

            <span>
              <i className="legend-melodic" />
              Melodic
            </span>

            <span>
              <i className="legend-bpm" />
              BPM
            </span>

            <span>
              <i className="legend-timbre" />
              Timbre
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
                    backgroundColor:
                      selectedPosition?.colour || focusColours[selectedPoint.focus],
                    color:
                      selectedPosition?.colour || focusColours[selectedPoint.focus],
                  }}
                />

                <span className="selected-criterion-pill">
                  Compared by {selectedPoint.focusLabel}
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
                    #{selectedPoint.rank} of {selectedPoint.groupCount}
                  </strong>
                </div>

                <div>
                  <span>Visible mode</span>
                  <strong>{getFilterLabel(activeFilter)}</strong>
                </div>

                {formatBpm(selectedPoint.bpm) && (
                  <div>
                    <span>BPM</span>
                    <strong>{formatBpm(selectedPoint.bpm)}</strong>
                  </div>
                )}

                <div>
                  <span>Duration</span>
                  <strong>
                    {audioService.formatPreciseDuration(
                      selectedPoint.duration || 0
                    )}
                  </strong>
                </div>
              </div>

              {selectedTags.length > 0 && (
                <div className="selected-sound-tags">
                  {selectedTags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}

              <p className="sound-map-score-note">
                A point represents one ranking entry, not only one audio file.
                The same sample can appear several times when it is close to
                the input according to different comparison criteria. Within
                each criterion, higher percentages are always placed closer to
                your input.
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