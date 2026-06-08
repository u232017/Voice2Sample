interface BrandLogoProps {
  variant?: 'hero' | 'compact';
}

export function BrandLogo({ variant = 'compact' }: BrandLogoProps) {
  return (
    <div className={`brand-logo ${variant}`} aria-label="Voice 2 Sample logo">
      <svg viewBox="0 0 320 320" role="img">
        <defs>
          <radialGradient id="brandCore" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#152117" />
            <stop offset="60%" stopColor="#0a100b" />
            <stop offset="100%" stopColor="#040604" />
          </radialGradient>

          <linearGradient id="brandAccent" x1="8%" x2="92%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#4cff88" />
            <stop offset="54%" stopColor="#9dffb8" />
            <stop offset="100%" stopColor="#ff9f1c" />
          </linearGradient>

          <linearGradient id="brandBars" x1="50%" x2="50%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#f4fff6" />
            <stop offset="40%" stopColor="#9dffb8" />
            <stop offset="100%" stopColor="#ff9f1c" />
          </linearGradient>

          <filter id="brandGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              result="glow"
              type="matrix"
              values="0 0 0 0 0.30 0 0 0 0 0.95 0 0 0 0 0.52 0 0 0 0.60 0"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="160" cy="160" r="148" fill="url(#brandCore)" />
        <circle cx="160" cy="160" r="146" fill="none" stroke="url(#brandAccent)" strokeWidth="4.5" />
        <circle cx="160" cy="160" r="126" fill="none" stroke="rgba(76,255,136,0.20)" strokeWidth="1.6" />
        <circle cx="160" cy="160" r="104" fill="none" stroke="rgba(255,159,28,0.18)" strokeWidth="1.4" />

        <path
          d="M76 188 C105 148, 126 200, 156 160 S206 130, 244 168"
          fill="none"
          stroke="url(#brandAccent)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#brandGlow)"
        />

        <g fill="url(#brandBars)" filter="url(#brandGlow)">
          <rect x="86" y="104" width="20" height="84" rx="10" />
          <rect x="118" y="82" width="20" height="126" rx="10" />
          <rect x="150" y="120" width="20" height="72" rx="10" />
          <rect x="182" y="92" width="20" height="112" rx="10" />
          <rect x="214" y="116" width="20" height="66" rx="10" />
        </g>

        <circle cx="160" cy="160" r="18" fill="#f4fff6" fillOpacity="0.12" />
        <circle cx="160" cy="160" r="8" fill="#f4fff6" />
      </svg>
    </div>
  );
}
