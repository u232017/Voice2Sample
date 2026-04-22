import { useState } from "react";
import { Play, Pause, RotateCcw, Upload, Mic } from "lucide-react";
import { FreesoundWaveform } from "./FreesoundWaveform";

interface RecordUploadProps {
  onAnalyze: () => void;
}

export function RecordUpload({ onAnalyze }: RecordUploadProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="min-h-[calc(100vh-89px)] flex items-center justify-center px-8 py-12 relative overflow-hidden">
      {/* Elegant gradient background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #0f0f1e 0%, #1a0a2e 50%, #0f1a1f 100%)',
      }}></div>

      {/* Subtle animated grid background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(90deg, rgba(245, 212, 66, 0.1) 1px, transparent 1px), linear-gradient(180deg, rgba(245, 212, 66, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}></div>
      </div>

      {/* Floating shapes */}
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full opacity-5" style={{
        background: 'radial-gradient(circle, #f5d442 0%, transparent 70%)',
        filter: 'blur(40px)',
      }}></div>

      <div className="relative z-10 max-w-4xl w-full">
        {/* Audio Preview Panel */}
        <div className="rounded-3xl p-10 mb-8 backdrop-blur-md" style={{
          background: 'linear-gradient(135deg, rgba(245, 212, 66, 0.08) 0%, rgba(245, 212, 66, 0.02) 100%)',
          border: '2px solid rgba(245, 212, 66, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(245, 212, 66, 0.1)',
        }}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-110" style={{
              background: 'linear-gradient(135deg, #f5d442, #f5a742)',
              boxShadow: '0 8px 24px rgba(245, 212, 66, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
            }}>
              <Mic className="w-7 h-7" style={{ color: '#0a0a0a' }} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Audio Preview</h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Recorded audio sample
              </p>
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="mb-8">
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
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #f5d442, #f5a742)',
                boxShadow: '0 8px 24px rgba(245, 212, 66, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
              }}
            >
              {isPlaying ? <Pause className="w-7 h-7" style={{ color: '#0a0a0a' }} /> : <Play className="w-7 h-7 ml-1" style={{ color: '#0a0a0a' }} />}
            </button>

            <button className="px-8 h-16 rounded-2xl flex items-center gap-3 transition-all duration-300 group hover:scale-105" style={{
              border: '2px solid rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 0.8)',
              background: 'rgba(255, 255, 255, 0.05)',
            }}>
              <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
              Re-record
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-5 mb-10">
          <div className="rounded-2xl p-5 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:-translate-y-1" style={{
            background: 'linear-gradient(135deg, rgba(245, 212, 66, 0.12) 0%, rgba(245, 212, 66, 0.02) 100%)',
            border: '2px solid rgba(245, 212, 66, 0.25)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}>
            <p className="text-xs font-medium mb-2 tracking-wide" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>DURATION</p>
            <p className="text-2xl font-bold" style={{ color: '#f5d442' }}>3:08</p>
          </div>
          <div className="rounded-2xl p-5 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:-translate-y-1" style={{
            background: 'linear-gradient(135deg, rgba(245, 167, 66, 0.12) 0%, rgba(245, 167, 66, 0.02) 100%)',
            border: '2px solid rgba(245, 167, 66, 0.25)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}>
            <p className="text-xs font-medium mb-2 tracking-wide" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>SAMPLE RATE</p>
            <p className="text-2xl font-bold" style={{ color: '#f5a742' }}>44.1 kHz</p>
          </div>
          <div className="rounded-2xl p-5 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:-translate-y-1" style={{
            background: 'linear-gradient(135deg, rgba(136, 212, 66, 0.12) 0%, rgba(136, 212, 66, 0.02) 100%)',
            border: '2px solid rgba(136, 212, 66, 0.25)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}>
            <p className="text-xs font-medium mb-2 tracking-wide" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>BIT DEPTH</p>
            <p className="text-2xl font-bold" style={{ color: '#88d442' }}>24-bit</p>
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={onAnalyze}
          className="w-full py-6 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 group shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #f5d442 0%, #88d442 100%)',
            boxShadow: '0 12px 36px rgba(245, 212, 66, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
            color: '#0a0a0a',
          }}
        >
          <span className="flex items-center justify-center gap-2">
            ✨ Analyze & Find Similar Sounds
          </span>
        </button>
      </div>
    </div>
  );
}
