import { AudioWaveform, Settings, Info } from "lucide-react";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  onHome: () => void;
}

export function Layout({ children, onHome }: LayoutProps) {
  return (
    <div className="dark min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
      {/* Top Navigation Bar */}
      <nav className="border-b px-8 py-4 flex items-center justify-between" style={{ borderColor: 'rgba(245, 212, 66, 0.15)', background: '#1a1a1a' }}>
        <button onClick={onHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5d442 0%, #f5a742 100%)' }}>
            <AudioWaveform className="w-6 h-6" style={{ color: '#0a0a0a' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#f5d442' }}>SonicMatch</h1>
            <p className="text-xs" style={{ color: 'rgba(136, 212, 66, 0.7)' }}>AI-Powered Sound Discovery</p>
          </div>
        </button>

        <div className="flex items-center gap-4">
          <button className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:bg-white/5" style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Info className="w-5 h-5" style={{ color: 'rgba(255, 255, 255, 0.6)' }} />
          </button>
          <button className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:bg-white/5" style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Settings className="w-5 h-5" style={{ color: 'rgba(255, 255, 255, 0.6)' }} />
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
