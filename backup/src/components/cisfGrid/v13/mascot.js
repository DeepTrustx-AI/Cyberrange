// Ported verbatim from UI-Integration-Workspace/pr/frontend origin/main commit 20817a360e652be6ec705b59476ae50c96a52ba4 (backup/src/components/mascot/Mascot.tsx and mascot.css).

export const MASCOT_SEAT = 92 / 120;

export const WEBSITE_POSES = ['idle', 'wave', 'walk', 'cheer', 'think', 'peek'];
export const LAB_POSES = ['point', 'hop', 'nod', 'phone'];
export const ALL_MASCOT_POSES = [...WEBSITE_POSES, ...LAB_POSES];

const BODY = 'M60 22 C88 22 99 29 99 57 C99 87 89 96 60 96 C31 96 21 87 21 57 C21 29 32 22 60 22 Z';

const DIR_LOOK = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

let seqId = 0;

export function createMascot({
  pose = 'idle',
  dir = null,
  size = 72,
  look = null,
  seated = false,
  className = '',
  label = '',
} = {}) {
  seqId += 1;
  const id = `mc${seqId}`;
  const safePose = ALL_MASCOT_POSES.includes(pose) ? pose : 'idle';
  const safeDir = dir && DIR_LOOK[dir] ? dir : null;
  const safeSize = Math.max(16, Math.min(240, Number(size) || 72));
  const effLook = look || (safePose === 'point' && safeDir && DIR_LOOK[safeDir]) || { x: 0, y: 0 };
  const wrap = document.createElement('div');
  const safeClass = String(className || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const poseCls = `mascot mascot--${safePose}${seated ? ' mascot--seated' : ''}${safeClass ? ` ${safeClass}` : ''}`;
  const dirAttr = safePose === 'point' && safeDir ? ` data-dir="${safeDir}"` : '';
  const safeLabel = String(label || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const roleAttrs = safeLabel ? ` role="img" aria-label="${safeLabel}"` : ' aria-hidden="true"';

  wrap.innerHTML = `<svg viewBox="0 0 120 120" class="${poseCls}" data-pose="${safePose}"${dirAttr}${roleAttrs} style="width:${safeSize}px;height:${safeSize}px;--look-x:${(effLook.x * 2.4).toFixed(2)}px;--look-y:${(effLook.y * 2).toFixed(2)}px" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="${id}-body"><path d="${BODY}"/></clipPath>
      <radialGradient id="${id}-shine" cx="0.32" cy="0.3" r="0.75">
        <stop offset="0" class="m-shine-in"/>
        <stop offset="1" class="m-shine-out"/>
      </radialGradient>
      <linearGradient id="${id}-arm-l" x1="0" y1="0" x2="1" y2="0.25">
        <stop offset="0" class="m-arm-l-lit"/>
        <stop offset="0.7" class="m-arm-l-base"/>
      </linearGradient>
      <linearGradient id="${id}-arm-r" x1="0" y1="0" x2="1" y2="0.25">
        <stop offset="0" class="m-arm-r-base"/>
        <stop offset="1" class="m-arm-r-rim"/>
      </linearGradient>
      <radialGradient id="${id}-mitt" cx="0.36" cy="0.32" r="0.72">
        <stop offset="0" class="m-mitt-lit"/>
        <stop offset="1" class="m-mitt-base"/>
      </radialGradient>
      <radialGradient id="${id}-mitt-shade" cx="0.36" cy="0.32" r="0.72">
        <stop offset="0" class="m-mitt-shade-lit"/>
        <stop offset="1" class="m-mitt-shade-base"/>
      </radialGradient>
    </defs>
    <ellipse class="m-shadow" cx="60" cy="111" rx="30" ry="4.5"/>
    <ellipse class="m-seat" cx="60" cy="92.5" rx="31" ry="2.6"/>
    <g class="m-poke">
      <g class="m-rig">
        <g class="m-leg m-leg-l">
          <rect class="m-limb-fill" x="39" y="84" width="14" height="20" rx="7"/>
          <ellipse class="m-limb-fill" cx="44" cy="104" rx="9" ry="5.6"/>
        </g>
        <g class="m-leg m-leg-r">
          <rect class="m-limb-fill" x="67" y="84" width="14" height="20" rx="7"/>
          <ellipse class="m-limb-fill" cx="76" cy="104" rx="9" ry="5.6"/>
        </g>
        <g class="m-arm m-arm-l">
          <path fill="url(#${id}-arm-l)" d="M19.5 56 C24 56 26.5 58.5 26 63 L24 79 C23.6 82 20.8 83.5 18.5 83.5 C16 83.5 13.4 82 13.2 79 L13 63 C12.8 58.5 15 56 19.5 56 Z"/>
          <ellipse fill="url(#${id}-mitt)" cx="18" cy="82" rx="7.2" ry="6.6"/>
        </g>
        <g class="m-arm m-arm-r">
          <path fill="url(#${id}-arm-r)" d="M100.5 56 C96 56 93.5 58.5 94 63 L96 79 C96.4 82 99.2 83.5 101.5 83.5 C104 83.5 106.6 82 106.8 79 L107 63 C107.2 58.5 105 56 100.5 56 Z"/>
          <ellipse fill="url(#${id}-mitt-shade)" cx="102" cy="82" rx="7.2" ry="6.6"/>
        </g>
        <g class="m-carry">
          <rect class="m-carry-block" x="47" y="2" width="26" height="22" rx="7"/>
          <rect class="m-carry-cap" x="47" y="2" width="26" height="8" rx="4"/>
        </g>
        <g class="m-body">
          <path class="m-front" d="${BODY}"/>
          <g clip-path="url(#${id}-body)">
            <path class="m-top" d="M10 10 H110 V35 C88 41 32 41 10 35 Z"/>
            <path class="m-side" d="M89 10 C94 38 94 72 88 104 H110 V10 Z"/>
            <path d="${BODY}" fill="url(#${id}-shine)"/>
          </g>
          <g class="m-face">
            <g class="m-eyes-open">
              <ellipse class="m-sclera" cx="47" cy="57" rx="8" ry="9.4"/>
              <ellipse class="m-sclera" cx="73" cy="57" rx="8" ry="9.4"/>
              <g class="m-pupils">
                <circle class="m-pupil" cx="47.6" cy="58.6" r="5.4"/>
                <circle class="m-pupil" cx="73.6" cy="58.6" r="5.4"/>
                <circle class="m-glint" cx="49.8" cy="55.6" r="2"/>
                <circle class="m-glint" cx="75.8" cy="55.6" r="2"/>
                <circle class="m-glint" cx="45.8" cy="61.6" r="1"/>
                <circle class="m-glint" cx="71.8" cy="61.6" r="1"/>
              </g>
            </g>
            <path class="m-eyes-happy" d="M40 59 Q47 50 54 59 M66 59 Q73 50 80 59"/>
            <path class="m-eyes-closed" d="M40 57 Q47 63.5 54 57 M66 57 Q73 63.5 80 57"/>
            <g class="m-eyes-dizzy">
              <path class="m-spiral m-spiral-l" d="M47 57 a1.2 1.2 0 0 1 2.4 0 a2.4 2.4 0 0 1 -4.8 0 a3.6 3.6 0 0 1 7.2 0 a4.8 4.8 0 0 1 -9.6 0"/>
              <path class="m-spiral m-spiral-r" d="M73 57 a1.2 1.2 0 0 1 2.4 0 a2.4 2.4 0 0 1 -4.8 0 a3.6 3.6 0 0 1 7.2 0 a4.8 4.8 0 0 1 -9.6 0"/>
            </g>
            <ellipse class="m-cheek" cx="35" cy="69" rx="6" ry="3.4"/>
            <ellipse class="m-cheek" cx="85" cy="69" rx="6" ry="3.4"/>
            <path class="m-mouth m-mouth-smile" d="M55 69 Q60 74.5 65 69"/>
            <g class="m-mouth-open">
              <path class="m-mouth-fill" d="M53 68 Q60 69.6 67 68 Q66.4 78.5 60 78.5 Q53.6 78.5 53 68 Z"/>
              <ellipse class="m-tongue" cx="60" cy="75.6" rx="3.6" ry="2.2"/>
            </g>
            <path class="m-mouth m-mouth-flat" d="M56 71 Q60 69.6 64 71"/>
          </g>
        </g>
        <g class="m-cover">
          <g class="m-cover-l">
            <rect class="m-arm-cover" x="20" y="60" width="12" height="22" rx="6" transform="rotate(-38 26 71)"/>
            <ellipse fill="url(#${id}-mitt)" cx="46" cy="57" rx="11.4" ry="11.2"/>
          </g>
          <g class="m-cover-r">
            <rect class="m-arm-cover" x="88" y="60" width="12" height="22" rx="6" transform="rotate(38 94 71)"/>
            <ellipse fill="url(#${id}-mitt)" cx="74" cy="57" rx="11.4" ry="11.2"/>
          </g>
        </g>
        <g class="m-phone">
          <rect class="m-arm-cover" x="92" y="54" width="11" height="20" rx="5.5" transform="rotate(24 97 64)"/>
          <rect class="m-phone-handset" x="88" y="38" width="13" height="28" rx="4.5" transform="rotate(14 94 52)"/>
          <rect class="m-phone-cap" x="90" y="40" width="9" height="6" rx="2.5" transform="rotate(14 94 52)"/>
          <ellipse fill="url(#${id}-mitt-shade)" cx="95" cy="58" rx="7.6" ry="6.8"/>
        </g>
        <g class="m-notes">
          <g class="m-note">
            <ellipse cx="93" cy="22" rx="2.8" ry="2.1"/>
            <path d="M95.6 21.6 V11 l4.6 -1.6"/>
          </g>
          <g class="m-note">
            <ellipse cx="103" cy="12" rx="2.6" ry="2"/>
            <path d="M105.4 11.6 V2 l4.2 -1.4 V9"/>
            <ellipse cx="107.2" cy="9.4" rx="2.6" ry="2"/>
          </g>
        </g>
        <g class="m-zzz">
          <path d="M94 16 h7 l-7 8 h7"/>
          <path d="M104 4 h5 l-5 6 h5"/>
        </g>
      </g>
    </g>
    <path class="m-heart" d="M60 18 C54 14 52.5 11.5 52.5 9.5 C52.5 7 54.5 5.5 56.5 5.5 C58 5.5 59.3 6.4 60 7.8 C60.7 6.4 62 5.5 63.5 5.5 C65.5 5.5 67.5 7 67.5 9.5 C67.5 11.5 66 14 60 18 Z"/>
  </svg>`;
  return wrap.firstElementChild;
}

export function setMascotPose(svgEl, pose = 'idle', dir = null, look = null) {
  if (!svgEl) return;
  const safePose = ALL_MASCOT_POSES.includes(pose) ? pose : 'idle';
  ALL_MASCOT_POSES.forEach((p) => svgEl.classList.remove(`mascot--${p}`));
  svgEl.classList.add(`mascot--${safePose}`);
  svgEl.dataset.pose = safePose;
  if (safePose === 'point' && dir && DIR_LOOK[dir]) {
    svgEl.setAttribute('data-dir', dir);
  } else {
    svgEl.removeAttribute('data-dir');
  }
  const effLook = look || (safePose === 'point' && dir && DIR_LOOK[dir]) || { x: 0, y: 0 };
  svgEl.style.setProperty('--look-x', `${(effLook.x * 2.4).toFixed(2)}px`);
  svgEl.style.setProperty('--look-y', `${(effLook.y * 2).toFixed(2)}px`);
}

export function isReducedMotion() {
  return document.documentElement.dataset.reducedMotion === 'true'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function hopMascot(el, fromRect, toRect) {
  if (!el || !fromRect || !toRect || isReducedMotion() || typeof el.animate !== 'function') {
    return Promise.resolve();
  }
  const dx = fromRect.left - toRect.left;
  const dy = fromRect.top - toRect.top;
  if (Math.hypot(dx, dy) < 6) return Promise.resolve();
  const arcH = Math.min(72, Math.max(26, Math.hypot(dx, dy) * 0.22));
  const midX = dx * 0.5;
  const midY = dy * 0.5 - arcH;
  const anim = el.animate(
    [
      { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(1.08, 0.88)`, offset: 0 },
      { transform: `translate(${(dx * 0.82).toFixed(1)}px, ${(dy * 0.82 - arcH * 0.45).toFixed(1)}px) scale(0.95, 1.07)`, offset: 0.2 },
      { transform: `translate(${midX.toFixed(1)}px, ${midY.toFixed(1)}px) scale(0.97, 1.04)`, offset: 0.5 },
      { transform: 'translate(0px, 0px) scale(1.09, 0.87)', offset: 0.84 },
      { transform: 'translate(0px, 0px) scale(1, 1)', offset: 1 },
    ],
    { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  );
  return anim.finished.catch(() => {});
}
