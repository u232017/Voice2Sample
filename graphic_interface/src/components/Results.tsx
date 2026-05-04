import { Play, Pause, Download, ArrowRight } from "lucide-react";
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
    <div className="min-h-[calc(100vh-89px)] px-8 py-12" style={{ background: '#0a0a0a' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold mb-2 text-white">Similar Sounds Found</h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            {mockResults.length} matches from Freesound database
          </p>
        </div>

        {/* Original Sound Panel */}
        <div
          className="rounded-2xl p-6 mb-8"
          style={{
            background: '#1a1a1a',
            border: '2px solid rgba(245, 212, 66, 0.3)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 flex-1">
              <button
                onClick={() => setPlayingId(playingId === 0 ? null : 0)}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{
                  background: 'linear-gradient(135deg, #f5d442, #f5a742)',
                  boxShadow: '0 4px 20px rgba(245, 212, 66, 0.4)',
                }}
              >
                {playingId === 0 ? <Pause className="w-6 h-6" style={{ color: '#0a0a0a' }} /> : <Play className="w-6 h-6 ml-1" style={{ color: '#0a0a0a' }} />}
              </button>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-bold text-white">Your Original Sound</h3>
                  <span className="px-3 py-1 rounded-full text-xs" style={{ background: 'rgba(245, 212, 66, 0.2)', color: '#f5d442' }}>
                    Source
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

            <button
              onClick={onBack}
              className="px-6 py-3 rounded-xl flex items-center gap-2 transition-all hover:bg-white/5"
              style={{ border: '2px solid rgba(245, 212, 66, 0.3)', color: '#f5d442' }}
            >
              Back
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-2 gap-6">
          {mockResults.map((result, index) => (
            <div
              key={result.id}
              className="rounded-2xl p-6 group transition-all hover:scale-[1.02]"
              style={{
                background: '#1a1a1a',
                border: '2px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1 text-white">{result.title}</h3>
                  <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    by {result.author}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs" style={{
                    background: 'rgba(136, 212, 66, 0.2)',
                    color: '#88d442',
                  }}>
                    {result.category}
                  </span>
                </div>
              </div>

              {/* Similarity Score */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Match Quality</span>
                  <span className="text-xl font-bold" style={{
                    color: '#f5d442',
                  }}>
                    {result.similarity}%
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.1)', height: '6px' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #f5d442, #88d442)',
                      width: `${result.similarity}%`,
                      transition: 'width 1s ease-out',
                    }}
                  />
                </div>
              </div>

              {/* Waveform */}
              <div className="mb-4">
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
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    background: 'linear-gradient(135deg, #f5d442, #f5a742)',
                    boxShadow: '0 4px 16px rgba(245, 212, 66, 0.4)',
                  }}
                >
                  {playingId === result.id ? <Pause className="w-5 h-5" style={{ color: '#0a0a0a' }} /> : <Play className="w-5 h-5 ml-0.5" style={{ color: '#0a0a0a' }} />}
                </button>

                <button className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-white/5" style={{
                  border: '2px solid rgba(136, 212, 66, 0.3)',
                  color: '#88d442',
                }}>
                  <Download className="w-5 h-5" />
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
