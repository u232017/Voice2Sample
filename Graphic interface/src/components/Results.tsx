import { Play, Pause, Download, ArrowLeft, Sparkles } from "lucide-react";
import { useState } from "react";
import { FreesoundWaveform } from "./FreesoundWaveform";

const mockResults = [
  { id: 1, title: "Synth Bass Hit", category: "Bass", similarity: 94, author: "AudioMaster" },
  { id: 2, title: "Deep Sub Wobble", category: "Bass", similarity: 89, author: "SoundDesigner" },
  { id: 3, title: "808 Kick Layered", category: "Drums", similarity: 87, author: "BeatMaker" },
  { id: 4, title: "Analog Bass Pluck", category: "Bass", similarity: 85, author: "VintageSounds" },
  { id: 5, title: "Sub Drop Impact", category: "FX", similarity: 82, author: "ProducerX" },
  { id: 6, title: "Reese Bass Loop", category: "Bass", similarity: 79, author: "DNB_Creator" },
];

interface ResultsProps {
  onBack: () => void;
}

export function Results({ onBack }: ResultsProps) {
  const [playingId, setPlayingId] = useState<number | null>(null);

  return (
    <div className="min-h-[calc(100vh-89px)] px-8 py-12 relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #0f0f1e 0%, #1a0a2e 50%, #0f1a1f 100%)',
    }}>
      {/* Subtle animated grid background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(90deg, rgba(245, 212, 66, 0.1) 1px, transparent 1px), linear-gradient(180deg, rgba(245, 212, 66, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}></div>
      </div>

      {/* Floating shapes */}
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full opacity-5 pointer-events-none" style={{
        background: 'radial-gradient(circle, #f5d442 0%, transparent 70%)',
        filter: 'blur(40px)',
      }}></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 backdrop-blur-md border" style={{
              background: 'rgba(136, 212, 66, 0.08)',
              border: '1px solid rgba(136, 212, 66, 0.25)',
            }}>
              <Sparkles className="w-4 h-4" style={{ color: '#88d442' }} />
              <span className="text-sm font-medium" style={{ color: '#88d442' }}>{mockResults.length} matches found</span>
            </div>
            <h2 className="text-5xl font-bold text-white" style={{
              background: 'linear-gradient(135deg, #ffffff 0%, rgba(136, 212, 66, 0.8) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Similar Sounds</h2>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-2xl flex items-center gap-2 transition-all duration-300 group hover:scale-105 backdrop-blur-md"
            style={{
              border: '2px solid rgba(245, 212, 66, 0.25)',
              background: 'rgba(245, 212, 66, 0.08)',
              color: '#f5d442'
            }}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
        </div>

        {/* Original Sound Panel */}
        <div
          className="rounded-3xl p-8 mb-12 backdrop-blur-md transition-all duration-300 hover:-translate-y-1"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 212, 66, 0.12) 0%, rgba(245, 212, 66, 0.02) 100%)',
            border: '2px solid rgba(245, 212, 66, 0.25)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(245, 212, 66, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8 flex-1">
              <button
                onClick={() => setPlayingId(playingId === 0 ? null : 0)}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-lg flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #f5d442, #f5a742)',
                  boxShadow: '0 8px 24px rgba(245, 212, 66, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
                }}
              >
                {playingId === 0 ? <Pause className="w-7 h-7" style={{ color: '#0a0a0a' }} /> : <Play className="w-7 h-7 ml-1" style={{ color: '#0a0a0a' }} />}
              </button>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-2xl font-bold text-white">Your Original Sound</h3>
                  <span className="px-4 py-1 rounded-full text-xs font-semibold tracking-wide" style={{
                    background: 'rgba(245, 212, 66, 0.15)',
                    color: '#f5d442',
                    border: '1px solid rgba(245, 212, 66, 0.25)'
                  }}>
                    SOURCE
                  </span>
                </div>
                <FreesoundWaveform
                  isPlaying={playingId === 0}
                  duration="3:08"
                  progress={playingId === 0 ? 0.4 : 0}
                  height="h-16"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-2 gap-7">
          {mockResults.map((result, index) => (
            <div
              key={result.id}
              className="rounded-3xl p-7 group transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-2"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-yellow-400 group-hover:to-green-400 group-hover:bg-clip-text transition-all">{result.title}</h3>
                  <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    by <span className="font-medium">{result.author}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide" style={{
                    background: 'rgba(136, 212, 66, 0.15)',
                    color: '#88d442',
                    border: '1px solid rgba(136, 212, 66, 0.25)'
                  }}>
                    {result.category}
                  </span>
                </div>
              </div>

              {/* Similarity Score */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium tracking-wide" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>MATCH QUALITY</span>
                  <span className="text-2xl font-bold" style={{
                    color: '#f5d442',
                  }}>
                    {result.similarity}%
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.05)', height: '8px' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      background: 'linear-gradient(90deg, #f5d442 0%, #88d442 100%)',
                      width: `${result.similarity}%`,
                      boxShadow: '0 0 12px rgba(245, 212, 66, 0.4)',
                    }}
                  />
                </div>
              </div>

              {/* Waveform */}
              <div className="mb-6">
                <FreesoundWaveform
                  isPlaying={playingId === result.id}
                  duration={`${Math.floor(Math.random() * 10 + 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`}
                  progress={playingId === result.id ? 0.5 : 0}
                  height="h-20"
                />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPlayingId(playingId === result.id ? null : result.id)}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-md flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #f5d442, #f5a742)',
                    boxShadow: '0 6px 20px rgba(245, 212, 66, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {playingId === result.id ? <Pause className="w-5 h-5" style={{ color: '#0a0a0a' }} /> : <Play className="w-5 h-5 ml-0.5" style={{ color: '#0a0a0a' }} />}
                </button>

                <button className="flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105 group/btn backdrop-blur-sm" style={{
                  border: '2px solid rgba(136, 212, 66, 0.25)',
                  background: 'rgba(136, 212, 66, 0.08)',
                  color: '#88d442',
                }}>
                  <Download className="w-5 h-5 group-hover/btn:-translate-y-1 transition-transform" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
