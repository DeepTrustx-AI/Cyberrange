import { useEffect, useRef } from 'react';
import { CUBE_BLOCKS } from './clay';
import type { CubeControl, CubeEvents, CubeOptions } from './cubeScene';
import type { CubeWorkerEvent, CubeWorkerMessage } from './cubeWorker';

// The CyberRange cube in clay (the scene itself is in cubeScene.ts): the logo on
// the sign-in page, the student's progress on the dashboard. Where the browser
// allows it, the cube is drawn in a worker on an OffscreenCanvas, so setting up
// WebGL and compiling shaders never freezes the page; elsewhere it falls back to
// drawing on the page. This component only hosts the canvas and passes the size,
// pointer and visibility through.

interface ClayCubeProps {
  mode: 'logo' | 'progress';
  filled?: number;
  fresh?: number;
  dark: boolean;
  /** Logo mode: "full" on the first open of a session, "quick" afterwards. */
  intro?: 'full' | 'quick';
  /** Logo mode: keep breaking apart and joining back together. */
  loop?: boolean;
  /** Progress mode: the new blocks finished a cube; `previous` blocks of it were already there. */
  levelUp?: { previous: number } | null;
  onAssembled?: () => void;
  /** The live cube is drawn and fading in (a still picture in its place can go). */
  onReady?: () => void;
  onHover?: (hovering: boolean) => void;
  /** The finished cube starts its level-up celebration. */
  onLevelUp?: () => void;
  className?: string;
}

export default function ClayCube({ mode, filled = CUBE_BLOCKS, fresh = 0, dark, intro = 'full', loop = false, levelUp = null, onAssembled, onReady, onHover, onLevelUp, className }: ClayCubeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(onHover);
  const assembledRef = useRef(onAssembled);
  const levelUpRef = useRef(onLevelUp);
  const readyRef = useRef(onReady);
  useEffect(() => {
    hoverRef.current = onHover;
    assembledRef.current = onAssembled;
    levelUpRef.current = onLevelUp;
    readyRef.current = onReady;
  }, [onHover, onAssembled, onLevelUp, onReady]);
  const levelUpFrom = levelUp ? levelUp.previous : null;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const options: CubeOptions = {
      mode,
      filled,
      fresh,
      dark,
      intro,
      loop,
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      levelUp: levelUpFrom === null ? null : { previous: levelUpFrom },
    };
    const events: CubeEvents = {
      ready: () => readyRef.current?.(),
      assembled: () => assembledRef.current?.(),
      hover: (over) => hoverRef.current?.(over),
      levelUp: () => levelUpRef.current?.(),
    };
    // Started after the page has painted. React's StrictMode mounts twice in
    // development; the first mount is cancelled here before it starts anything.
    let teardown: (() => void) | undefined;
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        teardown = mountCube(host, options, events);
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      teardown?.();
    };
  }, [mode, filled, fresh, dark, intro, loop, levelUpFrom]);

  return <div ref={hostRef} className={`${mode === 'logo' ? 'cube-fade ' : ''}${className ?? ''}`} />;
}

const CANVAS_STYLE = 'display:block;width:100%;height:100%;opacity:0;transition:opacity 0.45s ease-out';

function workersCanDraw() {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
}

// Starts the cube in a worker, or on the page if that is not possible (or the
// worker reports it cannot draw), and wires the host to it. Returns the cleanup.
function mountCube(host: HTMLDivElement, options: CubeOptions, events: CubeEvents) {
  let control: CubeControl | null = null;
  let disposed = false;
  let width = host.clientWidth;
  let height = host.clientHeight;
  let intersecting = true;
  const visible = () => intersecting && !document.hidden;

  const startOnPage = () => {
    import('./cubeOnPage')
      .then(({ startCubeOnPage }) => {
        if (disposed) return;
        control = startCubeOnPage(host, options, events);
        control.resize(width, height);
        control.setVisible(visible());
      })
      .catch(() => events.assembled());
  };

  const startInWorker = () => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = CANVAS_STYLE;
    host.appendChild(canvas);
    let worker: Worker;
    try {
      worker = new Worker(new URL('./cubeWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      canvas.remove();
      return false;
    }
    const post = (message: CubeWorkerMessage, transfer: Transferable[] = []) => worker.postMessage(message, transfer);
    // A worker whose scripts never load (blocked by an extension or a proxy, say)
    // never says it started; the page draws the cube itself instead. The wait is
    // long because a slow connection is still downloading the worker, and falling
    // back there downloads three.js again and compiles on the page, which freezes
    // Firefox; the still picture holds the cube's place meanwhile.
    const watchdog = window.setTimeout(() => giveUp(), 20000);
    let gaveUp = false;
    const giveUp = () => {
      if (gaveUp) return;
      gaveUp = true;
      window.clearTimeout(watchdog);
      worker.terminate();
      canvas.remove();
      control = null;
      if (!disposed) startOnPage();
    };
    worker.onmessage = ({ data }: MessageEvent<CubeWorkerEvent>) => {
      if (data.type === 'started') window.clearTimeout(watchdog);
      else if (data.type === 'ready') {
        canvas.style.opacity = '1';
        events.ready();
      } else if (data.type === 'assembled') events.assembled();
      else if (data.type === 'hover') events.hover(data.over);
      else if (data.type === 'levelUp') events.levelUp();
      else giveUp();
    };
    worker.onerror = giveUp;
    const offscreen = canvas.transferControlToOffscreen();
    post({ type: 'init', canvas: offscreen, options, width, height, pixelRatio: Math.min(window.devicePixelRatio, 2) }, [offscreen]);
    control = {
      resize: (w, h) => post({ type: 'resize', width: w, height: h }),
      pointer: (x, y) => post({ type: 'pointer', x, y }),
      leave: () => post({ type: 'leave' }),
      setVisible: (next) => post({ type: 'visible', visible: next }),
      // Ending the worker frees its WebGL context and everything on it.
      dispose: () => {
        window.clearTimeout(watchdog);
        worker.terminate();
        canvas.remove();
      },
    };
    return true;
  };

  if (!workersCanDraw() || !startInWorker()) startOnPage();

  const sizeWatcher = new ResizeObserver(() => {
    width = host.clientWidth;
    height = host.clientHeight;
    control?.resize(width, height);
  });
  sizeWatcher.observe(host);
  const onVisibility = () => control?.setVisible(visible());
  const visibility = new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting;
    onVisibility();
  });
  visibility.observe(host);
  document.addEventListener('visibilitychange', onVisibility);
  // The cube follows a mouse anywhere on the page, not only over its own canvas, so
  // it does not drop back to idle as the pointer crosses to the form or an overlay.
  // Moves are sent once per frame, the latest one, however fast the events come.
  // Only a mouse or pen steers it: on a phone or tablet a finger scrolls the page and
  // taps, and the cube just plays its own animation.
  let pending: { x: number; y: number } | null = null;
  let moveFrame = 0;
  const sendMove = () => {
    moveFrame = 0;
    if (!pending) return;
    const rect = host.getBoundingClientRect();
    if (rect.width && rect.height) control?.pointer(((pending.x - rect.left) / rect.width) * 2 - 1, ((pending.y - rect.top) / rect.height) * 2 - 1);
    pending = null;
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    pending = { x: event.clientX, y: event.clientY };
    if (!moveFrame) moveFrame = requestAnimationFrame(sendMove);
  };
  const onLeave = () => {
    pending = null;
    control?.leave();
  };
  const onOut = (event: PointerEvent) => {
    if (!event.relatedTarget) onLeave();
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut);
  window.addEventListener('blur', onLeave);

  return () => {
    disposed = true;
    sizeWatcher.disconnect();
    visibility.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onOut);
    window.removeEventListener('blur', onLeave);
    cancelAnimationFrame(moveFrame);
    control?.dispose();
  };
}
