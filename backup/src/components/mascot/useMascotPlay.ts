import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export type MascotReaction = 'boop' | 'dizzy' | 'held';

// Five pokes inside this window and the mascot gets dizzy.
const DIZZY_POKES = 5;
const DIZZY_WINDOW_MS = 2500;
// How far a press has to move before it counts as picking the mascot up.
const GRAB_DISTANCE = 5;

const SQUASH: Keyframe[] = [
  { transform: 'none' },
  { transform: 'scale(1.14, 0.84)', offset: 0.18 },
  { transform: 'translateY(-7px) scale(0.93, 1.09)', offset: 0.46 },
  { transform: 'scale(1.04, 0.97)', offset: 0.76 },
  { transform: 'none' },
];

const HEART: Keyframe[] = [
  { opacity: 0, transform: 'translateY(6px) scale(0.4)' },
  { opacity: 1, transform: 'translateY(-4px) scale(1.15)', offset: 0.28 },
  { opacity: 0, transform: 'translateY(-18px) scale(0.9)' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Makes the mascot a toy. A tap squashes it and pops a heart; a burst of taps
// makes it dizzy. Pressing and dragging picks it up: it hangs from the pointer,
// swings with the motion and kicks its legs, and when let go it springs back
// to where it was with a bounce. The spring runs on requestAnimationFrame only
// while the mascot is moving, and only touches a transform.
export function useMascotPlay(svgRef: RefObject<SVGSVGElement | null>, enabled: boolean) {
  const [reaction, setReaction] = useState<MascotReaction | null>(null);
  const reactionRef = useRef<MascotReaction | null>(null);
  const timer = useRef(0);
  const pokes = useRef<number[]>([]);
  const motion = useRef({ x: 0, y: 0, vx: 0, vy: 0, r: 0, frame: 0 });
  const stopDrag = useRef<(() => void) | null>(null);

  const react = useCallback((next: MascotReaction | null, forMs = 0) => {
    window.clearTimeout(timer.current);
    reactionRef.current = next;
    setReaction(next);
    if (next && forMs) {
      timer.current = window.setTimeout(() => {
        reactionRef.current = null;
        setReaction(null);
      }, forMs);
    }
  }, []);

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    cancelAnimationFrame(motion.current.frame);
    stopDrag.current?.();
  }, []);

  const play = useCallback((selector: string, keyframes: Keyframe[], duration: number) => {
    if (reducedMotion()) return;
    svgRef.current?.querySelector(selector)?.animate(keyframes, { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }, [svgRef]);

  const poke = useCallback(() => {
    const now = performance.now();
    pokes.current = [...pokes.current.filter((at) => now - at < DIZZY_WINDOW_MS), now];
    play('.m-poke', SQUASH, 560);
    if (reactionRef.current === 'dizzy') return;
    if (pokes.current.length >= DIZZY_POKES) {
      pokes.current = [];
      react('dizzy', 2400);
      return;
    }
    play('.m-heart', HEART, 900);
    react('boop', 700);
  }, [play, react]);

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!enabled || !svg || event.button !== 0) return;
    event.preventDefault();
    stopDrag.current?.();

    const m = motion.current;
    const press = { x: event.clientX, y: event.clientY };
    const from = { x: m.x, y: m.y };
    let pointer = press;
    let held = false;
    let last = performance.now();

    // It hangs from wherever it was picked up.
    const box = svg.getBoundingClientRect();
    svg.style.transformOrigin = `${press.x - box.left}px ${press.y - box.top}px`;

    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const targetX = held ? from.x + pointer.x - press.x : 0;
      const targetY = held ? from.y + pointer.y - press.y : 0;
      // Stiff while held so it keeps up; loose when let go, so it overshoots home and bounces.
      const stiffness = held ? 700 : 210;
      const damping = held ? 40 : 13;
      m.vx += (stiffness * (targetX - m.x) - damping * m.vx) * dt;
      m.vy += (stiffness * (targetY - m.y) - damping * m.vy) * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.r += (clamp(m.vx * 0.045, -28, 28) - m.r) * Math.min(1, dt * 12);
      svg.style.transform = `translate3d(${m.x}px, ${m.y}px, 0) rotate(${m.r}deg)`;

      const home = !held && Math.hypot(m.x, m.y) < 0.4 && Math.hypot(m.vx, m.vy) < 8 && Math.abs(m.r) < 0.3;
      if (home) {
        Object.assign(m, { x: 0, y: 0, vx: 0, vy: 0, r: 0, frame: 0 });
        svg.style.transform = '';
        svg.style.zIndex = '';
        react(null);
        play('.m-poke', SQUASH, 560);
        return;
      }
      m.frame = requestAnimationFrame(step);
    };

    const onMove = (move: PointerEvent) => {
      pointer = { x: move.clientX, y: move.clientY };
      if (held || Math.hypot(pointer.x - press.x, pointer.y - press.y) < GRAB_DISTANCE) return;
      held = true;
      react('held');
      svg.style.zIndex = '50';
      document.body.style.cursor = 'grabbing';
      if (reducedMotion()) return;
      cancelAnimationFrame(m.frame);
      last = performance.now();
      m.frame = requestAnimationFrame(step);
    };

    const onUp = () => {
      stopDrag.current?.();
      if (!held) {
        poke();
        return;
      }
      held = false;
      if (reducedMotion()) react(null);
    };

    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
      document.body.style.cursor = '';
      stopDrag.current = null;
    };
    // Released outside the window still counts as letting go.
    try {
      svg.setPointerCapture(event.pointerId);
    } catch { /* capture not available: the window listeners still work */ }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    stopDrag.current = stop;
  }, [enabled, svgRef, poke, play, react]);

  return { reaction, onPointerDown: enabled ? onPointerDown : undefined };
}
