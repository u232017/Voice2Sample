import { Sparkles, Mic, Upload, ArrowRight } from "lucide-react";

interface HomeProps {
  onNavigate: (mode: string) => void;
}

export function Home({ onNavigate }: HomeProps) {
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

      {/* Floating shapes background */}
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full opacity-5" style={{
        background: 'radial-gradient(circle, #f5d442 0%, transparent 70%)',
        filter: 'blur(40px)',
      }}></div>
      <div className="absolute bottom-20 left-10 w-96 h-96 rounded-full opacity-5" style={{
        background: 'radial-gradient(circle, #88d442 0%, transparent 70%)',
        filter: 'blur(40px)',
      }}></div>

      {/* Main Content */}
      <div className="relative z-10 max-w-5xl w-full">
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full mb-8 backdrop-blur-md border" style={{
            background: 'rgba(245, 212, 66, 0.08)',
            border: '1px solid rgba(245, 212, 66, 0.25)',
            animation: 'float 6s ease-in-out infinite'
          }}>
            <Sparkles className="w-4 h-4" style={{ color: '#f5d442' }} />
            <span className="text-sm font-medium" style={{ color: '#f5d442' }}>Powered by Freesound API</span>
          </div>

          <h1 className="text-7xl font-bold mb-6 tracking-tight text-white" style={{
            background: 'linear-gradient(135deg, #ffffff 0%, rgba(245, 212, 66, 0.8) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Find Your Perfect Sound
          </h1>

          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
            Discover similar sounds from Freesound using advanced audio matching technology
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-2 gap-8 max-w-3xl mx-auto mb-16">
          <button
            onClick={() => onNavigate("record")}
            className="group relative"
            style={{ perspective: '1000px' }}
          >
            <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
              background: 'linear-gradient(135deg, rgba(245, 212, 66, 0.3) 0%, rgba(245, 212, 66, 0.1) 100%)',
              filter: 'blur(20px)',
            }}></div>

            <div className="relative p-8 rounded-3xl transition-all duration-500 transform group-hover:scale-105 group-hover:translate-y-[-8px]" style={{
              background: 'linear-gradient(135deg, rgba(245, 212, 66, 0.12) 0%, rgba(245, 212, 66, 0.02) 100%)',
              border: '2px solid rgba(245, 212, 66, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(245, 212, 66, 0.1)',
              backdropFilter: 'blur(10px)',
            }}>
              <div className="relative space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6" style={{
                  background: 'linear-gradient(135deg, #f5d442 0%, #f5a742 100%)',
                  boxShadow: '0 12px 36px rgba(245, 212, 66, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
                }}>
                  <Mic className="w-8 h-8" style={{ color: '#0a0a0a' }} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white text-left">Record Sound</h3>
                  <p className="text-sm mt-2" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    Capture audio directly from your microphone
                  </p>
                </div>
              </div>
              <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1" style={{ color: '#f5d442' }} />
            </div>
          </button>

          <button
            onClick={() => onNavigate("upload")}
            className="group relative"
            style={{ perspective: '1000px' }}
          >
            <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
              background: 'linear-gradient(135deg, rgba(136, 212, 66, 0.3) 0%, rgba(136, 212, 66, 0.1) 100%)',
              filter: 'blur(20px)',
            }}></div>

            <div className="relative p-8 rounded-3xl transition-all duration-500 transform group-hover:scale-105 group-hover:translate-y-[-8px]" style={{
              background: 'linear-gradient(135deg, rgba(136, 212, 66, 0.12) 0%, rgba(136, 212, 66, 0.02) 100%)',
              border: '2px solid rgba(136, 212, 66, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(136, 212, 66, 0.1)',
              backdropFilter: 'blur(10px)',
            }}>
              <div className="relative space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6" style={{
                  background: 'linear-gradient(135deg, #88d442 0%, #6fb032 100%)',
                  boxShadow: '0 12px 36px rgba(136, 212, 66, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
                }}>
                  <Upload className="w-8 h-8" style={{ color: '#0a0a0a' }} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white text-left">Upload Audio</h3>
                  <p className="text-sm mt-2" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    Import an existing audio file
                  </p>
                </div>
              </div>
              <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1" style={{ color: '#88d442' }} />
            </div>
          </button>
        </div>

        {/* Footer Info */}
        <div className="text-center">
          <p className="text-xs font-medium tracking-wide" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
            SUPPORTS WAV · MP3 · OGG · FLAC
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
