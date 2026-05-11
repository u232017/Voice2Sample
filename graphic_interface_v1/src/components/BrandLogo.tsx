interface BrandLogoProps {
  variant?: 'hero' | 'compact';
}

export function BrandLogo({ variant = 'compact' }: BrandLogoProps) {
  return (
    <div className={`brand-logo ${variant}`} aria-label="Voice to Sample logo">
      <svg viewBox="0 0 320 320" role="img">
        <defs>
          <radialGradient id="brandCore" cx="50%" cy="46%" r="58%">
            <stop offset="0%" stopColor="#11120c" />
            <stop offset="64%" stopColor="#040503" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          <linearGradient id="brandGold" x1="16%" x2="84%" y1="12%" y2="88%">
            <stop offset="0%" stopColor="#fff7cf" />
            <stop offset="18%" stopColor="#f5d26d" />
            <stop offset="42%" stopColor="#b67613" />
            <stop offset="64%" stopColor="#f2be4d" />
            <stop offset="84%" stopColor="#fff0a4" />
            <stop offset="100%" stopColor="#9a5c08" />
          </linearGradient>
          <linearGradient id="brandEdge" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#f5d77a" />
            <stop offset="48%" stopColor="#0f8f2f" />
            <stop offset="100%" stopColor="#f0c35c" />
          </linearGradient>
          <linearGradient id="brandWave" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#f7d975" />
            <stop offset="42%" stopColor="#0f8f2f" />
            <stop offset="63%" stopColor="#65b83f" />
            <stop offset="100%" stopColor="#f7d975" />
          </linearGradient>
          <filter id="brandGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feColorMatrix
              in="blur"
              result="glow"
              type="matrix"
              values="0 0 0 0 0.88 0 0 0 0 0.62 0 0 0 0 0.18 0 0 0 0.45 0"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="160" cy="160" r="148" fill="url(#brandCore)" />
        <circle cx="160" cy="160" r="146" fill="none" stroke="url(#brandGold)" strokeWidth="5.5" />
        <circle cx="160" cy="160" r="138" fill="none" stroke="#fff1a8" strokeOpacity="0.5" strokeWidth="1.3" />
        <circle cx="160" cy="160" r="128" fill="none" stroke="#0f8f2f" strokeOpacity="0.72" strokeWidth="2" />
        <circle cx="160" cy="160" r="112" fill="none" stroke="url(#brandGold)" strokeDasharray="1 8" strokeLinecap="round" strokeOpacity="0.48" strokeWidth="2.6" />
        <circle cx="160" cy="160" r="96" fill="none" stroke="url(#brandEdge)" strokeOpacity="0.28" strokeWidth="1.4" />

        <g opacity="0.9">
          <path d="M132 58 H188" stroke="url(#brandGold)" strokeWidth="3" strokeLinecap="round" />
          <path d="M145 66 H175" stroke="#0f8f2f" strokeWidth="2" strokeLinecap="round" filter="url(#brandGlow)" />
        </g>

        <text
          x="154"
          y="190"
          fill="url(#brandGold)"
          filter="url(#brandGlow)"
          fontFamily="'Times New Roman', Georgia, serif"
          fontSize="104"
          fontStyle="italic"
          fontWeight="700"
          letterSpacing="-12"
          textAnchor="middle"
        >
          V2S
        </text>

        <g opacity="0.82">
          <path d="M132 262 H188" stroke="url(#brandGold)" strokeWidth="3" strokeLinecap="round" />
          <path d="M145 254 H175" stroke="#0f8f2f" strokeWidth="2" strokeLinecap="round" filter="url(#brandGlow)" />
        </g>
      </svg>
    </div>
  );
}
