let available: boolean | null = null;

// Whether this browser can draw the 3D scenes; pages fall back to flat art if not.
// Checked once per page load, and the probe's context is released straight away,
// so pages that ask more than once do not pile up idle WebGL contexts.
export function webglAvailable() {
  if (available !== null) return available;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    available = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    available = false;
  }
  return available;
}
