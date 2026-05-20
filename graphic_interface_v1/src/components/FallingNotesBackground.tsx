import type { CSSProperties } from 'react';

const notes = ['♪', '♫', '♬', '♩'];

const noteLayers = [
  { left: 4, delay: -1.2, duration: 14, size: 22, drift: -18, blur: 0.8, opacity: 0.22, symbol: 0 },
  { left: 10, delay: -7.4, duration: 18, size: 34, drift: 24, blur: 0, opacity: 0.28, symbol: 1 },
  { left: 16, delay: -3.5, duration: 16, size: 18, drift: 14, blur: 1.4, opacity: 0.18, symbol: 3 },
  { left: 23, delay: -11.2, duration: 21, size: 42, drift: -28, blur: 0.3, opacity: 0.23, symbol: 2 },
  { left: 31, delay: -4.8, duration: 15, size: 26, drift: 20, blur: 0, opacity: 0.3, symbol: 0 },
  { left: 39, delay: -13.1, duration: 24, size: 20, drift: -18, blur: 1.8, opacity: 0.16, symbol: 1 },
  { left: 46, delay: -6.2, duration: 17, size: 38, drift: 30, blur: 0.4, opacity: 0.24, symbol: 2 },
  { left: 54, delay: -16.4, duration: 22, size: 24, drift: -22, blur: 1.1, opacity: 0.2, symbol: 3 },
  { left: 61, delay: -2.7, duration: 14, size: 30, drift: 16, blur: 0, opacity: 0.27, symbol: 1 },
  { left: 68, delay: -9.6, duration: 20, size: 44, drift: -32, blur: 0.5, opacity: 0.22, symbol: 0 },
  { left: 76, delay: -5.6, duration: 16, size: 19, drift: 18, blur: 1.7, opacity: 0.18, symbol: 2 },
  { left: 83, delay: -14.8, duration: 23, size: 32, drift: -20, blur: 0.2, opacity: 0.25, symbol: 3 },
  { left: 90, delay: -8.1, duration: 19, size: 23, drift: 26, blur: 1.2, opacity: 0.19, symbol: 0 },
  { left: 96, delay: -12.5, duration: 25, size: 36, drift: -16, blur: 0.7, opacity: 0.18, symbol: 1 },
];

export function FallingNotesBackground() {
  return (
    <div className="falling-notes-background" aria-hidden="true">
      {noteLayers.map((note, index) => (
        <span
          key={`${note.left}-${note.duration}-${index}`}
          style={{
            '--note-left': `${note.left}%`,
            '--note-delay': `${note.delay}s`,
            '--note-duration': `${note.duration}s`,
            '--note-size': `${note.size}px`,
            '--note-drift': `${note.drift}px`,
            '--note-blur': `${note.blur}px`,
            '--note-opacity': note.opacity,
          } as CSSProperties}
        >
          {notes[note.symbol]}
        </span>
      ))}
    </div>
  );
}
