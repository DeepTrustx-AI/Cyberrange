let available: boolean | null = null;

// Whether this browser can draw the 3D scenes; pages fall back to flat art if not.
// Checked once per page load, and the probe's context is released straight away,
// so pages that ask more than once do not pile up idle WebGL contexts.
// A browser with no usable graphics chip (a virtual machine, a remote desktop, a
// blocklisted driver) draws WebGL on the processor; one live scene there keeps the
// page busy every frame, so those browsers get the flat art too. Not every browser
// reports that as a performance caveat, so the renderer's name is checked as well.
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function webglAvailable() {
  if (available !== null) return available;
  try {
    const canvas = document.createElement('canvas');
    const options: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true };
    const gl = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    available = Boolean(gl) && !SOFTWARE_RENDERER.test(renderer);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    available = false;
  }
  return available;
}

// Light mode, for the same computers: no 3D, no looping animation and no blurred
// or drifting backgrounds, which are all redrawn on the processor there. Set once
// on <html> before the app draws; index.css holds the rules.
export function applyLiteMode() {
  if (!webglAvailable()) document.documentElement.classList.add('lite');
}

export const liteMode = () => document.documentElement.classList.contains('lite');
