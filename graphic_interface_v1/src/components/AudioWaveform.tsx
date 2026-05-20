import { useEffect, useRef, useState } from 'react';
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  const dragOffsetRef = useRef(0);
  const regionWidthRef = useRef(0);
  const [bars, setBars] = useState<WaveformBar[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSelectionPlaying, setIsSelectionPlaying] = useState(false);
  const hasSelection = duration > 0 && selectedEnd > selectedStart;

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
              const prev = channel[sampleIndex - 1];
              const current = channel[sampleIndex];
              if ((prev <= 0 && current > 0) || (prev >= 0 && current < 0)) {
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
          setBars(nextPeaks.map((peak, index) => ({
            peak: peak / maxPeak,
            tone: clamp((nextTone[index] - minTone) / toneRange, 0, 1),
          })));
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
      const barGradient = context.createLinearGradient(0, centerY - height / 2, 0, centerY + height / 2);
      barGradient.addColorStop(0, topColor);
      barGradient.addColorStop(1, bottomColor);

      context.fillStyle = barGradient;
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

  const getTimeFromEvent = (event: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
    const wrapper = wrapperRef.current;
    if (!wrapper || duration <= 0) return 0;
    const rect = wrapper.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    return ratio * duration;
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const time = getTimeFromEvent(event);
    const handleTolerance = Math.max(0.18, duration * 0.018);
    const insideRegion = time > selectedStart && time < selectedEnd;
    const nearStart = Math.abs(time - selectedStart) <= handleTolerance;
    const nearEnd = Math.abs(time - selectedEnd) <= handleTolerance;

    if (nearStart) {
      dragModeRef.current = 'start';
    } else if (nearEnd) {
      dragModeRef.current = 'end';
    } else if (insideRegion) {
      dragModeRef.current = 'move';
      dragOffsetRef.current = time - selectedStart;
      regionWidthRef.current = selectedEnd - selectedStart;
    } else {
      dragModeRef.current = 'new';
      onRegionChange(time, clamp(time + Math.min(1.5, duration * 0.35), 0, duration));
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const mode = dragModeRef.current;
    if (!mode || duration <= 0) return;

    const time = getTimeFromEvent(event);
    const minSize = Math.min(0.12, duration / 8);

    if (mode === 'start') {
      onRegionChange(clamp(time, 0, selectedEnd - minSize), selectedEnd);
      return;
    }

    if (mode === 'end' || mode === 'new') {
      onRegionChange(selectedStart, clamp(time, selectedStart + minSize, duration));
      return;
    }

    if (mode === 'move') {
      const width = regionWidthRef.current;
      const start = clamp(time - dragOffsetRef.current, 0, duration - width);
      onRegionChange(start, start + width);
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragModeRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
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
    onRegionChange(0, duration);
  };

  const left = duration ? (selectedStart / duration) * 100 : 0;
  const width = duration ? ((selectedEnd - selectedStart) / duration) * 100 : 100;

  return (
    <div className="waveform-trimmer">
      <div
        ref={wrapperRef}
        className="waveform-surface"
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <canvas ref={canvasRef} />
        {hasSelection && (
          <div className="waveform-region" style={{ left: `${left}%`, width: `${width}%` }}>
            <span className="waveform-handle left" />
            <span className="waveform-handle right" />
          </div>
        )}
      </div>

      <div className="waveform-controls">
        <button onClick={togglePlayback} className="waveform-button">
          {isPlaying && !isSelectionPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPlaying && !isSelectionPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={playSelection} className="waveform-button" disabled={!hasSelection}>
          <Play className="h-4 w-4" />
          Play selection
        </button>
        <button onClick={resetRegion} className="waveform-button quiet">
          <RotateCcw className="h-4 w-4" />
          Reset trim
        </button>
        <span className="waveform-selected-time">
          Selected: {audioService.formatPreciseDuration(selectedStart)} - {audioService.formatPreciseDuration(selectedEnd)}
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
