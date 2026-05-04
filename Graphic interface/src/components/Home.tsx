import { Sparkles, Mic, Upload } from "lucide-react";

interface HomeProps {
  onNavigate: (mode: string) => void;
}

export function Home({ onNavigate }: HomeProps) {
  return (
    <div className="min-h-[calc(100vh-89px)] flex items-center justify-center px-8 py-12 relative overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* Background Audio Visualization */}
      <div className="absolute inset-0 flex items-center justify-center opacity-8">
        <div className="flex items-end gap-1 h-64">
          {Array.from({ length: 64 }).map((_, i) => (
            <div
              key={i}
              className="w-2 animate-pulse"
              style={{
                background: 'linear-gradient(to top, #f5a742, #f5d442, #88d442)',
                height: `${Math.random() * 100}%`,
                borderRadius: '1px',
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl w-full">
        <div className="text-center mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ background: 'rgba(245, 212, 66, 0.1)', border: '1px solid rgba(245, 212, 66, 0.3)' }}>
              <Sparkles className="w-4 h-4" style={{ color: '#f5d442' }} />
              <span className="text-sm" style={{ color: '#f5d442' }}>Powered by Freesound API</span>
            </div>
            <h1 className="text-6xl font-bold mb-4 tracking-tight text-white">
              Find Your Perfect Sound
            </h1>
            <p className="text-xl mb-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Discover similar sounds from Freesound using advanced audio matching
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto">
          <button
            onClick={() => onNavigate("record")}
            className="group"
          >
            <div className="relative p-8 rounded-2xl transition-all duration-300 hover:scale-105" style={{
              background: 'linear-gradient(135deg, rgba(245, 212, 66, 0.08) 0%, rgba(245, 212, 66, 0.03) 100%)',
              border: '2px solid rgba(245, 212, 66, 0.3)',
            }}>
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all group-hover:scale-110" style={{
                  background: 'linear-gradient(135deg, #f5d442 0%, #f5a742 100%)',
                  boxShadow: '0 8px 24px rgba(245, 212, 66, 0.4)',
                }}>
                  <Mic className="w-8 h-8" style={{ color: '#0a0a0a' }} />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">Record Sound</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  Capture audio directly from your microphone
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => onNavigate("upload")}
            className="group"
          >
            <div className="relative p-8 rounded-2xl transition-all duration-300 hover:scale-105" style={{
              background: 'linear-gradient(135deg, rgba(136, 212, 66, 0.08) 0%, rgba(136, 212, 66, 0.03) 100%)',
              border: '2px solid rgba(136, 212, 66, 0.3)',
            }}>
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all group-hover:scale-110" style={{
                  background: 'linear-gradient(135deg, #88d442 0%, #6fb032 100%)',
                  boxShadow: '0 8px 24px rgba(136, 212, 66, 0.4)',
                }}>
                  <Upload className="w-8 h-8" style={{ color: '#0a0a0a' }} />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">Upload Audio</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  Import an existing audio file from your device
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
            Supports WAV, MP3, OGG, and FLAC formats
          </p>
        </div>
      </div>
    </div>
  );
}
