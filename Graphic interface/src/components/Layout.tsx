import { AudioWaveform, Settings, Info } from "lucide-react";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  onHome: () => void;
}

export function Layout({ children, onHome }: LayoutProps) {
  return (
    <div className="dark min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f0f1e 0%, #1a0a2e 100%)' }}>
      {/* Top Navigation Bar */}
      <nav className="border-b backdrop-blur-xl px-8 py-5 flex items-center justify-between transition-all duration-300" style={{
        borderColor: 'rgba(245, 212, 66, 0.15)',
        background: 'linear-gradient(180deg, rgba(15, 15, 30, 0.8) 0%, rgba(26, 10, 46, 0.6) 100%)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(245, 212, 66, 0.05)',
      }}>
        <button onClick={onHome} className="flex items-center gap-3 hover:opacity-90 transition-opacity group">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform" style={{
            background: 'linear-gradient(135deg, #f5d442 0%, #f5a742 100%)',
            boxShadow: '0 6px 20px rgba(245, 212, 66, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
          }}>
            <AudioWaveform className="w-6 h-6" style={{ color: '#0a0a0a' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-yellow-400 group-hover:to-green-400 group-hover:bg-clip-text transition-all" style={{ color: '#f5d442' }}>SonicMatch</h1>
            <p className="text-xs font-medium" style={{ color: 'rgba(136, 212, 66, 0.75)' }}>AI-Powered Sound Discovery</p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button className="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-300 group hover:scale-110 backdrop-blur-sm" style={{
            border: '2px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.05)',
          }}>
            <Info className="w-5 h-5 group-hover:text-yellow-400 transition-colors" style={{ color: 'rgba(255, 255, 255, 0.7)' }} />
          </button>
          <button className="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-300 group hover:scale-110 backdrop-blur-sm" style={{
            border: '2px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.05)',
          }}>
            <Settings className="w-5 h-5 group-hover:text-green-400 group-hover:rotate-90 transition-all" style={{ color: 'rgba(255, 255, 255, 0.7)' }} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
