import { runCubeScene, type CubeControl, type CubeOptions } from './cubeScene';
import { createRenderer } from './world/kit';

// Runs the clay cube on an OffscreenCanvas, off the page's main thread: creating
// the WebGL context, compiling shaders and drawing can all wait on the GPU, and
// here that wait never freezes the page. ClayCube.tsx is the other end.

export type CubeWorkerMessage =
  | { type: 'init'; canvas: OffscreenCanvas; options: CubeOptions; width: number; height: number; pixelRatio: number }
  | { type: 'resize'; width: number; height: number }
  | { type: 'pointer'; x: number; y: number }
  | { type: 'leave' }
  | { type: 'visible'; visible: boolean };

export type CubeWorkerEvent =
  | { type: 'started' }
  | { type: 'ready' }
  | { type: 'assembled' }
  | { type: 'hover'; over: boolean }
  | { type: 'levelUp' }
  | { type: 'failed' };

// The worker's global scope, typed by hand so this file can share the page's DOM types.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<CubeWorkerMessage>) => void) | null;
  postMessage(event: CubeWorkerEvent): void;
};

let control: CubeControl | null = null;

// A build that fails after it started (a lost context, say) hands the cube back to the page.
self.addEventListener('unhandledrejection', () => scope.postMessage({ type: 'failed' }));

scope.onmessage = ({ data }) => {
  if (data.type === 'init') {
    // Tells the page this worker is running; if this never arrives, it draws the cube itself.
    scope.postMessage({ type: 'started' });
    try {
      const renderer = createRenderer({ canvas: data.canvas, pixelRatio: data.pixelRatio });
      control = runCubeScene(renderer, data.options, {
        ready: () => scope.postMessage({ type: 'ready' }),
        assembled: () => scope.postMessage({ type: 'assembled' }),
        hover: (over) => scope.postMessage({ type: 'hover', over }),
        levelUp: () => scope.postMessage({ type: 'levelUp' }),
      });
      // The page terminates this worker when the cube unmounts, which frees the
      // context and everything on it, so there is no dispose message.
      control.resize(data.width, data.height);
    } catch {
      scope.postMessage({ type: 'failed' });
    }
    return;
  }
  if (!control) return;
  if (data.type === 'resize') control.resize(data.width, data.height);
  else if (data.type === 'pointer') control.pointer(data.x, data.y);
  else if (data.type === 'leave') control.leave();
  else if (data.type === 'visible') control.setVisible(data.visible);
};
