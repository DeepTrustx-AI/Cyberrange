export const STAGE_BASE_W = 1120;
export const STAGE_BASE_H = 620;

export function mapStageX(x, vw = STAGE_BASE_W) {
  const scale = vw / STAGE_BASE_W;
  return vw * 0.5 + (x - STAGE_BASE_W * 0.5) * scale;
}

export function computeBayCardWidth(vw = STAGE_BASE_W) {
  return Math.round(Math.min(204, Math.max(164, 164 + (vw - STAGE_BASE_W) * 0.08)));
}

export function computeZoneCardWidth(vw = STAGE_BASE_W) {
  return Math.round(Math.min(620, Math.max(436, 436 + (vw - STAGE_BASE_W) * 0.28)));
}

export const CAMERA_PRESETS = {
  m1: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'city' },
  m2: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'substation' },
  m3: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'network' },
  m4: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'city' },
  m5: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'substation' },
  m6: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'network' },
  m7: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'network' },
  m8: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'network' },
  m9: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'substation' },
  m10: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'network' },
  full_op: { transform: 'translate(0%, 0%) scale(1)', label: 'Suryanagar 220/132/33 kV', defaultView: 'city' },
};

export const BAY_SLOTS = [
  { idx: 0, bayX: 104, bayY: 538, cityX: 200, cityY: 172, distId: 'dist-hospital', sprite: 'hospital', shortName: 'Hospital', fullName: 'Trauma Hospital' },
  { idx: 1, bayX: 282, bayY: 538, cityX: 560, cityY: 172, distId: 'dist-water', sprite: 'water', shortName: 'Water Works', fullName: 'Water Works' },
  { idx: 2, bayX: 460, bayY: 538, cityX: 920, cityY: 172, distId: 'dist-metro', sprite: 'metro', shortName: 'Metro', fullName: 'Metro Rail' },
  { idx: 3, bayX: 660, bayY: 538, cityX: 200, cityY: 438, distId: 'dist-airport', sprite: 'airport', shortName: 'Airport', fullName: 'Airport ATC' },
  { idx: 4, bayX: 838, bayY: 538, cityX: 560, cityY: 438, distId: 'dist-industrial', sprite: 'industrial', shortName: 'Industrial Corridor', fullName: 'Industrial Corridor' },
  { idx: 5, bayX: 1016, bayY: 538, cityX: 920, cityY: 438, distId: 'dist-municipal', sprite: 'municipal', shortName: 'Municipal', fullName: 'Municipal Blocks' },
];

export const SHIELD_POINTS = {
  'corp-dmz': { x: 560, y: 148, vertical: true },
  'dmz-field': { x: 862, y: 306, vertical: false },
  'corp-field': { x: 258, y: 306, vertical: false },
  'ctrl-field': { x: 560, y: 464, vertical: true },
};

function buildCityDistrictArt(s, p, distLitCls, base) {
  const x = s.cityX - 108;
  const y = s.cityY - 104;
  const dieselImg = s.sprite === 'hospital'
    ? `<image href="${base}/hospital-diesel-light.webp" data-sprite="hospital-diesel" x="${x}" y="${y}" width="216" height="184" class="clay-sprite city-sprite sprite-diesel" preserveAspectRatio="xMidYMid meet"/>`
    : '';
  return `
    <g class="${distLitCls}" id="${p}${s.distId}">
      <ellipse cx="${s.cityX}" cy="${s.cityY + 42}" rx="100" ry="34" class="city-pad-halo"/>
      <image href="${base}/${s.sprite}-dark-light.webp" data-sprite="${s.sprite}-dark" x="${x}" y="${y}" width="216" height="184" class="clay-sprite city-sprite sprite-dark" preserveAspectRatio="xMidYMid meet"/>
      <image href="${base}/${s.sprite}-lit-light.webp" data-sprite="${s.sprite}-lit" x="${x}" y="${y}" width="216" height="184" class="clay-sprite city-sprite sprite-lit" preserveAspectRatio="xMidYMid meet"/>
      ${dieselImg}
    </g>`;
}

function buildCityDistrictLabels(s, p) {
  return `
    <g class="city-label-group ${p ? 'is-lit' : ''}" id="${p}lbl-${s.distId}">
      <text x="${s.cityX}" y="${s.cityY + 92}" text-anchor="middle" class="city-studio-title">${s.fullName}</text>
      <text x="${s.cityX}" y="${s.cityY + 112}" text-anchor="middle" class="city-studio-status" id="${p}dist-status-${s.idx + 1}">${p ? 'Energized' : 'Unknown'}</text>
    </g>`;
}

function buildSwitchgearCardArt(s, p, blindedLensCopy) {
  const left = s.bayX - 82;
  const top = s.bayY - 52;
  const closedCls = blindedLensCopy ? 'is-closed' : '';
  const attrs = blindedLensCopy ? '' : `role="button" tabindex="0" aria-label="33 kV bay ${s.idx + 1}"`;
  return `
    <g class="breaker-node ${closedCls}" id="${p}bay-${s.idx + 1}" ${attrs}>
      <rect x="${left}" y="${top + 3}" width="164" height="104" rx="12" class="breaker-shadow"/>
      <rect x="${left}" y="${top}" width="164" height="104" rx="12" class="breaker-box"/>
      <rect x="${left + 12}" y="${top + 6}" width="140" height="4.5" rx="2.2" class="breaker-bar"/>
      <rect x="${left + 14}" y="${top + 18}" width="24" height="24" rx="5" class="breaker-well"/>
      <rect x="${left + 18}" y="${top + 22}" width="16" height="16" rx="2" class="iec-cb-square"/>
    </g>`;
}

function buildSwitchgearCardLabels(s, p) {
  const left = s.bayX - 82;
  const top = s.bayY - 52;
  return `
    <g class="bay-label-group" id="${p}bay-lbl-grp-${s.idx + 1}">
      <text x="${left + 46}" y="${top + 35}" text-anchor="start" class="bay-card-id tabular" id="${p}bay-id-${s.idx + 1}">BAY-0${s.idx + 1}</text>
      <text x="${left + 14}" y="${top + 64}" text-anchor="start" class="bay-card-title" id="${p}bay-label-${s.idx + 1}">33 kV Feeder</text>
      <text x="${left + 14}" y="${top + 86}" text-anchor="start" class="bay-card-sub" id="${p}bay-sub-${s.idx + 1}">Open · Unmapped</text>
    </g>`;
}

function sanitizeAssetBase(assetBase) {
  return String(assetBase || './assets')
    .replace(/\/+$/, '')
    .replace(/["'<>]/g, '');
}

export function buildSceneSVG(blindedLensCopy = false, assetBase = './assets') {
  const p = blindedLensCopy ? 'lens-' : '';
  const base = sanitizeAssetBase(assetBase);
  const distLitCls = blindedLensCopy ? 'district-group is-lit' : 'district-group';

  return `
<svg viewBox="0 0 1120 620" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" id="${p}living-grid-svg">
  <defs>
    <radialGradient id="${p}grad-city-studio" cx="50%" cy="42%" r="68%">
      <stop offset="0%" class="city-ground-in"/>
      <stop offset="100%" class="city-ground-out"/>
    </radialGradient>

    <radialGradient id="${p}grad-hmi-studio" cx="50%" cy="40%" r="68%">
      <stop offset="0%" class="hmi-ground-in"/>
      <stop offset="100%" class="hmi-ground-out"/>
    </radialGradient>

    <radialGradient id="${p}grad-horizon-glow" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#e9c496" stop-opacity="0.1" id="${p}freq-glow-stop"/>
      <stop offset="100%" stop-color="#e9c496" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="${p}grad-tr-calm" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#d4b48c" stop-opacity="0.34"/>
      <stop offset="60%" stop-color="#c49a68" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#c49a68" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="${p}grad-tr-warn" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#efa956" stop-opacity="0.72"/>
      <stop offset="60%" stop-color="#d88134" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#d88134" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="${p}grad-tr-hot" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e0584c" stop-opacity="0.82"/>
      <stop offset="60%" stop-color="#c93b32" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#c93b32" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="${p}grad-shield" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4e9c7a" stop-opacity="0.44"/>
      <stop offset="100%" stop-color="#4e9c7a" stop-opacity="0.12"/>
    </linearGradient>

    <linearGradient id="${p}grad-shield-h" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4e9c7a" stop-opacity="0.12"/>
      <stop offset="50%" stop-color="#4e9c7a" stop-opacity="0.44"/>
      <stop offset="100%" stop-color="#4e9c7a" stop-opacity="0.12"/>
    </linearGradient>
  </defs>

  <g id="${p}view-city" class="scene-view is-active">
    <rect x="0" y="0" width="1120" height="620" fill="url(#${p}grad-city-studio)" data-stage-bg="1"/>
    <ellipse cx="560" cy="310" rx="520" ry="250" fill="url(#${p}grad-horizon-glow)" id="${p}city-horizon-glow"/>
    <g id="${p}layer-skyline" class="scene-layer">
      ${BAY_SLOTS.map((s) => buildCityDistrictArt(s, p, distLitCls, base)).join('')}
    </g>
  </g>

  <g id="${p}view-substation" class="scene-view">
    <rect x="0" y="0" width="1120" height="620" fill="url(#${p}grad-hmi-studio)" data-stage-bg="1"/>
    <g id="${p}layer-switchyard" class="scene-layer">
      <g id="${p}layer-hv" class="scene-layer">
        <image href="${base}/hv-gantry-light.webp" data-sprite="hv-gantry" x="492" y="4" width="136" height="86" class="clay-sprite" preserveAspectRatio="xMidYMid meet"/>
        <line x1="560" y1="86" x2="560" y2="108" class="hv-line"/>
        <line x1="552" y1="97" x2="568" y2="97" class="iec-isolator"/>
        <g class="tie-assembly breaker-node" id="${p}cb-220-tie1" ${blindedLensCopy ? '' : 'role="button" tabindex="0" aria-label="CB-220-TIE1 220 kV tie breaker"'}>
          <rect x="518" y="108" width="84" height="28" rx="7" class="breaker-box"/>
          <rect x="550" y="112" width="20" height="20" rx="2" class="iec-cb-square"/>
        </g>
        <line x1="560" y1="136" x2="560" y2="168" class="hv-line" id="${p}tie-stem-lower"/>
      </g>

      <line x1="520" y1="168" x2="960" y2="168" class="busbar-220" id="${p}bus-220-a"/>

      <g id="${p}gen-132-unit">
        <image href="${base}/gen-unit-light.webp" data-sprite="gen-unit" x="117" y="194" width="146" height="106" class="clay-sprite" preserveAspectRatio="xMidYMid meet"/>
        <circle cx="285" cy="246" r="14" class="iec-sym-ring"/>
        <path d="M 277 246 Q 281 238 285 246 T 293 246" class="iec-sym-stroke"/>
        <line x1="190" y1="350" x2="190" y2="386" class="busbar-132 is-live" id="${p}gen-stem"/>
      </g>

      <g id="${p}tr-1-unit">
        <circle cx="560" cy="250" r="76" fill="url(#${p}grad-tr-calm)" class="tr-glow" id="${p}tr1-glow"/>
        <line x1="560" y1="168" x2="560" y2="204" class="hv-line is-live"/>
        <image href="${base}/tr-unit-light.webp" data-sprite="tr-unit" x="487" y="196" width="146" height="106" class="clay-sprite" preserveAspectRatio="xMidYMid meet"/>
        <circle cx="656" cy="238" r="10" class="iec-sym-ring"/>
        <circle cx="656" cy="253" r="10" class="iec-sym-ring"/>
        <line x1="560" y1="350" x2="560" y2="386" class="busbar-132 is-live" id="${p}tr1-lv-stem"/>
      </g>

      <g id="${p}tr-2-unit" class="breaker-node" ${blindedLensCopy ? '' : 'role="button" tabindex="0" aria-label="TR-2 standby transformer"'}>
        <circle cx="930" cy="250" r="76" fill="url(#${p}grad-tr-calm)" class="tr-glow" id="${p}tr2-glow"/>
        <line x1="930" y1="168" x2="930" y2="204" class="hv-line" id="${p}tr2-hv-b"/>
        <image href="${base}/tr-unit-light.webp" data-sprite="tr-unit" x="857" y="196" width="146" height="106" class="clay-sprite" preserveAspectRatio="xMidYMid meet"/>
        <circle cx="1026" cy="238" r="10" class="iec-sym-ring"/>
        <circle cx="1026" cy="253" r="10" class="iec-sym-ring"/>
        <line x1="930" y1="350" x2="930" y2="386" class="busbar-132" id="${p}tr2-lv-stem"/>
      </g>

      <line x1="135" y1="386" x2="985" y2="386" class="busbar-132 is-live" id="${p}bus-132-b"/>

      <line x1="340" y1="386" x2="340" y2="442" class="busbar-33 is-live" id="${p}drop-c1"/>
      <line x1="780" y1="386" x2="780" y2="442" class="busbar-33 is-live" id="${p}drop-c2"/>

      <line x1="24" y1="442" x2="518" y2="442" class="busbar-33 is-live" id="${p}bus-33-c1"/>
      <line x1="602" y1="442" x2="1096" y2="442" class="busbar-33 is-live" id="${p}bus-33-c2"/>
      <line x1="518" y1="442" x2="532" y2="442" class="busbar-33 is-live" id="${p}bc1-stub-l"/>
      <line x1="588" y1="442" x2="602" y2="442" class="busbar-33 is-live" id="${p}bc1-stub-r"/>
      <g class="breaker-node is-closed" id="${p}bc1-coupler">
        <rect x="532" y="428" width="56" height="28" rx="6" class="breaker-box"/>
        <rect x="552" y="434" width="16" height="16" rx="2" class="iec-cb-square" id="${p}bc1-led"/>
      </g>

      <g id="${p}feeder-lines" class="${blindedLensCopy ? 'is-masked' : ''}">
        <path id="${p}line-1" d="M 104 442 L 104 486" class="feeder-line"/>
        <path id="${p}line-2" d="M 282 442 L 282 486" class="feeder-line"/>
        <path id="${p}line-3" d="M 460 442 L 460 486" class="feeder-line"/>
        <path id="${p}line-4" d="M 660 442 L 660 486" class="feeder-line"/>
        <path id="${p}line-5" d="M 838 442 L 838 486" class="feeder-line"/>
        <path id="${p}line-6" d="M 1016 442 L 1016 486" class="feeder-line"/>
      </g>

      <g id="${p}feeder-bays">
        ${BAY_SLOTS.map((s) => buildSwitchgearCardArt(s, p, blindedLensCopy)).join('')}
      </g>
    </g>
  </g>

  <g id="${p}view-network" class="scene-view">
    <rect x="0" y="0" width="1120" height="620" fill="url(#${p}grad-hmi-studio)" data-stage-bg="1"/>
    <g id="${p}layer-purdue" class="scene-layer">
      <path id="${p}comms-corp-dmz" d="M 476 148 L 644 148" class="comms-line"/>
      <path id="${p}comms-hist" d="M 862 258 L 862 354" class="comms-line"/>
      <path id="${p}comms-dmz-field" d="M 664 252 L 456 360" class="comms-line" opacity="0.34"/>
      <path id="${p}comms-corp-field" d="M 258 258 L 258 354" class="comms-line" opacity="0.34"/>
      <path id="${p}comms-rtu1" d="M 644 452 L 476 452" class="comms-line"/>
      <path id="${p}comms-rtu2" d="M 644 476 L 476 476" class="comms-line"/>

      <g id="${p}zone-corp">
        <rect x="40" y="38" width="436" height="220" rx="18" class="zone-card" id="${p}zone-rect-corp"/>
        <image href="${base}/zone-corp-light.webp" data-sprite="zone-corp" x="150" y="42" width="216" height="146" class="clay-sprite" id="${p}zone-img-corp" preserveAspectRatio="xMidYMid meet"/>
      </g>

      <g id="${p}zone-dmz">
        <rect x="644" y="38" width="436" height="220" rx="18" class="zone-card" id="${p}zone-rect-dmz"/>
        <image href="${base}/zone-dmz-light.webp" data-sprite="zone-dmz" x="754" y="42" width="216" height="146" class="clay-sprite" id="${p}zone-img-dmz" preserveAspectRatio="xMidYMid meet"/>
      </g>

      <g id="${p}zone-field">
        <rect x="40" y="354" width="436" height="220" rx="18" class="zone-card" id="${p}zone-rect-field"/>
        <image href="${base}/zone-field-light.webp" data-sprite="zone-field" x="150" y="358" width="216" height="146" class="clay-sprite" id="${p}zone-img-field" preserveAspectRatio="xMidYMid meet"/>
      </g>

      <g id="${p}zone-control">
        <rect x="644" y="354" width="436" height="220" rx="18" class="zone-card" id="${p}zone-rect-control"/>
        <image href="${base}/zone-control-light.webp" data-sprite="zone-control" x="754" y="354" width="216" height="146" class="clay-sprite" id="${p}zone-img-control" preserveAspectRatio="xMidYMid meet"/>
        <g id="${p}cr-screens-grp">
          <rect x="776" y="498" width="38" height="8" rx="4" class="cr-screen" id="${p}cr-scr-1"/>
          <rect x="821" y="498" width="38" height="8" rx="4" class="cr-screen" id="${p}cr-scr-2"/>
          <rect x="866" y="498" width="38" height="8" rx="4" class="cr-screen" id="${p}cr-scr-3"/>
          <rect x="911" y="498" width="38" height="8" rx="4" class="cr-screen" id="${p}cr-scr-4"/>
        </g>
      </g>

      <g class="purdue-shield" id="${p}shield-corp-dmz">
        <rect x="552" y="72" width="16" height="152" rx="8" class="shield-pane"/>
        <rect x="556" y="67" width="8" height="6" rx="3" class="shield-cap"/>
      </g>

      <g class="purdue-shield purdue-shield-h" id="${p}shield-dmz-field">
        <rect x="682" y="298" width="360" height="16" rx="8" class="shield-pane-h"/>
      </g>

      <g class="purdue-shield purdue-shield-h" id="${p}shield-corp-field">
        <rect x="78" y="298" width="360" height="16" rx="8" class="shield-pane-h"/>
      </g>

      <g class="purdue-shield" id="${p}shield-ctrl-field">
        <rect x="552" y="388" width="16" height="152" rx="8" class="shield-pane"/>
        <rect x="556" y="383" width="8" height="6" rx="3" class="shield-cap"/>
        <rect x="548" y="442" width="24" height="44" rx="6" fill="var(--surface)" stroke="var(--brk-open)" stroke-width="1.8"/>
      </g>
    </g>
  </g>
</svg>`;
}

export function buildLabelsSVG(blindedLensCopy = false) {
  const p = blindedLensCopy ? 'lens-' : '';
  return `
<svg viewBox="0 0 1120 620" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" id="${p}living-labels-svg" class="scene-labels-svg">
  <g id="${p}lbl-view-city" class="scene-view is-active">
    ${BAY_SLOTS.map((s) => buildCityDistrictLabels(s, p)).join('')}
  </g>

  <g id="${p}lbl-view-substation" class="scene-view">
    <text x="614" y="127" text-anchor="start" class="studio-sub-strong" id="${p}lbl-tie1">CB-220-TIE1</text>
    <text x="506" y="173" text-anchor="end" class="bus-caption bus-caption-220" id="${p}lbl-bus-220">220 kV Bus-A</text>
    <text x="22" y="391" text-anchor="start" class="bus-caption bus-caption-132">132 kV Bus-B</text>
    <text x="24" y="430" text-anchor="start" class="bus-caption bus-caption-33">33 kV Bus-C1</text>
    <text x="560" y="420" text-anchor="middle" class="bus-caption bus-caption-bc" id="${p}lbl-bc1">BC-1</text>
    <text x="1096" y="430" text-anchor="end" class="bus-caption bus-caption-33" id="${p}lbl-bus-33-c2">33 kV Bus-C2</text>

    <g id="${p}gen-lbl-grp">
      <circle cx="122" cy="315" r="4.5" fill="var(--brk-closed)" id="${p}gen-led"/>
      <text x="190" y="320" text-anchor="middle" class="studio-title">GEN-132-GT1</text>
      <text x="190" y="340" text-anchor="middle" class="studio-status" id="${p}gen-svg-hz">42 MW island turbine</text>
    </g>

    <g id="${p}tr1-lbl-grp">
      <text x="560" y="320" text-anchor="middle" class="studio-title">TR-1 · <tspan id="${p}tr1-svg-pct">${blindedLensCopy ? '86%' : '0%'}</tspan></text>
      <text x="560" y="340" text-anchor="middle" class="studio-status">50 MVA primary</text>
    </g>

    <g class="lockout-badge" id="${p}tr1-lockout-86">
      <rect x="356" y="232" width="116" height="28" rx="14" fill="var(--rose-500)"/>
      <text x="414" y="251" text-anchor="middle" font-size="13.5" font-weight="700" fill="#ffffff">Lockout 86</text>
    </g>

    <g id="${p}tr2-lbl-grp">
      <text x="930" y="320" text-anchor="middle" class="studio-title">TR-2 · <tspan id="${p}tr2-svg-pct">Standby</tspan></text>
      <text x="930" y="340" text-anchor="middle" class="studio-status">50 MVA parallel</text>
    </g>

    ${BAY_SLOTS.map((s) => buildSwitchgearCardLabels(s, p)).join('')}

    <g id="${p}cable-gallery-mask" class="cable-gallery ${blindedLensCopy ? 'is-active' : ''}">
      <text x="560" y="611" text-anchor="middle" class="gallery-text" id="${p}lbl-gallery-text">33 kV underground cable gallery (feeder-to-district routing unmapped)</text>
    </g>
  </g>

  <g id="${p}lbl-view-network" class="scene-view">
    <g id="${p}lbl-zone-corp">
      <text x="258" y="214" text-anchor="middle" class="studio-title">L4 Corporate</text>
      <text x="258" y="236" text-anchor="middle" class="studio-status">Enterprise IT · 10.204.10.0/24</text>
    </g>

    <g id="${p}lbl-zone-dmz">
      <text x="862" y="214" text-anchor="middle" class="studio-title">L3.5 OT DMZ</text>
      <text x="862" y="236" text-anchor="middle" class="studio-status">Historian :8085 · Jump :8086 · 10.204.20.0/24</text>
    </g>

    <g id="${p}lbl-zone-field">
      <text x="258" y="530" text-anchor="middle" class="studio-title">L1/L2 Field tap</text>
      <text x="258" y="552" text-anchor="middle" class="studio-status">RTU-1 / RTU-2 · 10.204.30.0/24</text>
    </g>

    <g id="${p}lbl-zone-control">
      <text x="862" y="530" text-anchor="middle" class="studio-title">L3 Control room</text>
      <text x="862" y="552" text-anchor="middle" class="studio-status">SCADA Master · 10.204.25.0/24</text>
    </g>

    <text x="560" y="56" text-anchor="middle" class="shield-label-pill" id="${p}lbl-shield-corp-dmz">L4 / DMZ</text>
    <text x="762" y="286" text-anchor="middle" class="shield-label-pill" id="${p}lbl-shield-dmz-field">DMZ / Field 2404</text>
    <text x="358" y="286" text-anchor="middle" class="shield-label-pill" id="${p}lbl-shield-corp-field">L4 / OT Direct</text>
    <text x="560" y="568" text-anchor="middle" class="shield-label-pill" id="${p}lbl-shield-ctrl-field">L3 / L1 · 2404</text>
  </g>
</svg>`;
}

function setTranslateX(id, dx) {
  const node = document.getElementById(id);
  if (!node) return;
  if (Math.abs(dx) < 0.05) {
    node.removeAttribute('transform');
  } else {
    node.setAttribute('transform', `translate(${dx.toFixed(1)}, 0)`);
  }
}

function setAttrIfFound(id, attr, val) {
  const node = document.getElementById(id);
  if (node) node.setAttribute(attr, String(val));
}

export function applyStageLayout(vw = STAGE_BASE_W) {
  const safeW = Math.max(STAGE_BASE_W, Math.round(vw || STAGE_BASE_W));
  const cx = safeW * 0.5;
  const dxCenter = cx - 560;
  const genX = Math.round(mapStageX(190, safeW));
  const dxGen = genX - 190;
  const tr2X = Math.round(mapStageX(930, safeW));
  const dxTr2 = tr2X - 930;
  const dropC1 = Math.round(mapStageX(340, safeW));
  const dropC2 = Math.round(mapStageX(780, safeW));
  const cardW = computeBayCardWidth(safeW);
  const halfCard = cardW * 0.5;

  const zoneW = computeZoneCardWidth(safeW);
  const leftCx = Math.round(mapStageX(258, safeW));
  const rightCx = Math.round(mapStageX(862, safeW));
  const leftZoneX = Math.max(24, Math.round(leftCx - zoneW * 0.5));
  const rightZoneX = Math.min(safeW - 24 - zoneW, Math.round(rightCx - zoneW * 0.5));
  const leftZoneRight = leftZoneX + zoneW;
  const actualLeftCx = Math.round(leftZoneX + zoneW * 0.5);
  const actualRightCx = Math.round(rightZoneX + zoneW * 0.5);
  const dxLeftZone = actualLeftCx - 258;
  const dxRightZone = actualRightCx - 862;
  const hShieldW = Math.min(480, Math.max(320, Math.round(zoneW * 0.82)));

  ['', 'lens-'].forEach((p) => {
    const gridSvg = document.getElementById(`${p}living-grid-svg`);
    const lblSvg = document.getElementById(`${p}living-labels-svg`);
    if (gridSvg) {
      gridSvg.setAttribute('viewBox', `0 0 ${safeW} ${STAGE_BASE_H}`);
      gridSvg.querySelectorAll('[data-stage-bg]').forEach((r) => r.setAttribute('width', String(safeW)));
    }
    if (lblSvg) {
      lblSvg.setAttribute('viewBox', `0 0 ${safeW} ${STAGE_BASE_H}`);
    }

    setAttrIfFound(`${p}city-horizon-glow`, 'cx', Math.round(cx));
    setAttrIfFound(`${p}city-horizon-glow`, 'rx', Math.round(safeW * 0.47));

    BAY_SLOTS.forEach((s) => {
      const dxCity = mapStageX(s.cityX, safeW) - s.cityX;
      setTranslateX(`${p}${s.distId}`, dxCity);
      setTranslateX(`${p}lbl-${s.distId}`, dxCity);

      const bayX = Math.round(mapStageX(s.bayX, safeW));
      const left = Math.round(bayX - halfCard);
      const n = s.idx + 1;
      setAttrIfFound(`${p}line-${n}`, 'd', `M ${bayX} 442 L ${bayX} 486`);

      const bayGrp = document.getElementById(`${p}bay-${n}`);
      if (bayGrp) {
        const rects = bayGrp.querySelectorAll('rect');
        if (rects.length >= 5) {
          rects[0].setAttribute('x', String(left));
          rects[0].setAttribute('width', String(cardW));
          rects[1].setAttribute('x', String(left));
          rects[1].setAttribute('width', String(cardW));
          rects[2].setAttribute('x', String(left + 12));
          rects[2].setAttribute('width', String(cardW - 24));
          rects[3].setAttribute('x', String(left + 14));
          rects[4].setAttribute('x', String(left + 18));
        }
      }

      setAttrIfFound(`${p}bay-id-${n}`, 'x', left + 46);
      setAttrIfFound(`${p}bay-label-${n}`, 'x', left + 14);
      setAttrIfFound(`${p}bay-sub-${n}`, 'x', left + 14);
    });

    setTranslateX(`${p}layer-hv`, dxCenter);
    setTranslateX(`${p}tr-1-unit`, dxCenter);
    setTranslateX(`${p}bc1-coupler`, dxCenter);
    setTranslateX(`${p}tr1-lbl-grp`, dxCenter);
    setTranslateX(`${p}tr1-lockout-86`, dxCenter);
    setTranslateX(`${p}gen-132-unit`, dxGen);
    setTranslateX(`${p}gen-lbl-grp`, dxGen);
    setTranslateX(`${p}tr-2-unit`, dxTr2);
    setTranslateX(`${p}tr2-lbl-grp`, dxTr2);

    setAttrIfFound(`${p}bus-220-a`, 'x1', Math.round(cx - 40));
    setAttrIfFound(`${p}bus-220-a`, 'x2', tr2X + 30);
    setAttrIfFound(`${p}bus-132-b`, 'x1', 135);
    setAttrIfFound(`${p}bus-132-b`, 'x2', safeW - 135);
    setAttrIfFound(`${p}drop-c1`, 'x1', dropC1);
    setAttrIfFound(`${p}drop-c1`, 'x2', dropC1);
    setAttrIfFound(`${p}drop-c2`, 'x1', dropC2);
    setAttrIfFound(`${p}drop-c2`, 'x2', dropC2);
    setAttrIfFound(`${p}bus-33-c1`, 'x1', 24);
    setAttrIfFound(`${p}bus-33-c1`, 'x2', Math.round(cx - 42));
    setAttrIfFound(`${p}bc1-stub-l`, 'x1', Math.round(cx - 42));
    setAttrIfFound(`${p}bc1-stub-l`, 'x2', Math.round(cx - 28));
    setAttrIfFound(`${p}bc1-stub-r`, 'x1', Math.round(cx + 28));
    setAttrIfFound(`${p}bc1-stub-r`, 'x2', Math.round(cx + 42));
    setAttrIfFound(`${p}bus-33-c2`, 'x1', Math.round(cx + 42));
    setAttrIfFound(`${p}bus-33-c2`, 'x2', safeW - 24);

    setAttrIfFound(`${p}lbl-tie1`, 'x', Math.round(cx + 54));
    setAttrIfFound(`${p}lbl-bus-220`, 'x', Math.round(cx - 54));
    setAttrIfFound(`${p}lbl-bc1`, 'x', Math.round(cx));
    setAttrIfFound(`${p}lbl-bus-33-c2`, 'x', safeW - 24);
    setAttrIfFound(`${p}lbl-gallery-text`, 'x', Math.round(cx));

    setAttrIfFound(`${p}zone-rect-corp`, 'x', leftZoneX);
    setAttrIfFound(`${p}zone-rect-corp`, 'width', zoneW);
    setAttrIfFound(`${p}zone-img-corp`, 'x', actualLeftCx - 108);

    setAttrIfFound(`${p}zone-rect-field`, 'x', leftZoneX);
    setAttrIfFound(`${p}zone-rect-field`, 'width', zoneW);
    setAttrIfFound(`${p}zone-img-field`, 'x', actualLeftCx - 108);

    setAttrIfFound(`${p}zone-rect-dmz`, 'x', rightZoneX);
    setAttrIfFound(`${p}zone-rect-dmz`, 'width', zoneW);
    setAttrIfFound(`${p}zone-img-dmz`, 'x', actualRightCx - 108);

    setAttrIfFound(`${p}zone-rect-control`, 'x', rightZoneX);
    setAttrIfFound(`${p}zone-rect-control`, 'width', zoneW);
    setAttrIfFound(`${p}zone-img-control`, 'x', actualRightCx - 108);
    setTranslateX(`${p}cr-screens-grp`, dxRightZone);

    setAttrIfFound(`${p}comms-corp-dmz`, 'd', `M ${leftZoneRight} 148 L ${rightZoneX} 148`);
    setAttrIfFound(`${p}comms-hist`, 'd', `M ${actualRightCx} 258 L ${actualRightCx} 354`);
    setAttrIfFound(`${p}comms-dmz-field`, 'd', `M ${rightZoneX + 20} 252 L ${leftZoneRight - 20} 360`);
    setAttrIfFound(`${p}comms-corp-field`, 'd', `M ${actualLeftCx} 258 L ${actualLeftCx} 354`);
    setAttrIfFound(`${p}comms-rtu1`, 'd', `M ${rightZoneX} 452 L ${leftZoneRight} 452`);
    setAttrIfFound(`${p}comms-rtu2`, 'd', `M ${rightZoneX} 476 L ${leftZoneRight} 476`);

    setTranslateX(`${p}shield-corp-dmz`, dxCenter);
    setTranslateX(`${p}shield-ctrl-field`, dxCenter);
    const shDmz = document.getElementById(`${p}shield-dmz-field`)?.querySelector('rect');
    if (shDmz) {
      shDmz.setAttribute('x', String(Math.round(actualRightCx - hShieldW * 0.5)));
      shDmz.setAttribute('width', String(hShieldW));
    }
    const shCorp = document.getElementById(`${p}shield-corp-field`)?.querySelector('rect');
    if (shCorp) {
      shCorp.setAttribute('x', String(Math.round(actualLeftCx - hShieldW * 0.5)));
      shCorp.setAttribute('width', String(hShieldW));
    }

    setTranslateX(`${p}lbl-zone-corp`, dxLeftZone);
    setTranslateX(`${p}lbl-zone-field`, dxLeftZone);
    setTranslateX(`${p}lbl-zone-dmz`, dxRightZone);
    setTranslateX(`${p}lbl-zone-control`, dxRightZone);
    setAttrIfFound(`${p}lbl-shield-corp-dmz`, 'x', Math.round(cx));
    setAttrIfFound(`${p}lbl-shield-ctrl-field`, 'x', Math.round(cx));
    setAttrIfFound(`${p}lbl-shield-dmz-field`, 'x', Math.round(actualRightCx - 90));
    setAttrIfFound(`${p}lbl-shield-corp-field`, 'x', Math.round(actualLeftCx + 90));
  });
}

export class SceneFX {
  constructor(canvas, stageCard, getState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stageCard = stageCard;
    this.getState = getState;

    this.logicalW = STAGE_BASE_W;
    this.logicalH = STAGE_BASE_H;
    this.dpr = 1;

    this.rafId = null;
    this.lastTime = 0;
    this.lastDrawTime = 0;
    this.simTime = 0;

    this.pausedByUser = false;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tabHidden = document.hidden;
    this.offscreen = false;

    this._cachedDark = null;
    this._cachedPal = null;
    this._canvasDirty = true;
    this._lastDrawnView = null;

    this.sparks = [];
    this.ripples = [];
    this.surges = [];

    this._setupLifecycle();
    this.syncRunning();
  }

  setViewportSize(vpW, vpH, vw) {
    const safeW = Math.max(STAGE_BASE_W, Math.round(vw || STAGE_BASE_W));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const pxW = Math.max(1, Math.round((vpW || safeW) * dpr));
    const pxH = Math.max(1, Math.round((vpH || STAGE_BASE_H) * dpr));
    this.logicalW = safeW;
    this.dpr = dpr;
    if (this.canvas.width !== pxW || this.canvas.height !== pxH) {
      this.canvas.width = pxW;
      this.canvas.height = pxH;
    }
    this._canvasDirty = true;
    this.renderStaticSnapshot();
  }

  _setupLifecycle() {
    this._onVisChange = () => {
      this.tabHidden = document.hidden;
      this.syncRunning();
      if (!this.tabHidden) {
        this._canvasDirty = true;
        this.renderStaticSnapshot();
      }
    };
    document.addEventListener('visibilitychange', this._onVisChange);

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            this.offscreen = !entry.isIntersecting;
            this.syncRunning();
          }
        },
        { rootMargin: '120px' }
      );
      this._io.observe(this.stageCard);
    }

    this._mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._onMqChange = (ev) => {
      this.setReducedMotion(ev.matches);
    };
    this._mq.addEventListener('change', this._onMqChange);
  }

  dispose() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this._onVisChange) {
      document.removeEventListener('visibilitychange', this._onVisChange);
    }
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
    if (this._mq && this._onMqChange) {
      this._mq.removeEventListener('change', this._onMqChange);
    }
  }

  setReducedMotion(val) {
    this.reducedMotion = Boolean(val);
    this.syncRunning();
    this.renderStaticSnapshot();
  }

  setUserPaused(val) {
    this.pausedByUser = Boolean(val);
    this.syncRunning();
    this.renderStaticSnapshot();
  }

  hasActiveTransients() {
    return this.sparks.length > 0 || this.ripples.length > 0 || this.surges.length > 0;
  }

  shouldAnimate() {
    if (this.pausedByUser || this.reducedMotion || this.tabHidden || this.offscreen) return false;
    const st = this.getState();
    if (!st) return false;
    if (st.cinemaActive || st.layoutMode === 'terminal') return false;
    const view = st.activeView || 'city';
    if (this.hasActiveTransients()) return true;
    if (view === 'city') return false;
    if (view === 'network') return Boolean(st.liveConnected);
    if (view === 'substation') {
      const replayOn = Boolean(st.soeReplay && st.soeReplay.active);
      const busesLive = replayOn
        ? Boolean(st.soeReplay.frames[st.soeReplay.index]?.busesLive)
        : st.busKv > 0.5;
      return Boolean((st.tieClosed && !replayOn) || (busesLive && st.liveConnected));
    }
    return false;
  }

  syncRunning() {
    if (this.shouldAnimate()) {
      if (!this.rafId) {
        this.lastTime = performance.now();
        this.lastDrawTime = 0;
        this.rafId = requestAnimationFrame((t) => this._tick(t));
      }
    } else if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  clearTransients() {
    this.sparks.length = 0;
    this.ripples.length = 0;
    this.surges.length = 0;
    this._canvasDirty = true;
    this.syncRunning();
    this.renderStaticSnapshot();
  }

  emitWireEcho(x, y, color = 'echo', view = null) {
    if (this.tabHidden || this.offscreen || this.pausedByUser || this.reducedMotion) return;
    if (this.ripples.length >= 24) this.ripples.shift();
    this.ripples.push({ x, y, r: 6, maxR: 42, life: 1.0, color, view });
    this._canvasDirty = true;
    this.syncRunning();
    if (!this.shouldAnimate()) this.renderStaticSnapshot();
  }

  emitCLPU(bayIdx) {
    if (this.tabHidden || this.offscreen || this.pausedByUser || this.reducedMotion) return;
    const slot = BAY_SLOTS[bayIdx];
    if (!slot) return;
    if (this.surges.length >= 12) this.surges.shift();
    this.surges.push({
      bayX: slot.bayX,
      bayY: slot.bayY,
      cityX: slot.cityX,
      cityY: slot.cityY,
      progress: 0,
      life: 1.0,
    });
    this._canvasDirty = true;
    this.syncRunning();
    if (!this.shouldAnimate()) this.renderStaticSnapshot();
  }

  emitTripSpark(x, y) {
    if (this.tabHidden || this.offscreen || this.pausedByUser || this.reducedMotion) return;
    const count = 18;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
      const speed = 36 + Math.random() * 68;
      if (this.sparks.length >= 72) this.sparks.shift();
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 12,
        life: 1.0,
        size: 2.2 + Math.random() * 2.2,
        core: i % 3 === 0,
      });
    }
    if (this.ripples.length >= 24) this.ripples.shift();
    this.ripples.push({ x, y, r: 6, maxR: 44, life: 1.0, color: 'spark', view: 'substation' });
    this._canvasDirty = true;
    this.syncRunning();
    if (!this.shouldAnimate()) this.renderStaticSnapshot();
  }

  emitProbeRipples(wallKeys) {
    if (this.tabHidden || this.offscreen || this.pausedByUser || this.reducedMotion) return;
    wallKeys.forEach((key) => {
      const pt = SHIELD_POINTS[key];
      if (!pt) return;
      if (this.ripples.length >= 24) this.ripples.shift();
      this.ripples.push({
        x: pt.x,
        y: pt.y,
        r: 5,
        maxR: 34,
        life: 1.0,
        color: 'probe',
        view: 'network',
      });
    });
    this._canvasDirty = true;
    this.syncRunning();
    if (!this.shouldAnimate()) this.renderStaticSnapshot();
  }

  _tick(now) {
    const activeBurst = this.hasActiveTransients();
    if (!activeBurst && this.lastDrawTime > 0 && now - this.lastDrawTime < 33) {
      if (this.shouldAnimate()) {
        this.rafId = requestAnimationFrame((t) => this._tick(t));
      } else {
        this.rafId = null;
      }
      return;
    }

    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.lastDrawTime = now;
    this.simTime += dt;
    this._updateTransients(dt);
    this._draw(this.simTime);
    if (this.shouldAnimate()) {
      this.rafId = requestAnimationFrame((t) => this._tick(t));
    } else {
      this.rafId = null;
    }
  }

  renderStaticSnapshot() {
    if (this.tabHidden || this.offscreen || this.rafId) return;
    const st = this.getState();
    if (!st || st.cinemaActive || st.layoutMode === 'terminal') return;
    const view = st.activeView || 'city';
    if (view !== this._lastDrawnView) this._canvasDirty = true;
    if (view === 'city' && !this.hasActiveTransients() && !this._canvasDirty) return;
    this._draw(this.simTime);
  }

  _updateTransients(dt) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      p.life -= dt * 1.4;
      if (p.life <= 0) this.sparks.splice(i, 1);
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += (r.maxR - r.r) * Math.min(1, dt * 4.0);
      r.life -= dt * 0.85;
      if (r.life <= 0) this.ripples.splice(i, 1);
    }
    for (let i = this.surges.length - 1; i >= 0; i--) {
      const s = this.surges[i];
      s.progress += dt * 0.85;
      s.life = Math.max(0, 1 - s.progress);
      if (s.progress >= 1) this.surges.splice(i, 1);
    }
  }

  _palette() {
    const dark = document.documentElement.classList.contains('dark');
    if (this._cachedDark === dark && this._cachedPal) return this._cachedPal;
    this._cachedDark = dark;
    this._cachedPal = dark
      ? {
          v220: 'rgba(227, 158, 95, 0.88)',
          v132: 'rgba(118, 172, 218, 0.85)',
          bead: 'rgba(218, 224, 232, 0.78)',
          echo: 'rgba(227, 158, 95, 0.86)',
          surge: 'rgba(242, 186, 98, 0.82)',
          probe: 'rgba(224, 108, 100, 0.85)',
          sparkCore: 'rgba(255, 244, 216, 0.92)',
          sparkOuter: 'rgba(228, 126, 62, 0.84)',
        }
      : {
          v220: 'rgba(199, 132, 54, 0.86)',
          v132: 'rgba(78, 127, 168, 0.84)',
          bead: 'rgba(72, 82, 96, 0.7)',
          echo: 'rgba(196, 118, 52, 0.84)',
          surge: 'rgba(214, 138, 54, 0.84)',
          probe: 'rgba(201, 59, 50, 0.84)',
          sparkCore: 'rgba(255, 248, 230, 0.94)',
          sparkOuter: 'rgba(214, 104, 44, 0.86)',
        };
    return this._cachedPal;
  }

  _draw(t) {
    const ctx = this.ctx;
    const state = this.getState();
    const view = state.activeView || 'city';
    const pal = this._palette();
    const vw = this.logicalW;
    const vh = this.logicalH;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const scale = Math.min(cw / vw, ch / vh);
    const ox = (cw - vw * scale) * 0.5;
    const oy = (ch - vh * scale) * 0.5;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    const mx = (x) => mapStageX(x, vw);
    const activeView = state.soeReplay && state.soeReplay.active
      ? state.soeReplay.frames[state.soeReplay.index]
      : null;
    const totalMw = activeView ? activeView.totalMw : state.totalMw;

    if (view === 'substation') {
      const cx = vw * 0.5;
      const genX = mx(190);
      const tr2X = mx(930);
      const cardW = computeBayCardWidth(vw);
      const halfCard = cardW * 0.5;

      if (state.tieClosed && !activeView) {
        const span220 = tr2X - cx;
        for (let k = 0; k < 2; k++) {
          const p = (t * 0.34 + k * 0.5) % 1;
          ctx.beginPath();
          ctx.fillStyle = pal.v220;
          ctx.arc(cx + p * span220, 168, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const busesLive = activeView ? activeView.busesLive : state.busKv > 0.5;
      if (busesLive && state.liveConnected) {
        const speed = 0.2 + Math.min(0.55, totalMw / 50);
        const span132 = tr2X - genX;
        for (let k = 0; k < 2; k++) {
          const p = (t * speed + k * 0.5) % 1;
          ctx.beginPath();
          ctx.fillStyle = pal.v132;
          ctx.arc(genX + p * span132, 386, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      this.surges.forEach((s) => {
        const pad = s.progress * 12;
        const bx = mx(s.bayX);
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.life * 0.7);
        ctx.strokeStyle = pal.surge;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(bx - halfCard - pad, s.bayY - 52 - pad, cardW + pad * 2, 104 + pad * 2, 14 + pad * 0.3);
        ctx.stroke();
        ctx.restore();
      });

      this.sparks.forEach((p) => {
        const px = mx(p.x);
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life * 0.85);
        ctx.fillStyle = p.core ? pal.sparkCore : pal.sparkOuter;
        ctx.beginPath();
        ctx.arc(px, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal.sparkOuter;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px, p.y);
        ctx.lineTo(px - p.vx * 0.028, p.y - p.vy * 0.028);
        ctx.stroke();
        ctx.restore();
      });
    } else if (view === 'city') {
      this.surges.forEach((s) => {
        const r = 24 + s.progress * 80;
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.life * 0.8);
        ctx.strokeStyle = pal.surge;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(mx(s.cityX), s.cityY + 32, r, r * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    } else if (view === 'network' && state.liveConnected) {
      const zoneW = computeZoneCardWidth(vw);
      const leftZoneX = Math.max(24, Math.round(mx(258) - zoneW * 0.5));
      const rightZoneX = Math.min(vw - 24 - zoneW, Math.round(mx(862) - zoneW * 0.5));
      const leftZoneRight = leftZoneX + zoneW;
      const gapSpan = Math.max(20, rightZoneX - leftZoneRight);
      const p1 = (t * 0.4) % 1;
      const p2 = (t * 0.4 + 0.5) % 1;
      ctx.beginPath();
      ctx.fillStyle = pal.bead;
      ctx.arc(rightZoneX - p1 * gapSpan, 452, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(leftZoneRight + p2 * gapSpan, 476, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    this.ripples.forEach((r) => {
      if (r.view && r.view !== view) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.life * 0.85);
      ctx.strokeStyle = r.color === 'spark' ? pal.sparkOuter : r.color === 'echo' ? pal.echo : pal.probe;
      ctx.lineWidth = r.color === 'spark' ? 2.6 : 2.2;
      ctx.beginPath();
      ctx.arc(mx(r.x), r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    this._lastDrawnView = view;
    this._canvasDirty = false;
  }
}
