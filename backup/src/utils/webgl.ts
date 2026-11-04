import { useSyncExternalStore } from 'react';

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

// The person's own choice, kept per computer because it is about this computer's
// hardware: "auto" follows the graphics-chip check, "full" always draws the 3D
// scenes and animations, "lite" never does.
export type GraphicsChoice = 'auto' | 'full' | 'lite';
const CHOICE_KEY = 'cr-graphics';
const NOTICE_KEY = 'cr-graphics-notice-seen';
const CHANGE_EVENT = 'cr-graphics-change';

export function graphicsChoice(): GraphicsChoice {
  try {
    const value = localStorage.getItem(CHOICE_KEY);
    return value === 'full' || value === 'lite' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

// Whether WebGL works at all, even drawn on the processor: what "full" needs.
let anyWebgl: boolean | null = null;
function webglWorksAtAll() {
  if (anyWebgl !== null) return anyWebgl;
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    anyWebgl = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    anyWebgl = false;
  }
  return anyWebgl;
}

// Whether the 3D scenes, looping animations and blurred backgrounds run.
export function richGraphics(): boolean {
  const choice = graphicsChoice();
  if (choice === 'lite') return false;
  if (choice === 'full') return webglWorksAtAll();
  return webglAvailable();
}

// Light mode: no 3D, no looping animation and no blurred or drifting backgrounds,
// which are all redrawn on the processor without a graphics chip. Set on <html>
// before the app draws and again whenever the choice changes; index.css holds the rules.
export function applyLiteMode() {
  document.documentElement.classList.toggle('lite', !richGraphics());
}

export const liteMode = () => document.documentElement.classList.contains('lite');

export function setGraphicsChoice(choice: GraphicsChoice) {
  try {
    if (choice === 'auto') localStorage.removeItem(CHOICE_KEY);
    else localStorage.setItem(CHOICE_KEY, choice);
    localStorage.setItem(NOTICE_KEY, '1');
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  applyLiteMode();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Light mode came on by itself and the person has not yet said what they want.
export function liteNoticeDue(): boolean {
  if (graphicsChoice() !== 'auto' || webglAvailable()) return false;
  try {
    return localStorage.getItem(NOTICE_KEY) === null;
  } catch {
    return false;
  }
}

export function dismissLiteNotice() {
  try { localStorage.setItem(NOTICE_KEY, '1'); } catch { /* storage blocked */ }
}

// For components: re-renders when the choice changes, in this tab or another.
export function useRichGraphics(): boolean {
  return useSyncExternalStore((onChange) => {
    const onStorage = (event: StorageEvent) => { if (event.key === CHOICE_KEY) { applyLiteMode(); onChange(); } };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, richGraphics);
}
