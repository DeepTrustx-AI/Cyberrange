import { useEffect, useRef } from 'react';
import { Scene } from 'three';
import type { LabArtKind } from '../../utils/labArtKind';
import { buildDiorama } from '../three/world/dioramas';
import { borrowRenderer, compileInParallel, disposeTree, lightScene, studioEnvironment } from '../three/world/kit';
import { ART_HEIGHT, ART_WIDTH, POSE_TIME, artCamera, artFloor } from './labArtRenderer';

interface LiveDioramaProps {
  kind: LabArtKind;
  dark: boolean;
  /** Called with true once the first live frame is on screen, and false when it goes. */
  onReady?: (ready: boolean) => void;
  className?: string;
}

// A lab's clay scene, running live: it plays its idle animation and turns a
// little toward the pointer. It is framed and posed exactly like the still card
// art and only appears once its first frame is drawn, so the still underneath can
// be hidden at that moment (onReady) without a jump or a second copy showing.
export default function LiveDiorama({ kind, dark, onReady, className = '' }: LiveDioramaProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Built a frame later, so StrictMode's first, discarded mount in development
    // never creates a WebGL context.
    let teardown: (() => void) | undefined;
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        teardown = runDiorama(host, kind, dark, readyRef);
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      teardown?.();
    };
  }, [kind, dark]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}

function runDiorama(host: HTMLDivElement, kind: LabArtKind, dark: boolean, readyRef: { current: LiveDioramaProps['onReady'] }) {
  let lease: ReturnType<typeof borrowRenderer>;
  try {
    lease = borrowRenderer('live', { pixelRatio: 2 });
  } catch {
    return undefined;
  }
  const renderer = lease.renderer;
  renderer.setSize(ART_WIDTH, ART_HEIGHT, false);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;visibility:hidden';
  host.appendChild(canvas);
  let disposed = false;
  let shown = false;

  const scene = new Scene();
  scene.add(artFloor(dark));
  const diorama = buildDiorama(kind, dark);
  // The still's pose, which is also all a reduced-motion visitor sees.
  diorama.animate(POSE_TIME);
  scene.add(diorama.group);
  const camera = artCamera();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = { x: 0 };
  const onMove = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
  };
  window.addEventListener('pointermove', onMove);

  let start = 0;
  let frame = 0;
  const tick = (now: number) => {
    const t = POSE_TIME + (now - start) / 1000;
    if (!reduced) {
      diorama.animate(t);
      diorama.group.rotation.y += (pointer.x * 0.45 - diorama.group.rotation.y) * 0.08;
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };

  // Light the scene and compile its shaders off the main thread; the first frame
  // is drawn and shown in the same task, and matches the still image exactly.
  void (async () => {
    const environment = await studioEnvironment(renderer);
    if (disposed) return;
    lightScene(scene, environment, dark, 5);
    await compileInParallel(renderer, scene, camera);
    if (disposed) return;
    start = performance.now();
    tick(start);
    canvas.style.visibility = 'visible';
    shown = true;
    readyRef.current?.(true);
  })();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', onMove);
    if (shown) readyRef.current?.(false);
    disposeTree(scene);
    canvas.remove();
    lease.giveBack();
  };
}
