interface BrandLogoProps {
  variant?: 'hero' | 'compact';
}

export function BrandLogo({ variant = 'compact' }: BrandLogoProps) {
  return (
    <div className={`brand-logo ${variant}`} aria-label="Voice to Sample logo">
      <svg viewBox="0 0 320 320" role="img">
        <defs>
          {/* Dark green background matching the site */}
          <radialGradient id="brandCore" cx="50%" cy="46%" r="58%">
            <stop offset="0%" stopColor="#0d2010" />
            <stop offset="64%" stopColor="#070f08" />
            <stop offset="100%" stopColor="#030608" />
          </radialGradient>

          {/* Orange-gold-yellow gradient matching the hero text */}
          <linearGradient id="brandGold" x1="16%" x2="84%" y1="12%" y2="88%">
            <stop offset="0%" stopColor="#e8853a" />
            <stop offset="28%" stopColor="#f5c842" />
            <stop offset="55%" stopColor="#f7e06a" />
            <stop offset="78%" stopColor="#c8d94a" />
            <stop offset="100%" stopColor="#e8853a" />
          </linearGradient>

          {/* Edge ring: orange to yellow-green */}
          <linearGradient id="brandEdge" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#e8853a" />
            <stop offset="50%" stopColor="#f5c842" />
            <stop offset="100%" stopColor="#8fc43a" />
          </linearGradient>

          {/* Subtle glow in green */}
          <filter id="brandGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feColorMatrix
              in="blur"
              result="glow"
              type="matrix"
              values="0 0 0 0 0.85 0 0 0 0 0.55 0 0 0 0 0.10 0 0 0 0.55 0"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Core disc */}
        <circle cx="160" cy="160" r="148" fill="url(#brandCore)" />

        {/* Outer gold-lime ring */}
        <circle cx="160" cy="160" r="146" fill="none" stroke="url(#brandGold)" strokeWidth="5.5" />

        {/* Inner subtle rings */}
        <circle cx="160" cy="160" r="138" fill="none" stroke="#f5c842" strokeOpacity="0.30" strokeWidth="1.3" />
        <circle cx="160" cy="160" r="128" fill="none" stroke="#e8853a" strokeOpacity="0.72" strokeWidth="2" />
        <circle cx="160" cy="160" r="112" fill="none" stroke="url(#brandGold)" strokeDasharray="1 8" strokeLinecap="round" strokeOpacity="0.45" strokeWidth="2.6" />
        <circle cx="160" cy="160" r="96" fill="none" stroke="url(#brandEdge)" strokeOpacity="0.25" strokeWidth="1.4" />

        {/* Top accent lines */}
        <g opacity="0.9">
          <path d="M132 58 H188" stroke="url(#brandGold)" strokeWidth="3" strokeLinecap="round" />
          <path d="M145 66 H175" stroke="#f5c842" strokeWidth="2" strokeLinecap="round" filter="url(#brandGlow)" />
        </g>

        {/* V2S text */}
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

        {/* Bottom accent lines */}
        <g opacity="0.82">
          <path d="M132 262 H188" stroke="url(#brandGold)" strokeWidth="3" strokeLinecap="round" />
          <path d="M145 254 H175" stroke="#f5c842" strokeWidth="2" strokeLinecap="round" filter="url(#brandGlow)" />
        </g>
      </svg>
    </div>
  );
}
