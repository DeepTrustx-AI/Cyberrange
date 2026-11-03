import { useMemo } from 'react';
import { CLAY } from '../three/clay';
import { liteMode } from '../../utils/webgl';

const COLORS = [CLAY.peach, CLAY.mint, CLAY.butter, CLAY.sky, CLAY.blush];

// Clay confetti falling across the whole screen, for the big moments (a cleared
// challenge, a finished cube). Nothing falls for visitors who prefer less motion,
// or in light mode.
export function ClayRain({ count = 36, delay = 0.25 }: { count?: number; delay?: number }) {
  const pieces = useMemo(() => {
    if (liteMode() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    return Array.from({ length: count }, (_, i) => ({
      left: (i * 37) % 100,
      size: 6 + ((i * 7) % 7),
      color: COLORS[i % COLORS.length],
      delay: delay + ((i * 13) % 20) / 25,
      fall: 2.2 + ((i * 11) % 10) / 8,
      drift: ((i * 29) % 120) - 60,
      spin: 360 + ((i * 53) % 540),
    }));
  }, [count, delay]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((piece, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 0.6,
            background: piece.color,
            ['--delay' as string]: `${piece.delay}s`,
            ['--fall' as string]: `${piece.fall}s`,
            ['--drift' as string]: `${piece.drift}px`,
            ['--spin' as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
