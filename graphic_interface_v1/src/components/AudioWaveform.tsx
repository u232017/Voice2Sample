import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { audioService } from '../services/audio';

interface AudioWaveformProps {
  audioUrl: string;
  duration: number;
  selectedStart: number;
  selectedEnd: number;
  onRegionChange: (start: number, end: number) => void;
}

type DragMode = 'start' | 'end' | 'move' | 'new' | null;

interface WaveformBar {
  peak: number;
  tone: number;
}

interface SelectionRange {
  start: number;
  end: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function AudioWaveform({
  audioUrl,
  duration,
  selectedStart,
  selectedEnd,
  onRegionChange,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const dragModeRef = useRef<DragMode>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const regionWidthRef = useRef(0);
  const newSelectionAnchorRef = useRef(0);

  const selectionRef = useRef<SelectionRange>({
    start: selectedStart,
    end: selectedEnd,
  });

  const [bars, setBars] = useState<WaveformBar[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSelectionPlaying, setIsSelectionPlaying] = useState(false);

  const hasSelection = duration > 0 && selectedEnd > selectedStart;

  useEffect(() => {
    selectionRef.current = {
      start: selectedStart,
      end: selectedEnd,
    };
  }, [selectedStart, selectedEnd]);

  useEffect(() => {
    let isMounted = true;

    const loadWaveform = async () => {
      try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const audioBuffer = await audioService.decodeAudio(blob);
        const channel = audioBuffer.getChannelData(0);
        const samples = 220;
        const blockSize = Math.max(1, Math.floor(channel.length / samples));
        const nextPeaks: number[] = [];
        const nextTone: number[] = [];

        for (let index = 0; index < samples; index += 1) {
          let peak = 0;
          let zeroCrossings = 0;
          const start = index * blockSize;
          const end = Math.min(start + blockSize, channel.length);

          for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
            peak = Math.max(peak, Math.abs(channel[sampleIndex]));

            if (sampleIndex > start) {
              const previous = channel[sampleIndex - 1];
              const current = channel[sampleIndex];

              if (
                (previous <= 0 && current > 0) ||
                (previous >= 0 && current < 0)
              ) {
                zeroCrossings += 1;
              }
            }
          }

          nextPeaks.push(peak);
          nextTone.push(zeroCrossings / Math.max(1, end - start));
        }

        const maxPeak = Math.max(...nextPeaks, 0.001);
        const minTone = Math.min(...nextTone, 0);
        const maxTone = Math.max(...nextTone, 0.001);
        const toneRange = Math.max(0.00001, maxTone - minTone);

        if (isMounted) {
          setBars(
            nextPeaks.map((peak, index) => ({
              peak: peak / maxPeak,
              tone: clamp((nextTone[index] - minTone) / toneRange, 0, 1),
            }))
          );
        }
      } catch (error) {
        console.error('Failed to generate user waveform:', error);

        if (isMounted) {
          setBars([]);
        }
      }
    };

    loadWaveform();

    return () => {
      isMounted = false;
    };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(dpr, dpr);
    context.clearRect(0, 0, rect.width, rect.height);

    const centerY = rect.height / 2;
    const barWidth = Math.max(2, rect.width / Math.max(bars.length, 1) - 1);

    bars.forEach((bar, index) => {
      const x = (index / bars.length) * rect.width;
      const height = Math.max(4, bar.peak * rect.height * 0.82);
      const hue = 28 + bar.tone * 58;
      const topColor = `hsla(${hue}, 90%, ${58 + bar.tone * 7}%, 0.96)`;
      const bottomColor = `hsla(${hue}, 74%, ${30 + bar.tone * 10}%, 0.94)`;

      const gradient = context.createLinearGradient(
        0,
        centerY - height / 2,
        0,
        centerY + height / 2
      );

      gradient.addColorStop(0, topColor);
      gradient.addColorStop(1, bottomColor);

      context.fillStyle = gradient;
      context.globalAlpha = 0.94;
      context.fillRect(x, centerY - height / 2, barWidth, height);
    });

    if (!bars.length) {
      context.fillStyle = 'rgba(217, 249, 157, 0.2)';
      context.font = '600 13px Inter, sans-serif';
      context.textAlign = 'center';
      context.fillText('Generating waveform...', rect.width / 2, centerY);
    }
  }, [bars]);

  const minimumSelectionSize = () => Math.min(0.12, duration / 8);

  const emitRegionChange = (start: number, end: number) => {
    if (duration <= 0) return;

    const minimumSize = minimumSelectionSize();
    const safeStart = clamp(start, 0, Math.max(0, duration - minimumSize));
    const safeEnd = clamp(end, safeStart + minimumSize, duration);

    selectionRef.current = {
      start: safeStart,
      end: safeEnd,
    };

    onRegionChange(safeStart, safeEnd);
  };

  const getTimeFromClientX = (clientX: number) => {
    const wrapper = wrapperRef.current;

    if (!wrapper || duration <= 0) {
      return 0;
    }

    const rect = wrapper.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);

    return ratio * duration;
  };

  const capturePointer = (pointerId: number) => {
    const wrapper = wrapperRef.current;

    activePointerIdRef.current = pointerId;

    if (wrapper && !wrapper.hasPointerCapture(pointerId)) {
      wrapper.setPointerCapture(pointerId);
    }
  };

  const stopDragging = (pointerId?: number) => {
    const wrapper = wrapperRef.current;
    const activePointerId = pointerId ?? activePointerIdRef.current;

    if (
      wrapper &&
      activePointerId !== null &&
      wrapper.hasPointerCapture(activePointerId)
    ) {
      wrapper.releasePointerCapture(activePointerId);
    }

    activePointerIdRef.current = null;
    dragModeRef.current = null;
  };

  const beginHandleDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    mode: 'start' | 'end'
  ) => {
    if (duration <= 0) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    dragModeRef.current = mode;

    capturePointer(event.pointerId);
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const time = getTimeFromClientX(event.clientX);
    const selection = selectionRef.current;
    const regionWidth = selection.end - selection.start;
    const minimumSize = minimumSelectionSize();

    const fullSelection = regionWidth >= duration - minimumSize;

    const pointerX = event.clientX - rect.left;
    const startX = (selection.start / duration) * rect.width;
    const endX = (selection.end / duration) * rect.width;

    /*
      The previous version used a time-based tolerance. That made the
      clickable area change depending on the duration of the audio.
      A fixed pixel tolerance is more reliable for the user's cursor.
    */
    const handleTolerancePx = 22;

    const insideRegion =
      time > selection.start && time < selection.end;
    const nearStart =
      Math.abs(pointerX - startX) <= handleTolerancePx;
    const nearEnd =
      Math.abs(pointerX - endX) <= handleTolerancePx;

    if (nearStart) {
      dragModeRef.current = 'start';
    } else if (nearEnd) {
      dragModeRef.current = 'end';
    } else if (insideRegion && !fullSelection) {
      dragModeRef.current = 'move';
      dragOffsetRef.current = time - selection.start;
      regionWidthRef.current = regionWidth;
    } else {
      /*
        When the initial selection covers the complete waveform, moving
        it cannot produce any visible result. Therefore, dragging on the
        waveform creates a new selection instead of becoming a dead click.
      */
      dragModeRef.current = 'new';
      newSelectionAnchorRef.current = time;

      if (time >= duration - minimumSize) {
        emitRegionChange(duration - minimumSize, duration);
      } else {
        emitRegionChange(
          time,
          Math.min(duration, time + Math.min(1.5, duration * 0.35))
        );
      }
    }

    capturePointer(event.pointerId);
  };

  const updateDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;

    const mode = dragModeRef.current;
    if (!mode || duration <= 0) return;

    event.preventDefault();

    const time = getTimeFromClientX(event.clientX);
    const selection = selectionRef.current;
    const minimumSize = minimumSelectionSize();

    if (mode === 'start') {
      emitRegionChange(
        clamp(time, 0, selection.end - minimumSize),
        selection.end
      );
      return;
    }

    if (mode === 'end') {
      emitRegionChange(
        selection.start,
        clamp(time, selection.start + minimumSize, duration)
      );
      return;
    }

    if (mode === 'new') {
      const anchor = newSelectionAnchorRef.current;
      const start = Math.min(anchor, time);
      const end = Math.max(anchor, time);

      if (end - start < minimumSize) {
        if (time < anchor) {
          emitRegionChange(
            clamp(anchor - minimumSize, 0, duration - minimumSize),
            anchor
          );
        } else {
          emitRegionChange(
            anchor,
            clamp(anchor + minimumSize, minimumSize, duration)
          );
        }
      } else {
        emitRegionChange(start, end);
      }

      return;
    }

    const width = regionWidthRef.current;
    const start = clamp(time - dragOffsetRef.current, 0, duration - width);

    emitRegionChange(start, start + width);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;

    stopDragging(event.pointerId);
  };

  const handleLostPointerCapture = () => {
    activePointerIdRef.current = null;
    dragModeRef.current = null;
  };

  const adjustHandleWithKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    mode: 'start' | 'end'
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();

    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const step = event.shiftKey
      ? Math.max(0.1, duration * 0.01)
      : Math.max(0.02, duration * 0.002);

    const selection = selectionRef.current;
    const minimumSize = minimumSelectionSize();

    if (mode === 'start') {
      emitRegionChange(
        clamp(
          selection.start + direction * step,
          0,
          selection.end - minimumSize
        ),
        selection.end
      );
      return;
    }

    emitRegionChange(
      selection.start,
      clamp(
        selection.end + direction * step,
        selection.start + minimumSize,
        duration
      )
    );
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      setIsSelectionPlaying(false);
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const playSelection = async () => {
    const audio = audioRef.current;
    if (!audio || !hasSelection) return;

    audio.pause();
    audio.currentTime = selectedStart;
    setIsSelectionPlaying(true);
    setIsPlaying(true);

    await audio.play();
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isSelectionPlaying && audio.currentTime >= selectedEnd) {
      audio.pause();
      audio.currentTime = selectedStart;
      setIsPlaying(false);
      setIsSelectionPlaying(false);
    }
  };

  const resetRegion = () => {
    emitRegionChange(0, duration);
  };

  const left = duration ? (selectedStart / duration) * 100 : 0;
  const width = duration
    ? ((selectedEnd - selectedStart) / duration) * 100
    : 100;

  /*
    The handles are larger and positioned inside the region so they
    remain completely clickable when the selection touches the left
    or right border of the waveform.
  */
  const leftHandleStyle: CSSProperties = {
    left: '4px',
    width: '18px',
    height: '64px',
    border: 0,
    padding: 0,
    zIndex: 3,
    touchAction: 'none',
  };

  const rightHandleStyle: CSSProperties = {
    right: '4px',
    width: '18px',
    height: '64px',
    border: 0,
    padding: 0,
    zIndex: 3,
    touchAction: 'none',
  };

  return (
    <div className="waveform-trimmer">
      <div
        ref={wrapperRef}
        className="waveform-surface"
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={handleLostPointerCapture}
      >
        <canvas ref={canvasRef} />

        {hasSelection && (
          <div
            className="waveform-region"
            style={{
              left: `${left}%`,
              width: `${width}%`,
            }}
          >
            <button
              type="button"
              className="waveform-handle left"
              style={leftHandleStyle}
              aria-label="Adjust trim start"
              title="Drag to adjust trim start"
              onPointerDown={(event) => beginHandleDrag(event, 'start')}
              onKeyDown={(event) => adjustHandleWithKeyboard(event, 'start')}
            />

            <button
              type="button"
              className="waveform-handle right"
              style={rightHandleStyle}
              aria-label="Adjust trim end"
              title="Drag to adjust trim end"
              onPointerDown={(event) => beginHandleDrag(event, 'end')}
              onKeyDown={(event) => adjustHandleWithKeyboard(event, 'end')}
            />
          </div>
        )}
      </div>

      <div className="waveform-controls">
        <button onClick={togglePlayback} className="waveform-button">
          {isPlaying && !isSelectionPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isPlaying && !isSelectionPlaying ? 'Pause' : 'Play'}
        </button>

        <button
          onClick={playSelection}
          className="waveform-button"
          disabled={!hasSelection}
        >
          <Play className="h-4 w-4" />
          Play selection
        </button>

        <button
          onClick={resetRegion}
          className="waveform-button quiet"
        >
          <RotateCcw className="h-4 w-4" />
          Reset trim
        </button>

        <span className="waveform-selected-time">
          Selected: {audioService.formatPreciseDuration(selectedStart)} -{' '}
          {audioService.formatPreciseDuration(selectedEnd)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setIsSelectionPlaying(false);
        }}
      />
    </div>
  );
}
