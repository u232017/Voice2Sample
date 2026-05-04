import { useState } from "react";
import { Play, Pause, RotateCcw, Upload, Mic } from "lucide-react";
import { FreesoundWaveform } from "./FreesoundWaveform";

interface RecordUploadProps {
  onAnalyze: () => void;
}

export function RecordUpload({ onAnalyze }: RecordUploadProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="min-h-[calc(100vh-89px)] flex items-center justify-center px-8 py-12" style={{ background: '#0a0a0a' }}>
      <div className="max-w-4xl w-full">
        {/* Audio Preview Panel */}
        <div className="rounded-2xl p-8 mb-6" style={{
          background: '#1a1a1a',
          border: '2px solid rgba(245, 212, 66, 0.2)',
        }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #f5d442, #f5a742)',
              boxShadow: '0 4px 16px rgba(245, 212, 66, 0.4)',
            }}>
              <Mic className="w-6 h-6" style={{ color: '#0a0a0a' }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Audio Preview</h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Recorded audio sample
              </p>
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="mb-6">
            <FreesoundWaveform
              isPlaying={isPlaying}
              duration="3:08"
              progress={isPlaying ? 0.3 : 0}
              height="h-32"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{
                background: 'linear-gradient(135deg, #f5d442, #f5a742)',
                boxShadow: '0 4px 20px rgba(245, 212, 66, 0.4)',
              }}
            >
              {isPlaying ? <Pause className="w-6 h-6" style={{ color: '#0a0a0a' }} /> : <Play className="w-6 h-6 ml-1" style={{ color: '#0a0a0a' }} />}
            </button>

            <button className="px-6 h-14 rounded-xl flex items-center gap-2 transition-all hover:bg-white/5" style={{
              border: '2px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.8)',
            }}>
              <RotateCcw className="w-5 h-5" />
              Re-record
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl p-4" style={{ background: 'rgba(245, 212, 66, 0.08)', border: '1px solid rgba(245, 212, 66, 0.2)' }}>
            <p className="text-sm mb-1" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Duration</p>
            <p className="text-xl font-bold" style={{ color: '#f5d442' }}>3:08</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(245, 167, 66, 0.08)', border: '1px solid rgba(245, 167, 66, 0.2)' }}>
            <p className="text-sm mb-1" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Sample Rate</p>
            <p className="text-xl font-bold" style={{ color: '#f5a742' }}>44.1 kHz</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(136, 212, 66, 0.08)', border: '1px solid rgba(136, 212, 66, 0.2)' }}>
            <p className="text-sm mb-1" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Bit Depth</p>
            <p className="text-xl font-bold" style={{ color: '#88d442' }}>24-bit</p>
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={onAnalyze}
          className="w-full py-5 rounded-xl font-bold text-lg transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #f5d442 0%, #88d442 100%)',
            boxShadow: '0 8px 32px rgba(245, 212, 66, 0.4)',
            color: '#0a0a0a',
          }}
        >
          Analyze & Find Similar Sounds
        </button>
      </div>
    </div>
  );
}
