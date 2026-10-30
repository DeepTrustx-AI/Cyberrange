import { runCubeScene, type CubeControl, type CubeEvents, type CubeOptions } from './cubeScene';
import { borrowRenderer } from './world/kit';

// The cube on the page's own thread, for browsers that cannot draw WebGL in a
// worker. It borrows the kept "cube" renderer, so a later cube (the dashboard's,
// or the sign-in page's after signing out) reuses its context and studio light.
export function startCubeOnPage(host: HTMLElement, options: CubeOptions, events: CubeEvents): CubeControl {
  const lease = borrowRenderer('cube');
  const canvas = lease.renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;opacity:0;transition:opacity 0.45s ease-out';
  host.appendChild(canvas);
  const control = runCubeScene(lease.renderer, options, {
    ...events,
    ready: () => {
      canvas.style.opacity = '1';
      events.ready();
    },
  });
  return {
    ...control,
    dispose() {
      control.dispose();
      canvas.remove();
      lease.giveBack();
    },
  };
}
