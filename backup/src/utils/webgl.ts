let available: boolean | null = null;

// Whether this browser can draw the 3D scenes; pages fall back to flat art if not.
// The probe's context is released straight away, so it never leaves an idle WebGL
// context behind.
// A browser with no usable graphics chip (a virtual machine, a remote desktop, a
// blocklisted driver) draws WebGL on the processor; one live scene there keeps the
// page busy every frame, so those browsers get the flat art too. Not every browser
// reports that as a performance caveat, so the renderer's name is checked as well.
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

// The answer is kept for a week per browser, so the graphics chip is asked once
// instead of on every page load (each check starts work in the browser's GPU process).
const SAVED_KEY = 'cr-3d-check';
const SAVED_FOR_MS = 7 * 24 * 3600e3;

function savedAnswer(): boolean | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null');
    if (saved && saved.ua === navigator.userAgent && Date.now() - saved.at < SAVED_FOR_MS) return Boolean(saved.ok);
  } catch {
    /* storage blocked or unreadable: check again */
  }
  return null;
}

export function webglAvailable() {
  if (available !== null) return available;
  available = savedAnswer();
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
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify({ ok: available, ua: navigator.userAgent, at: Date.now() }));
  } catch {
    /* storage blocked: the check simply runs again next time */
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
