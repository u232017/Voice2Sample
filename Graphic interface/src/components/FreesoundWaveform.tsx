interface FreesoundWaveformProps {
  isPlaying?: boolean;
  duration?: string;
  progress?: number;
  height?: string;
}

export function FreesoundWaveform({
  isPlaying = false,
  duration = "0:00",
  progress = 0,
  height = "h-24"
}: FreesoundWaveformProps) {
  return (
    <div className={`relative rounded-lg overflow-hidden ${height}`} style={{ background: '#0a0a0a' }}>
      <div className="absolute inset-0 flex items-center px-2">
        {Array.from({ length: 100 }).map((_, i) => {
          const waveHeight = Math.sin(i * 0.15) * 35 + Math.random() * 25 + 40;
          const rmsHeight = waveHeight * 0.7;
          const isPlayed = (i / 100) <= progress;

          return (
            <div key={i} className="flex-1 relative flex items-center justify-center" style={{ padding: '0 0.5px' }}>
              {/* RMS (Green layer) */}
              <div
                className="absolute transition-colors duration-150"
                style={{
                  width: '100%',
                  height: `${rmsHeight}%`,
                  background: isPlayed ? '#88d442' : '#4a5f2a',
                  borderRadius: '1px',
                }}
              />
              {/* Peak (Yellow/Orange layer) */}
              <div
                className="absolute transition-colors duration-150"
                style={{
                  width: '70%',
                  height: `${waveHeight}%`,
                  background: isPlayed
                    ? `linear-gradient(to bottom, #f5d442 0%, #f5a742 100%)`
                    : '#5a5230',
                  borderRadius: '1px',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Duration overlay */}
      <div className="absolute bottom-1 right-2 px-2 py-0.5 rounded text-xs font-mono" style={{
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#f5d442',
      }}>
        {duration}
      </div>
    </div>
  );
}
