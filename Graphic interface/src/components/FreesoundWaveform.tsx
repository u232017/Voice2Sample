import { useEffect, useState } from 'react';

interface FreesoundWaveformProps {
  isPlaying?: boolean;
  duration?: string;
  progress?: number;
  height?: string;
  waveformImageUrl?: string;
  audioUrl?: string;
  useGenerated?: boolean;
}

export function FreesoundWaveform({
  isPlaying = false,
  duration = "0:00",
  progress = 0,
  height = "h-24",
  waveformImageUrl,
  audioUrl,
  useGenerated = true,
}: FreesoundWaveformProps) {
  const [waveData, setWaveData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!useGenerated && audioUrl && !waveformImageUrl) {
      loadWaveformData();
    }
  }, [audioUrl, useGenerated, waveformImageUrl]);

  const loadWaveformData = async () => {
    if (!audioUrl) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const samples = 100;
      const blockSize = Math.floor(rawData.length / samples);
      const data: number[] = [];

      for (let i = 0; i < samples; i++) {
        let max = 0;
        for (let j = 0; j < blockSize; j++) {
          max = Math.max(max, Math.abs(rawData[i * blockSize + j]));
        }
        data.push((max / 1) * 100);
      }

      const maxVal = Math.max(...data);
      const normalized = data.map(v => (v / maxVal) * 100);
      setWaveData(normalized);
    } catch (error) {
      console.error('Error loading waveform data:', error);
      setWaveData([]);
    } finally {
      setIsLoading(true);
    }
  };

  // If waveform image URL is provided, show it as background
  if (waveformImageUrl) {
    return (
      <div className={`relative rounded-lg overflow-hidden ${height}`} style={{
        background: `url('${waveformImageUrl}') center / cover no-repeat`,
        backgroundSize: 'contain',
        backgroundColor: '#0a0a0a',
      }}>
        <div className="absolute bottom-1 right-2 px-2 py-0.5 rounded text-xs font-mono" style={{
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#f5d442',
        }}>
          {duration}
        </div>
      </div>
    );
  }

  // Generated waveform visualization
  const displayData = waveData.length > 0 ? waveData : Array.from({ length: 100 }).map((_, i) => 
    Math.sin(i * 0.15) * 35 + Math.random() * 25 + 40
  );

  return (
    <div className={`relative rounded-lg overflow-hidden ${height}`} style={{ background: '#0a0a0a' }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            Loading...
          </div>
        </div>
      )}
      <div className="absolute inset-0 flex items-center px-2">
        {displayData.map((value, i) => {
          const waveHeight = value;
          const rmsHeight = waveHeight * 0.7;
          const isPlayed = (i / displayData.length) <= progress;

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
