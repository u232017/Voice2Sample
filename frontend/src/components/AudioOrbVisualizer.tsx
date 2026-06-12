import { gsap } from 'gsap';
import { useLayoutEffect, useMemo, useRef } from 'react';

const ringBars = Array.from({ length: 84 }, (_, index) => {
  const width = index % 7 === 0 ? 4.6 : index % 3 === 0 ? 3.8 : 2.8;
  const height = 16 + ((index * 11) % 44);

  return {
    index,
    width,
    height,
    x: 260 - width / 2,
    y: 84 - height,
  };
});

const centerBars = Array.from({ length: 31 }, (_, index) => {
  const distance = Math.abs(index - 15);
  const width = index % 4 === 0 ? 7.4 : 5.8;
  const baseHeight = 34 + ((index * 13) % 66);
  const height = Math.max(28, baseHeight - distance * 1.15);

  return {
    index,
    width,
    height,
    x: 105 + index * 10,
    y: 260 - height / 2,
  };
});

const orbitDots = Array.from({ length: 16 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 16;
  const radius = index % 2 === 0 ? 188 : 154;

  return {
    index,
    cx: 260 + Math.cos(angle) * radius,
    cy: 260 + Math.sin(angle) * radius,
    r: index % 5 === 0 ? 4.2 : index % 2 === 0 ? 3.2 : 2.6,
    tone: index % 3 === 0 ? 'orange' : index % 2 === 0 ? 'green' : 'white',
  };
});

const particles = Array.from({ length: 28 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 28;
  const radius = 52 + (index % 6) * 18 + (index % 4) * 7;

  return {
    index,
    cx: 260 + Math.cos(angle) * radius,
    cy: 260 + Math.sin(angle) * radius * 0.82,
    r: index % 6 === 0 ? 2.8 : 1.8,
    tone: index % 4 === 0 ? 'orange' : index % 3 === 0 ? 'white' : 'green',
  };
});

const radialLines = Array.from({ length: 48 }, (_, index) => index);

const mainWavePath =
  'M48 260 C66 260 72 224 90 224 C108 224 120 304 138 304 C156 304 166 202 182 202 C198 202 206 286 222 286 C238 286 246 192 260 192 C272 192 280 318 294 318 C308 318 316 200 334 200 C352 200 360 296 378 296 C394 296 404 234 420 234 C438 234 446 282 472 282';
const altWavePath =
  'M52 260 C74 260 84 240 96 240 C112 240 120 286 136 286 C154 286 164 222 180 222 C196 222 208 210 224 210 C240 210 248 280 264 280 C280 280 286 216 302 216 C320 216 332 290 348 290 C364 290 374 242 388 242 C404 242 418 262 438 262 C452 262 462 256 472 256';

export function AudioOrbVisualizer() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hoverTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const hoverTargets = useMemo(
    () => ({
      stage: '.audio-orb-stage-shell',
      glow: '.audio-orb-core-glow',
      beam: '.audio-orb-wave-beam',
      highlight: '.audio-orb-highlight-arc',
      orbit: '.audio-orb-orbit-group',
    }),
    []
  );

  useLayoutEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.to('.audio-orb-svg', {
        rotation: 2.2,
        scale: 1.018,
        transformOrigin: '50% 50%',
        duration: 5.2,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      gsap.to('.audio-orb-outer-spin', {
        rotation: 360,
        transformOrigin: '50% 50%',
        duration: 34,
        ease: 'none',
        repeat: -1,
      });

      gsap.to('.audio-orb-inner-spin', {
        rotation: -360,
        transformOrigin: '50% 50%',
        duration: 24,
        ease: 'none',
        repeat: -1,
      });

      gsap.to('.audio-orb-orbit-group.orbit-a', {
        rotation: 360,
        transformOrigin: '50% 50%',
        duration: 22,
        ease: 'none',
        repeat: -1,
      });

      gsap.to('.audio-orb-orbit-group.orbit-b', {
        rotation: -360,
        transformOrigin: '50% 50%',
        duration: 18,
        ease: 'none',
        repeat: -1,
      });

      gsap.to('.audio-orb-radial-grid', {
        rotation: 360,
        transformOrigin: '50% 50%',
        duration: 40,
        ease: 'none',
        repeat: -1,
      });

      gsap.to('.audio-orb-radial-line', {
        opacity: () => gsap.utils.random(0.12, 0.44),
        duration: () => gsap.utils.random(1.2, 3),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        repeatRefresh: true,
        stagger: {
          each: 0.018,
          from: 'random',
        },
      });

      gsap.to('.audio-orb-highlight-arc', {
        strokeDashoffset: (_, target) =>
          target instanceof SVGElement && target.classList.contains('is-reverse') ? -340 : 340,
        duration: 5.6,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 0.35,
      });

      gsap.to('.audio-orb-spectrum-bar', {
        scaleY: () => gsap.utils.random(0.45, 1.35),
        transformOrigin: '50% 100%',
        duration: () => gsap.utils.random(1, 1.9),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        repeatRefresh: true,
        stagger: {
          each: 0.015,
          from: 'random',
        },
      });

      gsap.to('.audio-orb-center-bar', {
        scaleY: () => gsap.utils.random(0.42, 1.28),
        transformOrigin: '50% 50%',
        duration: () => gsap.utils.random(0.7, 1.45),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        repeatRefresh: true,
        stagger: {
          each: 0.028,
          from: 'center',
        },
      });

      gsap.to('.audio-orb-wave-group', {
        scaleY: 1.1,
        scaleX: 1.035,
        y: -8,
        rotation: 1.1,
        transformOrigin: '50% 50%',
        duration: 2.2,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      gsap.to('.audio-orb-wave-main, .audio-orb-wave-alt, .audio-orb-wave-shadow', {
        x: () => gsap.utils.random(-3, 3),
        duration: () => gsap.utils.random(1.1, 1.9),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        repeatRefresh: true,
      });

      gsap.to('.audio-orb-wave-beam', {
        opacity: 1,
        duration: 1.8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      gsap.to('.audio-orb-core-glow, .audio-orb-core-pulse', {
        scale: (_, target) =>
          target instanceof SVGElement && target.classList.contains('pulse-b') ? 1.12 : 1.2,
        opacity: (_, target) =>
          target instanceof SVGElement && target.classList.contains('pulse-b') ? 0.84 : 1,
        transformOrigin: '50% 50%',
        duration: 2.2,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 0.15,
      });

      gsap.to('.audio-orb-core-dot.outer, .audio-orb-core-dot.inner', {
        scale: (_, target) =>
          target instanceof SVGElement && target.classList.contains('inner') ? 1.35 : 1.18,
        opacity: (_, target) =>
          target instanceof SVGElement && target.classList.contains('inner') ? 1 : 0.88,
        transformOrigin: '50% 50%',
        duration: 1.7,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 0.08,
      });

      gsap.to('.audio-orb-halo.halo-green', {
        scale: 1.14,
        xPercent: -4,
        yPercent: -3,
        duration: 4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      gsap.to('.audio-orb-halo.halo-orange', {
        scale: 1.18,
        xPercent: 5,
        yPercent: 4,
        duration: 4.6,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      gsap.to('.audio-orb-orbit-dot', {
        scale: () => gsap.utils.random(0.82, 1.4),
        opacity: () => gsap.utils.random(0.52, 1),
        transformOrigin: '50% 50%',
        duration: () => gsap.utils.random(1.3, 2.8),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        repeatRefresh: true,
        stagger: {
          each: 0.04,
          from: 'random',
        },
      });

      gsap.to('.audio-orb-particle', {
        opacity: () => gsap.utils.random(0.18, 0.92),
        scale: () => gsap.utils.random(0.7, 1.9),
        transformOrigin: '50% 50%',
        duration: () => gsap.utils.random(1.1, 2.6),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        repeatRefresh: true,
        stagger: {
          each: 0.045,
          from: 'random',
        },
      });

      gsap.to('.audio-orb-shimmer', {
        rotation: 360,
        transformOrigin: '50% 50%',
        duration: 18,
        ease: 'none',
        repeat: -1,
      });

      gsap.to('.audio-orb-stage-shell', {
        y: -14,
        x: 7,
        rotation: 2.6,
        scale: 1.028,
        duration: 4.8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      gsap.to('.audio-orb-shell', {
        scale: 1.018,
        transformOrigin: '50% 50%',
        duration: 3.8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      hoverTimelineRef.current = gsap
        .timeline({ paused: true })
        .to(
          hoverTargets.stage,
          {
            scale: 1.03,
            duration: 0.4,
            ease: 'power2.out',
            transformOrigin: '50% 50%',
          },
          0
        )
        .to(
          '.audio-orb-svg',
          {
            rotation: 4.2,
            scale: 1.038,
            duration: 0.4,
            ease: 'power2.out',
            transformOrigin: '50% 50%',
          },
          0
        )
        .to(
          hoverTargets.glow,
          {
            scale: 1.18,
            opacity: 1,
            duration: 0.4,
            ease: 'power2.out',
            transformOrigin: '50% 50%',
          },
          0
        )
        .to(
          hoverTargets.beam,
          {
            opacity: 1,
            strokeWidth: 5.2,
            duration: 0.4,
            ease: 'power2.out',
          },
          0
        )
        .to(
          hoverTargets.highlight,
          {
            opacity: 1,
            duration: 0.35,
            ease: 'power2.out',
          },
          0
        )
        .to(
          hoverTargets.orbit,
          {
            scale: 1.02,
            duration: 0.35,
            ease: 'power2.out',
            transformOrigin: '50% 50%',
          },
          0
        );
    }, rootRef);

    return () => {
      hoverTimelineRef.current = null;
      ctx.revert();
    };
  }, [hoverTargets]);

  return (
    <div
      ref={rootRef}
      className="audio-orb-visualizer"
      aria-hidden="true"
      onPointerEnter={() => hoverTimelineRef.current?.play()}
      onPointerLeave={() => hoverTimelineRef.current?.reverse()}
    >
      <div className="audio-orb-stage-shell">
        <div className="audio-orb-halo halo-green" />
        <div className="audio-orb-halo halo-orange" />

        <svg className="audio-orb-svg" viewBox="0 0 520 520" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="audioOrbBg" cx="50%" cy="50%" r="62%">
              <stop offset="0%" stopColor="#09110a" />
              <stop offset="42%" stopColor="#070d08" />
              <stop offset="100%" stopColor="#030504" />
            </radialGradient>

            <radialGradient id="audioOrbCore" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="rgba(244,255,246,0.92)" />
              <stop offset="18%" stopColor="rgba(76,255,136,0.66)" />
              <stop offset="58%" stopColor="rgba(255,159,28,0.28)" />
              <stop offset="100%" stopColor="rgba(255,159,28,0)" />
            </radialGradient>

            <linearGradient id="audioOrbGreen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#72ff9e" />
              <stop offset="60%" stopColor="#49ff87" />
              <stop offset="100%" stopColor="#d3ff7b" />
            </linearGradient>

            <linearGradient id="audioOrbOrange" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffd06d" />
              <stop offset="52%" stopColor="#ffab31" />
              <stop offset="100%" stopColor="#ff8f1f" />
            </linearGradient>

            <linearGradient id="audioOrbWave" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#ff9f1c" stopOpacity="0" />
              <stop offset="16%" stopColor="#ffb744" />
              <stop offset="48%" stopColor="#f4fff6" />
              <stop offset="58%" stopColor="#4cff88" />
              <stop offset="84%" stopColor="#ffb744" />
              <stop offset="100%" stopColor="#ff9f1c" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="audioOrbBars" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#f4fff6" />
              <stop offset="44%" stopColor="#72ff9e" />
              <stop offset="100%" stopColor="#ff9f1c" />
            </linearGradient>

            <filter id="audioOrbGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="0 0 0 0 0.29 0 0 0 0 1 0 0 0 0 0.58 0 0 0 0.55 0"
                result="glow"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="audioOrbOrangeGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="0 0 0 0 1 0 0 0 0 0.62 0 0 0 0 0.12 0 0 0 0.5 0"
                result="glow"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="audioOrbSoftBlur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>

          <circle className="audio-orb-shell" cx="260" cy="260" r="228" fill="url(#audioOrbBg)" />

          <g className="audio-orb-shimmer">
            <path
              className="audio-orb-sheen"
              d="M126 108 C190 64 288 62 360 100 C426 138 452 216 450 264"
            />
          </g>

          <g className="audio-orb-radial-grid">
            {radialLines.map((index) => (
              <line
                key={index}
                className="audio-orb-radial-line"
                x1="260"
                y1="52"
                x2="260"
                y2="168"
                transform={`rotate(${index * 7.5} 260 260)`}
              />
            ))}
          </g>

          <g className="audio-orb-outer-spin">
            <circle className="audio-orb-ring ring-outer" cx="260" cy="260" r="214" />
            <circle className="audio-orb-ring ring-dashed" cx="260" cy="260" r="188" />
            <circle className="audio-orb-ring ring-fine" cx="260" cy="260" r="164" />
            <circle className="audio-orb-highlight-arc" cx="260" cy="260" r="214" />
            <circle className="audio-orb-highlight-arc is-reverse" cx="260" cy="260" r="188" />
          </g>

          <g className="audio-orb-inner-spin">
            <circle className="audio-orb-ring ring-inner" cx="260" cy="260" r="138" />
            <circle className="audio-orb-ring ring-core" cx="260" cy="260" r="114" />
            <circle className="audio-orb-ring ring-dotted" cx="260" cy="260" r="96" />
          </g>

          <g className="audio-orb-spectrum-ring">
            {ringBars.map(({ index, width, height, x, y }) => (
              <g key={index} transform={`rotate(${index * (360 / ringBars.length)} 260 260)`}>
                <rect
                  className="audio-orb-spectrum-bar"
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={width / 2}
                />
              </g>
            ))}
          </g>

          <g className="audio-orb-orbit-group orbit-a">
            {orbitDots.slice(0, 8).map(({ index, cx, cy, r, tone }) => (
              <circle key={index} className={`audio-orb-orbit-dot ${tone}`} cx={cx} cy={cy} r={r} />
            ))}
          </g>

          <g className="audio-orb-orbit-group orbit-b">
            {orbitDots.slice(8).map(({ index, cx, cy, r, tone }) => (
              <circle key={index} className={`audio-orb-orbit-dot ${tone}`} cx={cx} cy={cy} r={r} />
            ))}
          </g>

          <g className="audio-orb-particles">
            {particles.map(({ index, cx, cy, r, tone }) => (
              <circle key={index} className={`audio-orb-particle ${tone}`} cx={cx} cy={cy} r={r} />
            ))}
          </g>

          <g className="audio-orb-wave-group">
            <ellipse className="audio-orb-core-glow" cx="260" cy="260" rx="124" ry="78" fill="url(#audioOrbCore)" />
            <ellipse className="audio-orb-core-pulse pulse-a" cx="260" cy="260" rx="120" ry="74" />
            <ellipse className="audio-orb-core-pulse pulse-b" cx="260" cy="260" rx="144" ry="88" />

            <g className="audio-orb-center-bars">
              {centerBars.map(({ index, width, height, x, y }) => (
                <rect
                  key={index}
                  className="audio-orb-center-bar"
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={width / 2}
                />
              ))}
            </g>

            <line className="audio-orb-wave-beam" x1="58" y1="260" x2="462" y2="260" />
            <path className="audio-orb-wave-shadow" d={mainWavePath} />
            <path className="audio-orb-wave-main" d={mainWavePath} />
            <path className="audio-orb-wave-alt" d={altWavePath} />

            <circle className="audio-orb-core-dot outer" cx="260" cy="260" r="20" />
            <circle className="audio-orb-core-dot inner" cx="260" cy="260" r="7" />
          </g>
        </svg>
      </div>

      <div className="reference-orb-label audio-orb-label">
        <span>Audio Engine</span>
        <strong>Capture. Shape. Discover.</strong>
      </div>
    </div>
  );
}
