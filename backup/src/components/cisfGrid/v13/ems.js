import { MODULES, SCORED_MODULES, ROLE_META, ZONES, ZONE_PAIRS } from './modules.js';
import { STAGE_BASE_W, STAGE_BASE_H, CAMERA_PRESETS, BAY_SLOTS, SceneFX, buildSceneSVG, buildLabelsSVG, applyStageLayout } from './scene.js';
import { PtyTerminal } from './terminal.js';
import {
  TrendsPanel,
  escHtml,
  formatSoeReplayEvents,
  parsePolicyYamlToRules,
  serializePolicyRulesToYaml,
  renderAlarmsTable,
  renderSoeTable,
  renderIncidentTimeline,
  renderFrameAnatomy,
} from './panels.js';
import { TourController } from './tour.js';
import { StoryController } from './story.js';
import { GLOSSARY_TERMS, GlossaryController } from './glossary.js';

const osReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const MAX_STATION_LOG_LINES = 200;
const MAX_OPERATOR_LOG = 200;
const MAX_ATTEMPTS_PER_MODULE = 50;
const WS_WATCHDOG_INTERVAL_MS = 5000;
const WS_STALE_THRESHOLD_MS = 12_000;

const DEFAULT_GRID_LAYOUT = {
  orientation: 'wide',
  slotA: 'station',
  slotB: 'terminal',
  slotC: 'mission',
};

const TAB_TO_GROUP = {
  brief: 'mission',
  console: 'station',
  alarms: 'station',
  trends: 'station',
  dispatch: 'evidence',
  frames: 'evidence',
  timeline: 'evidence',
  notes: 'evidence',
  checks: 'progress',
  case: 'progress',
};

const GROUP_DEFAULT_TAB = {
  mission: 'brief',
  station: 'console',
  evidence: 'dispatch',
  progress: 'checks',
};

const MODULE_PRIMARY_JUMP = {
  m1: { tab: 'frames', label: 'Inspect IEC-104 Frames' },
  m2: { tab: 'frames', label: 'Inspect IEC-104 Frames' },
  m3: { tab: 'trends', label: 'Open Live Trends' },
  m4: { tab: 'console', label: 'Open Bay Readout' },
  m5: { tab: 'frames', label: 'Inspect IEC-104 Frames' },
  m6: { tab: 'timeline', label: 'Open Incident Timeline' },
  m7: { tab: 'console', label: 'Open Module Workbench' },
  m8: { tab: 'console', label: 'Open Policy Matrix' },
  m9: { tab: 'console', label: 'Open Switching Console' },
  m10: { tab: 'case', label: 'Open Case Board' },
};

export function mountV13Workspace(options = {}) {
const assetBase = String(options.assetBase || './assets').replace(/\/+$/, '');
const transport = options.transport;
if (!transport) throw new Error("V13 platform transport is required");
const userPrefix = options.userId != null ? `cg_u${options.userId}_` : 'cg_anon_';
const STORAGE_NOTES = `${userPrefix}notes`;
const STORAGE_PINS = `${userPrefix}pins`;
const STORAGE_LAYOUT = `${userPrefix}layout`;
const STORAGE_GRID_V12 = `${userPrefix}grid_v12`;
const STORAGE_DECK_H = `${userPrefix}deck_h`;
const STORAGE_OBJ = `${userPrefix}objectives`;
const STORAGE_TOUR = `${userPrefix}tour_v1`;
const STORAGE_STORY = `${userPrefix}story_v1`;
const ac = new AbortController();
let disposed = false;

const state = {
  module: 'm1',
  activeView: 'city',
  activeTab: 'brief',
  activeGroup: 'mission',
  lastSubTabByGroup: { ...GROUP_DEFAULT_TAB },
  deckExpanded: false,
  rightTab: 'terminal',
  theme: options.initialTheme || (document.documentElement.classList.contains('dark') ? 'ember' : 'daylight'),
  layoutMode: 'split',
  gridLayout: { ...DEFAULT_GRID_LAYOUT },
  railOpen: false,
  relayAudio: false,
  mobileMapOpen: false,
  reducedMotion: osReducedMotionQuery.matches,
  motionPaused: false,
  cinemaActive: false,
  stageLogicalW: STAGE_BASE_W,
  sceneDomDirtyWhileHidden: false,

  liveConnected: false,
  liveInitialSynced: false,
  lastServerModuleId: null,
  wsHasConnectedOnce: false,
  wsRetryMs: 4000,
  wsRetryTimer: null,
  wsConnectTimer: null,
  wsConnectSeq: 0,
  lastWsRxAt: 0,
  stateWs: null,

  truthVisible: false,
  shimActive: true,
  busFreqHz: null,
  genFreqHz: null,
  busKv: 0.0,
  tr1Pct: 0,
  tr2Pct: 0,
  genMw: 0.0,
  gridTieMw: 0.0,
  totalMw: 0.0,
  tieClosed: false,
  tr2Online: false,
  lockout86: false,
  activeLockouts: [],
  syncAngleDeg: 0,
  syncDf: 0,
  syncDv: 0,
  ansi25InWindow: false,
  pollPct: null,
  rtu1Connected: false,
  rtu2Connected: false,
  districts: null,
  bays: {},
  feederSpecs: [],
  livePreflight: null,
  selectedBayId: null,
  postTripResets: 0,
  resetPenaltyPct: 0,
  nextResetPenaltyPct: 0,
  maxResetPenaltyPct: 30,
  tripEvents: 0,
  tripPenaltyPct: 0,
  maxTripPenaltyPct: 30,

  alarms: [],
  soeEvents: [],
  operatorLog: [],
  frames: [],
  frameDatasets: [],
  selectedFrameId: null,
  dispatch: [],
  readoutCount: 0,

  clearedModules: new Set(),
  attemptedModules: new Set(),
  l3Unlocked: new Set(),
  l3HintText: {},
  hintsTracked: new Set(),
  attemptsByModule: {},
  verifyInFlight: false,
  pinnedArtifacts: [],
  pinSeq: 0,
  notesHydrated: false,
  notesDirtyOffline: false,
  stationLogUnread: 0,
  moduleEnteredAt: Date.now(),

  editorDirty: false,
  editorFile: 'station_inventory.json',
  editorLoadedFile: null,
  editorLoadedMtime: null,
  editorLoadSeq: 0,
  editorDrafts: {},
  m1Highlight: false,
  splitLensOn: false,
  lensPct: 34,
  m8ShieldsRaised: false,
  policyRules: {},

  soeReplay: { available: false, active: false, playing: false, index: 0, timerId: null, frames: [] },
};

const el = {
  workspaceMain: document.getElementById('workspace-main'),
  layoutDemoPill: document.getElementById('layout-demo-pill'),
  rail: document.getElementById('module-rail'),
  railList: document.getElementById('rail-list'),
  btnRail: document.getElementById('btn-toggle-rail'),
  hdrModBadge: document.getElementById('hdr-mod-badge'),
  hdrModMeta: document.getElementById('hdr-module-meta'),
  connPill: document.getElementById('conn-status-pill'),
  segBar: document.getElementById('segmented-bar'),
  progressText: document.getElementById('progress-text'),
  hdrAlarmsBtn: document.getElementById('hdr-alarms-btn'),
  hdrAlarmCount: document.getElementById('hdr-alarm-count'),
  tabAlarmCount: document.getElementById('tab-alarm-count'),
  navStationAlarmDot: document.getElementById('nav-station-alarm-dot'),
  navEvidenceCount: document.getElementById('nav-evidence-count'),
  navCaseProgress: document.getElementById('nav-case-progress'),
  stakesPill: document.getElementById('stakes-strip'),
  btnTheme: document.getElementById('btn-theme'),
  btnGlossary: document.getElementById('btn-glossary'),
  btnLayoutPreset: document.getElementById('btn-layout-preset'),
  layoutPresetMenu: document.getElementById('layout-preset-menu'),
  missionKeyTerms: document.getElementById('mission-key-terms'),

  stageCard: document.getElementById('living-stage-card'),
  stageViewport: document.getElementById('stage-viewport'),
  cameraRig: document.getElementById('camera-rig'),
  svgHost: document.getElementById('svg-host'),
  svgLabelsHost: document.getElementById('svg-labels-host'),
  lensHmiLayer: document.getElementById('lens-hmi-layer'),
  lensLabelsLayer: document.getElementById('lens-labels-layer'),
  lensDivider: document.getElementById('lens-divider'),
  btnSplitLens: document.getElementById('btn-split-lens'),
  btnRelayAudio: document.getElementById('btn-relay-audio'),
  canvas: document.getElementById('scene-fx'),
  hudCameraLabel: document.getElementById('hud-camera-label'),
  hudGridMode: document.getElementById('hud-grid-mode'),
  hudLockoutPill: document.getElementById('hud-lockout-pill'),
  breakerLegend: document.getElementById('breaker-legend'),
  mobSummary: document.getElementById('mobile-banner-summary'),
  mobStrip: document.getElementById('mobile-district-strip'),

  objCard: document.getElementById('objective-card'),
  objTitle: document.getElementById('obj-title'),
  objTimer: document.getElementById('obj-timer'),
  objArtifact: document.getElementById('obj-artifact'),
  objList: document.getElementById('obj-list'),
  objCollapseBtn: document.getElementById('btn-obj-collapse'),
  objChev: document.getElementById('obj-chev'),

  telemHz: document.getElementById('telem-hz'),
  telemGenHz: document.getElementById('telem-gen-hz'),
  telemKv: document.getElementById('telem-kv'),
  telemTr1: document.getElementById('telem-tr1'),
  telemTr2: document.getElementById('telem-tr2'),
  telemMw: document.getElementById('telem-mw'),
  telemLink: document.getElementById('telem-link'),

  feederGrid: document.getElementById('feeder-grid'),
  sboBar: document.getElementById('sbo-confirm-bar'),
  sboSummary: document.getElementById('sbo-summary'),
  btnSboExec: document.getElementById('btn-sbo-execute'),
  chkTr2: document.getElementById('chk-toggle-tr2'),
  btnClear86: document.getElementById('btn-clear-86'),
  btnResetElectrical: document.getElementById('btn-reset-electrical'),
  m7ShimPill: document.getElementById('m7-shim-status-pill'),
  soePanel: document.getElementById('soe-replay-panel'),
  soeCaption: document.getElementById('soe-replay-caption'),
  soeScrubber: document.getElementById('soe-scrubber'),
  btnSoePlay: document.getElementById('btn-soe-play'),
  btnSoeLive: document.getElementById('btn-soe-live'),
  oplogList: document.getElementById('oplog-list'),

  dispatchList: document.getElementById('dispatch-list'),
  dispatchCount: document.getElementById('dispatch-count'),
  resultBanner: document.getElementById('result-banner'),
  bannerTitle: document.getElementById('banner-title'),
  bannerDetail: document.getElementById('banner-detail'),
  btnNextMod: document.getElementById('btn-next-module'),
  checksMeta: document.getElementById('checks-meta'),
  checksResetNotice: document.getElementById('checks-reset-notice'),
  tabBarWrap: document.getElementById('tab-bar-wrap'),
  tabBar: document.getElementById('tab-bar'),
  deckSubbars: document.getElementById('deck-subbars'),
  btnDeckExpand: document.getElementById('btn-deck-expand'),
  btnCaseOpenShift: document.getElementById('btn-case-open-shift'),
  rubricList: document.getElementById('rubric-list'),
  notesArea: document.getElementById('learner-notes'),
  pinnedList: document.getElementById('pinned-list'),
  historyList: document.getElementById('history-list'),

  termView: document.getElementById('terminal-view'),
  xtermHost: document.getElementById('xterm-host'),
  termConnStatus: document.getElementById('term-conn-status'),
  stationLogView: document.getElementById('station-log-view'),
  stationLogOut: document.getElementById('station-log-output'),
  stationLogBadge: document.getElementById('station-log-badge'),
  editorView: document.getElementById('editor-view'),
  btnRightTerm: document.getElementById('btn-right-term'),
  btnRightLog: document.getElementById('btn-right-log'),
  btnToggleEditor: document.getElementById('btn-toggle-editor'),
  editorToggleLabel: document.getElementById('editor-toggle-label'),
  editorPath: document.getElementById('editor-path'),
  editorFileSelect: document.getElementById('editor-file-select'),
  editorStatus: document.getElementById('editor-status'),
  btnEditorReload: document.getElementById('btn-editor-reload'),
  editorConflictBar: document.getElementById('editor-conflict-bar'),
  editorConflictMsg: document.getElementById('editor-conflict-msg'),
  btnConflictReload: document.getElementById('btn-conflict-reload'),
  btnConflictOverwrite: document.getElementById('btn-conflict-overwrite'),
  editorGutter: document.getElementById('editor-gutter'),
  editorText: document.getElementById('editor-textarea'),
  submitArtifact: document.getElementById('submit-artifact'),
  btnPractice: document.getElementById('btn-practice-check'),
  btnSubmit: document.getElementById('btn-submit-module'),
  btnUnlockL3: document.getElementById('btn-unlock-l3'),
  hint3: document.getElementById('hint-3'),
  hintDetails1: document.getElementById('hint-details-1'),
  hintDetails2: document.getElementById('hint-details-2'),
  govFreqInput: document.getElementById('gov-freq-input'),
  btnGovSet: document.getElementById('btn-gov-set'),

  dialog: document.getElementById('confirm-dialog'),
  dialogTitle: document.getElementById('dialog-title'),
  dialogBody: document.getElementById('dialog-body'),
  dialogConfirm: document.getElementById('dialog-confirm'),
  dialogCancel: document.getElementById('dialog-cancel'),

  permitDialog: document.getElementById('permit-dialog'),
  permitSummary: document.getElementById('permit-summary'),
  permitPreflight: document.getElementById('permit-preflight'),
  permitReason: document.getElementById('permit-reason'),
  permitTargetId: document.getElementById('permit-target-id'),
  permitInput: document.getElementById('permit-confirm-input'),
  permitError: document.getElementById('permit-error'),
  permitHoldBtn: document.getElementById('permit-hold-btn'),
  permitCancel: document.getElementById('permit-cancel'),
};

el.svgHost.innerHTML = buildSceneSVG(false, assetBase);
el.svgLabelsHost.innerHTML = buildLabelsSVG(false);
el.lensHmiLayer.innerHTML = buildSceneSVG(true, assetBase);
el.lensLabelsLayer.innerHTML = buildLabelsSVG(true);

// Cache static scene and inline physics DOM nodes once at mount (E-18).
const sceneDom = {
  feederLines: document.getElementById('feeder-lines'),
  cableGalleryMask: document.getElementById('cable-gallery-mask'),
  cb220Tie1: document.getElementById('cb-220-tie1'),
  tieStemLower: document.getElementById('tie-stem-lower'),
  bus220A: document.getElementById('bus-220-a'),
  bc1Coupler: document.getElementById('bc1-coupler'),
  genSvgHz: document.getElementById('gen-svg-hz'),
  tr1Glow: document.getElementById('tr1-glow'),
  tr2Glow: document.getElementById('tr2-glow'),
  tr1SvgPct: document.getElementById('tr1-svg-pct'),
  tr2SvgPct: document.getElementById('tr2-svg-pct'),
  tr1Lockout86: document.getElementById('tr1-lockout-86'),
  tr2Unit: document.getElementById('tr-2-unit'),
  tr2Lines: ['tr2-hv-b', 'tr2-lv-stem'].map((id) => document.getElementById(id)),
  busLines: ['tr1-lv-stem', 'gen-stem', 'bus-132-b', 'drop-c1', 'drop-c2', 'bus-33-c1', 'bus-33-c2', 'bc1-stub-l', 'bc1-stub-r'].map((id) => ({
    id,
    node: document.getElementById(id),
  })),
  screens: ['cr-scr-1', 'cr-scr-2', 'cr-scr-3', 'cr-scr-4'].map((id) => document.getElementById(id)),
  m1Comms: ['comms-rtu1', 'comms-rtu2', 'comms-hist'].map((id) => document.getElementById(id)),
  shields: ['shield-corp-dmz', 'shield-dmz-field', 'shield-corp-field', 'shield-ctrl-field'].map((id) => document.getElementById(id)),
  m1Rtu1State: document.getElementById('m1-rtu1-state'),
  m1Rtu2State: document.getElementById('m1-rtu2-state'),
  m1PollPct: document.getElementById('m1-poll-pct'),
  m4HmiVal: document.getElementById('m4-hmi-val'),
  m4AlarmVal: document.getElementById('m4-alarm-val'),
  bays: BAY_SLOTS.map((slot) => {
    const n = slot.idx + 1;
    return {
      slot,
      n,
      distEl: document.getElementById(slot.distId),
      distLblGrp: document.getElementById(`lbl-${slot.distId}`),
      distStatusEl: document.getElementById(`dist-status-${n}`),
      lineEl: document.getElementById(`line-${n}`),
      bayEl: document.getElementById(`bay-${n}`),
      bayLblGrp: document.getElementById(`bay-lbl-grp-${n}`),
      bayIdEl: document.getElementById(`bay-id-${n}`),
      bayLabel: document.getElementById(`bay-label-${n}`),
      baySub: document.getElementById(`bay-sub-${n}`),
    };
  }),
  syncNeedle: document.getElementById('sync-needle'),
  syncDphi: document.getElementById('sync-dphi'),
  syncDf: document.getElementById('sync-df'),
  syncDv: document.getElementById('sync-dv'),
  syncTieState: document.getElementById('sync-tie-state'),
  syncStatusSvg: document.getElementById('sync-status-svg'),
  physGenMw: document.getElementById('phys-gen-mw'),
  meterGen: document.getElementById('meter-gen'),
  physTr1Mva: document.getElementById('phys-tr1-mva'),
  meterTr1: document.getElementById('meter-tr1'),
  physTr2Mva: document.getElementById('phys-tr2-mva'),
  meterTr2: document.getElementById('meter-tr2'),
  ghostGen: document.getElementById('ghost-gen'),
  ghostTr1: document.getElementById('ghost-tr1'),
  ghostTr2: document.getElementById('ghost-tr2'),
};

const glossary = new GlossaryController();
const fx = new SceneFX(el.canvas, el.stageCard, () => state);
const tour = new TourController({
  tourData: options.tourData || null,
  storageKey: STORAGE_TOUR,
  initialPrefs: options.initialTourPrefs || null,
  onPrefsChange: options.onTourPrefsChange || null,
  onReplayColdOpen: () => story.startColdOpen(),
  onInterruptColdOpen: () => story.finishColdOpen(true),
  isStoryOverlayActive: () => story.isOverlayActive(),
  onEnsureTab: (tabName) => setTab(tabName),
  onOpenGlossary: (termId) => glossary.open(termId || null),
  onDemoPanelSwap: (action) => runTourDemoSwap(action),
});
const story = new StoryController({
  apiJson,
  storageKey: STORAGE_STORY,
  storyData: options.storyData || null,
  assetBase,
  setSceneView,
  getBlindedInsetRows,
  getWelcomeCopy: () => tour.data?.welcome || null,
  onCinemaStartTour: () => {
    tour.markColdOpenSeen();
    tour.startGuidedTour(true);
  },
  onCinemaExplore: () => {
    tour.markColdOpenSeen();
    tour.markSeen();
    tour.openGuideMenu(true);
  },
  onColdOpenFinished: (reason) => {
    tour.markColdOpenSeen();
    if (reason === 'skip') {
      tour.markSeen();
    } else if (!tour.isSeen()) {
      tour.showWelcome();
    }
  },
  onColdOpenVisibilityChange: (active) => {
    state.cinemaActive = Boolean(active);
    fx.syncRunning();
  },
  onActCardHidden: () => tour.flushPendingTips(),
  onCasesUpdated: (ids) => syncPassedModulesFromSigned(ids, true),
  onHintsHydrated: (hintsMap) => hydrateHintsFromCase(hintsMap),
  onTabCase: () => setTab('case'),
});
const pty = new PtyTerminal(
  el.xtermHost,
  el.termConnStatus,
  () => {},
  () => tour.notifyEvent('terminal-enter'),
  {
    TerminalCtor: options.TerminalCtor || null,
    FitAddonCtor: options.FitAddonCtor || null,
    getWsUrl: () => transport.getTerminalWsUrl(),
  }
);
pty.mount();

const trends = new TrendsPanel(
  {
    freq: document.getElementById('trend-freq'),
    kv: document.getElementById('trend-kv'),
    tr: document.getElementById('trend-tr'),
    mw: document.getElementById('trend-mw'),
  },
  document.getElementById('trends-readout')
);

let flipGen = 0;
let flipCleanupTimer = null;
let railRepositionTimer = null;
let checkPollTimer = null;
let filterDebounceTimer = null;
let resumePendingCheckPoll = null;
let tabChannel = null;
let demoSwapSnapshot = null;
let stageResizeRaf = null;
let lastStageVpW = 0;
let lastStageVpH = 0;
let lastMobStripKey = '';

function setTextIfChanged(node, text) {
  if (!node) return;
  const next = String(text);
  if (node.textContent !== next) node.textContent = next;
}

function setClassIfChanged(node, cls) {
  if (!node) return;
  if (node.className !== cls) node.className = cls;
}

function syncResponsiveStage(force = false) {
  if (!el.stageViewport) return;
  const r = el.stageViewport.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) return;
  const vpW = Math.round(r.width);
  const vpH = Math.round(r.height);
  if (!force && vpW === lastStageVpW && vpH === lastStageVpH) return;
  lastStageVpW = vpW;
  lastStageVpH = vpH;
  const ar = Math.max(STAGE_BASE_W / STAGE_BASE_H, Math.min(3.15, vpW / Math.max(240, vpH)));
  const vw = Math.round(STAGE_BASE_H * ar);
  if (force || vw !== state.stageLogicalW) {
    state.stageLogicalW = vw;
    applyStageLayout(vw);
  }
  fx.setViewportSize(vpW, vpH, vw);
}

function scheduleResponsiveStage() {
  if (stageResizeRaf) return;
  stageResizeRaf = requestAnimationFrame(() => {
    stageResizeRaf = null;
    syncResponsiveStage(false);
  });
}

function persistGridLayout() {
  try {
    localStorage.setItem(STORAGE_GRID_V12, JSON.stringify(state.gridLayout));
  } catch {
  }
}

function applyGridLayoutToDOM() {
  if (!el.workspaceMain) return;
  const g = state.gridLayout;
  el.workspaceMain.dataset.orientation = g.orientation;
  el.workspaceMain.dataset.slotA = g.slotA;
  el.workspaceMain.dataset.slotB = g.slotB;
  el.workspaceMain.dataset.slotC = g.slotC;

  const stWide = document.getElementById('state-preset-wide');
  const stSide = document.getElementById('state-preset-sidebar');
  if (stWide) stWide.textContent = g.orientation === 'wide' ? 'Active' : '';
  if (stSide) stSide.textContent = g.orientation === 'sidebar' ? 'Active' : '';
}

function loadSavedGridLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_GRID_V12);
    if (!raw) return;
    const p = JSON.parse(raw);
    const validPanels = new Set(['station', 'terminal', 'mission']);
    const slots = [p.slotA, p.slotB, p.slotC];
    if (
      (p.orientation === 'wide' || p.orientation === 'sidebar')
      && slots.every((s) => validPanels.has(s))
      && new Set(slots).size === 3
    ) {
      state.gridLayout = {
        orientation: p.orientation,
        slotA: p.slotA,
        slotB: p.slotB,
        slotC: p.slotC,
      };
    }
  } catch {
  }
}

function cancelPanelFlipAnimations(panels) {
  panels.forEach((p) => {
    if (typeof p.getAnimations === 'function') {
      p.getAnimations().forEach((anim) => anim.cancel());
    }
    p.style.transition = 'none';
    p.style.transform = 'none';
    p.style.removeProperty('transform-origin');
    p.style.removeProperty('will-change');
  });
  if (el.workspaceMain) void el.workspaceMain.offsetWidth;
  panels.forEach((p) => {
    p.style.removeProperty('transition');
    p.style.removeProperty('transform');
  });
}

function animateWorkspaceFlip(mutateFn, save = true) {
  const panels = Array.from(document.querySelectorAll('.ws-panel'));
  cancelPanelFlipAnimations(panels);
  const firstRects = new Map();
  if (!state.reducedMotion && window.innerWidth > 900) {
    panels.forEach((p) => {
      const r = p.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) firstRects.set(p, r);
    });
  }

  mutateFn();
  applyGridLayoutToDOM();
  if (save) persistGridLayout();

  if (state.reducedMotion || window.innerWidth <= 900 || firstRects.size === 0) {
    requestAnimationFrame(() => {
      pty.scheduleFit();
      syncResponsiveStage(true);
      fx.syncRunning();
      if (state.activeTab === 'trends') trends.render();
      tour._repositionActive();
    });
    return;
  }

  flipGen += 1;
  const gen = flipGen;
  const animated = [];

  panels.forEach((p) => {
    const first = firstRects.get(p);
    if (!first) return;
    const last = p.getBoundingClientRect();
    if (last.width <= 0 || last.height <= 0) return;
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / last.width;
    const sy = first.height / last.height;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;

    p.style.transition = 'none';
    p.style.transformOrigin = 'top left';
    p.style.willChange = 'transform';
    p.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    animated.push(p);
  });

  if (!animated.length) {
    requestAnimationFrame(() => {
      pty.fit();
      fx.renderStaticSnapshot();
      tour._repositionActive();
    });
    return;
  }

  void el.workspaceMain.offsetWidth;
  requestAnimationFrame(() => {
    if (disposed || gen !== flipGen) return;
    animated.forEach((p) => {
      p.style.transition = 'transform 380ms cubic-bezier(0.25, 1, 0.5, 1)';
      p.style.transform = 'none';
    });
  });

  if (flipCleanupTimer) clearTimeout(flipCleanupTimer);
  flipCleanupTimer = setTimeout(() => {
    flipCleanupTimer = null;
    if (disposed || gen !== flipGen) return;
    animated.forEach((p) => {
      p.style.removeProperty('transition');
      p.style.removeProperty('transform');
      p.style.removeProperty('transform-origin');
      p.style.removeProperty('will-change');
    });
    pty.scheduleFit();
    syncResponsiveStage(true);
    fx.syncRunning();
    if (state.activeTab === 'trends') trends.render();
    tour._repositionActive();
  }, 410);
}

function swapWorkspacePanels(panelA, panelB, save = true) {
  if (!panelA || !panelB || panelA === panelB) return;
  const g = state.gridLayout;
  const keys = ['slotA', 'slotB', 'slotC'];
  const kA = keys.find((k) => g[k] === panelA);
  const kB = keys.find((k) => g[k] === panelB);
  if (!kA || !kB) return;
  if (state.layoutMode !== 'split') setLayoutMode('split');
  animateWorkspaceFlip(() => {
    const tmp = state.gridLayout[kA];
    state.gridLayout[kA] = state.gridLayout[kB];
    state.gridLayout[kB] = tmp;
  }, save);
}

function setGridOrientation(orientation, save = true) {
  const next = orientation === 'sidebar' ? 'sidebar' : 'wide';
  if (state.deckExpanded && next === 'sidebar') setDeckExpanded(false);
  animateWorkspaceFlip(() => {
    state.gridLayout.orientation = next;
  }, save);
}

function resetGridLayout() {
  if (state.deckExpanded) setDeckExpanded(false);
  if (state.layoutMode !== 'split') setLayoutMode('split');
  el.workspaceMain?.style.setProperty('--left-pane-pct', '52%');
  el.workspaceMain?.style.setProperty('--sidebar-w', '40%');
  el.workspaceMain?.style.setProperty('--side-top-pct', '52%');
  el.workspaceMain?.style.removeProperty('--deck-h');
  try { localStorage.removeItem(STORAGE_DECK_H); } catch {}
  animateWorkspaceFlip(() => {
    state.gridLayout = { ...DEFAULT_GRID_LAYOUT };
  }, true);
}

function runTourDemoSwap(action) {
  if (action === 'preview-swap') {
    if (!demoSwapSnapshot) {
      demoSwapSnapshot = {
        gridLayout: { ...state.gridLayout },
        layoutMode: state.layoutMode,
      };
    }
    if (state.layoutMode !== 'split') setLayoutMode('split');
    el.layoutDemoPill?.classList.remove('is-hidden');
    animateWorkspaceFlip(() => {
      if (state.gridLayout.orientation === 'wide') {
        state.gridLayout.orientation = 'sidebar';
      } else {
        const tmp = state.gridLayout.slotA;
        state.gridLayout.slotA = state.gridLayout.slotB;
        state.gridLayout.slotB = tmp;
      }
    }, false);
  } else if (action === 'restore') {
    el.layoutDemoPill?.classList.add('is-hidden');
    if (!demoSwapSnapshot) return;
    const snap = demoSwapSnapshot;
    demoSwapSnapshot = null;
    animateWorkspaceFlip(() => {
      state.gridLayout = { ...snap.gridLayout };
    }, false);
    if (snap.layoutMode !== state.layoutMode) setLayoutMode(snap.layoutMode);
  } else if (action === 'restore-instant') {
    el.layoutDemoPill?.classList.add('is-hidden');
    flipGen += 1;
    const panels = Array.from(document.querySelectorAll('.ws-panel'));
    cancelPanelFlipAnimations(panels);
    if (!demoSwapSnapshot) return;
    const snap = demoSwapSnapshot;
    demoSwapSnapshot = null;
    state.gridLayout = { ...snap.gridLayout };
    applyGridLayoutToDOM();
    if (el.workspaceMain) void el.workspaceMain.offsetWidth;
    if (snap.layoutMode !== state.layoutMode) setLayoutMode(snap.layoutMode);
    requestAnimationFrame(() => {
      pty.scheduleFit();
      syncResponsiveStage(true);
      fx.syncRunning();
      tour._repositionActive();
    });
  }
}

let audioCtx = null;
function playRelayCue(kind) {
  if (!state.relayAudio || state.reducedMotion || state.motionPaused) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  try {
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (kind === 'thunk') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(118, now);
      osc.frequency.exponentialRampToValueAtTime(56, now + 0.085);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (kind === 'trip') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(215, now);
      osc.frequency.exponentialRampToValueAtTime(88, now + 0.14);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.07);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch {
  }
}

function getMod(id = state.module) {
  return MODULES.find((m) => m.id === id) || MODULES[0];
}

function contractModId(id = state.module) {
  return getMod(id).contractId;
}

function localModId(id) {
  const s = String(id || 'm01').trim().toLowerCase();
  if (s === 'm10') return s;
  return s.replace(/^m0(\d)$/, 'm$1');
}

function isOpsConsoleMod(id = state.module) {
  return id === 'm9';
}

function utcStamp() {
  return `${new Date().toISOString().slice(11, 19)} UTC`;
}

function istStamp() {
  const d = new Date(Date.now() + 19800000);
  return `${d.toISOString().slice(11, 19)} IST`;
}

function parseUtcSeconds(str) {
  const m = String(str || '').match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!m) {
    const now = new Date();
    return now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  }
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function logStation(text, cls = '') {
  if (!el.stationLogOut) return;
  const line = document.createElement('div');
  line.className = `term-line ${cls}`.trim();
  line.textContent = `[${utcStamp()}] ${text}`;
  el.stationLogOut.appendChild(line);
  while (el.stationLogOut.childElementCount > MAX_STATION_LOG_LINES && el.stationLogOut.firstElementChild) {
    el.stationLogOut.removeChild(el.stationLogOut.firstElementChild);
  }
  el.stationLogOut.scrollTop = el.stationLogOut.scrollHeight;
  if (state.rightTab !== 'log') {
    state.stationLogUnread += 1;
    el.stationLogBadge.textContent = String(state.stationLogUnread);
    el.stationLogBadge.classList.remove('is-hidden');
  }
}

function syncEvalButtons() {
  const disabled = !state.liveConnected || state.verifyInFlight;
  el.btnPractice.disabled = disabled;
  el.btnSubmit.disabled = disabled;
}

function syncL3HintUI() {
  const m = getMod();
  const h3 = el.hint3 || document.getElementById('hint-3');
  const unlockBtn = el.btnUnlockL3 || document.getElementById('btn-unlock-l3');
  const unlocked = state.l3Unlocked.has(m.id);
  if (h3) {
    h3.textContent = unlocked ? (state.l3HintText[m.id] || 'Level 3 hint unlocked.') : '';
    h3.classList.toggle('is-hidden', !unlocked);
  }
  if (unlockBtn) {
    unlockBtn.textContent = unlocked ? 'Unlocked (-10%)' : 'Reveal hint';
    unlockBtn.disabled = unlocked || !state.liveConnected;
  }
}

function hydrateHintsFromCase(hintsUnlocked) {
  if (!hintsUnlocked || typeof hintsUnlocked !== 'object') return;
  for (const [cid, info] of Object.entries(hintsUnlocked)) {
    if (!info || typeof info !== 'object') continue;
    const lid = localModId(cid);
    if (info.l1) state.hintsTracked.add(`${cid}:1`);
    if (info.l2) state.hintsTracked.add(`${cid}:2`);
    if (info.l3) {
      state.l3Unlocked.add(lid);
      state.hintsTracked.add(`${cid}:3`);
      if (typeof info.l3_text === 'string' && info.l3_text.trim()) {
        state.l3HintText[lid] = info.l3_text.trim();
      }
    }
  }
  syncL3HintUI();
}

function setConnectedState(connected) {
  const prev = state.liveConnected;
  state.liveConnected = Boolean(connected);
  el.connPill.textContent = state.liveConnected ? 'Connected' : 'Not connected';
  el.connPill.classList.toggle('is-connected', state.liveConnected);
  el.connPill.classList.toggle('is-disconnected', !state.liveConnected);
  syncEvalButtons();
  syncL3HintUI();
  if (prev && !state.liveConnected) {
    logStation('Station link disconnected. Practice and Submit disabled until reconnected.', 't-err');
    tour.notifyEvent('connection-lost');
    syncSceneDOM();
  }
  fx.syncRunning();
}

async function apiJson(method, path, payload = null) {
  if (disposed) return null;
  try {
    const res = await transport.apiJson(method, path, payload);
    if (!res) {
      setConnectedState(false);
      return null;
    }
    if (res.status === 0 || (res.status >= 502 && res.status <= 504)) {
      setConnectedState(false);
    }
    return res;
  } catch {
    setConnectedState(false);
    return null;
  }
}

function setRightTab(tab) {
  state.rightTab = tab;
  el.termView.classList.toggle('is-hidden', tab !== 'terminal');
  el.stationLogView.classList.toggle('is-hidden', tab !== 'log');
  el.editorView.classList.toggle('is-hidden', tab !== 'editor');
  el.btnRightTerm.classList.toggle('is-active', tab === 'terminal');
  el.btnRightLog.classList.toggle('is-active', tab === 'log');
  el.btnToggleEditor.classList.toggle('is-active', tab === 'editor');
  el.btnRightTerm.setAttribute('aria-selected', String(tab === 'terminal'));
  el.btnRightLog.setAttribute('aria-selected', String(tab === 'log'));
  el.btnToggleEditor.setAttribute('aria-selected', String(tab === 'editor'));
  if (tab === 'log') {
    state.stationLogUnread = 0;
    el.stationLogBadge.classList.add('is-hidden');
    tour.notifyEvent('station-log-opened');
  } else if (tab === 'terminal') {
    requestAnimationFrame(() => { if (!disposed) { pty.fit(); pty.focus(); } });
  } else if (tab === 'editor') {
    const targetFile = getActiveEditorFilename();
    if (!(state.editorDirty && state.editorLoadedFile === targetFile)) {
      void loadEditorFile(targetFile, false);
    }
    el.editorText.focus();
  }
}

function setLayoutMode(mode) {
  const valid = ['scene', 'split', 'terminal'].includes(mode) ? mode : 'split';
  state.layoutMode = valid;
  document.documentElement.dataset.layout = valid;
  document.querySelectorAll('[data-layout-mode]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.layoutMode === valid);
  });
  try { localStorage.setItem(STORAGE_LAYOUT, valid); } catch {}
  fx.syncRunning();
  requestAnimationFrame(() => {
    pty.scheduleFit();
    syncResponsiveStage(true);
    if (state.activeTab === 'trends') trends.render();
    tour._repositionActive();
  });
}

function setDeckExpanded(expanded) {
  state.deckExpanded = Boolean(expanded);
  if (state.deckExpanded) {
    document.documentElement.dataset.deckExpanded = 'true';
  } else {
    delete document.documentElement.dataset.deckExpanded;
  }
  if (el.btnDeckExpand) {
    el.btnDeckExpand.setAttribute('aria-expanded', String(state.deckExpanded));
    el.btnDeckExpand.textContent = state.deckExpanded ? 'Compact \u2198' : 'Expand \u2197';
  }
  requestAnimationFrame(() => {
    pty.scheduleFit();
    syncResponsiveStage(true);
    tour._repositionActive();
  });
}

function setSceneView(viewName) {
  const valid = ['city', 'substation', 'network'].includes(viewName) ? viewName : 'city';
  state.activeView = valid;
  el.stageViewport.dataset.view = valid;
  document.querySelectorAll('[data-scene-view]').forEach((btn) => {
    const active = btn.dataset.sceneView === valid;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  ['city', 'substation', 'network'].forEach((v) => {
    document.getElementById(`view-${v}`)?.classList.toggle('is-active', v === valid);
    document.getElementById(`lbl-view-${v}`)?.classList.toggle('is-active', v === valid);
    document.getElementById(`lens-view-${v}`)?.classList.toggle('is-active', v === valid);
    document.getElementById(`lens-lbl-view-${v}`)?.classList.toggle('is-active', v === valid);
  });
  el.breakerLegend.classList.toggle('is-hidden', valid !== 'substation');
  fx.syncRunning();
  fx.renderStaticSnapshot();
  if (valid === 'substation') tour.notifyEvent('view-substation');
}

function setTab(tabName) {
  const resolvedTab = TAB_TO_GROUP[tabName] ? tabName : 'brief';
  const group = TAB_TO_GROUP[resolvedTab] || 'mission';
  state.activeTab = resolvedTab;
  state.activeGroup = group;
  state.lastSubTabByGroup[group] = resolvedTab;

  if (resolvedTab !== 'case' && document.documentElement.dataset.shiftReport === 'open') {
    story.openShiftReportFull(false);
  }

  document.querySelectorAll('[data-nav-group]').forEach((btn) => {
    const active = btn.dataset.navGroup === group;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  const hasSubbar = group !== 'mission';
  el.deckSubbars?.classList.toggle('is-hidden', !hasSubbar);
  ['station', 'evidence', 'progress'].forEach((g) => {
    document.getElementById(`subbar-${g}`)?.classList.toggle('is-hidden', group !== g);
  });

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    const active = btn.dataset.tab === resolvedTab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.classList.toggle('is-hidden', panel.dataset.tabPanel !== resolvedTab);
  });

  if (resolvedTab === 'alarms') {
    refreshAlarms();
    refreshSoe();
  } else if (resolvedTab === 'frames') {
    refreshFrames();
    tour.notifyEvent('frames-opened');
  } else if (resolvedTab === 'trends') {
    trends.render();
  } else if (resolvedTab === 'console') {
    if (isOpsConsoleMod()) syncInlinePhysics();
  } else if (resolvedTab === 'timeline') {
    renderTimelineView();
  } else if (resolvedTab === 'dispatch') {
    tour.notifyEvent('tab-dispatch');
  } else if (resolvedTab === 'case') {
    story.refreshCaseBoard();
  }
}

function setTheme(theme, fromUser = false) {
  state.theme = theme;
  const isDark = theme === 'ember' || theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', !isDark);
  document.documentElement.dataset.theme = isDark ? 'ember' : 'daylight';
  const lbl = document.getElementById('theme-label');
  if (lbl) lbl.textContent = isDark ? 'Ember' : 'Daylight';
  if (el.btnTheme) {
    el.btnTheme.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    el.btnTheme.title = isDark ? 'Switch to Daylight (light)' : 'Switch to Ember (dark)';
  }
  const suffix = isDark ? 'dark' : 'light';
  document.querySelectorAll('image[data-sprite]').forEach((img) => {
    const key = img.getAttribute('data-sprite');
    if (key) img.setAttribute('href', `${assetBase}/${key}-${suffix}.webp`);
  });
  fx.renderStaticSnapshot();
  if (state.activeTab === 'trends') trends.render();
  tour._repositionActive();
  if (fromUser && typeof options.onThemeChange === 'function') {
    options.onThemeChange(isDark ? 'dark' : 'light');
  }
}

function getBlindedInsetRows() {
  const hz = typeof state.busFreqHz === 'number' ? `${state.busFreqHz.toFixed(2)} Hz` : 'Nominal';
  const kv = state.busKv > 0.1 ? `${state.busKv.toFixed(1)} kV` : 'Nominal';
  const mw = state.liveConnected ? `${state.totalMw.toFixed(1)} MW` : 'Normal';
  const almCount = state.alarms.filter((a) => a.state === 'active').length;
  return [
    ['33 kV Bus', `${kv} · ${hz}`],
    ['Reported load', `${mw} · All feeders closed`],
    ['Active alarms', `${almCount} reported`],
  ];
}

function syncPassedModulesFromSigned(passedIds, replace = false) {
  if (!Array.isArray(passedIds)) return;
  const next = replace ? new Set() : new Set(state.clearedModules);
  passedIds.forEach((cid) => {
    const lid = localModId(cid);
    if (MODULES.some((m) => m.id === lid)) next.add(lid);
  });
  const changed = next.size !== state.clearedModules.size
    || Array.from(next).some((id) => !state.clearedModules.has(id));
  state.clearedModules = next;
  if (changed) {
    renderHeaderProgress();
    renderModuleRail();
    renderChecksTab();
  }
}

function renderHeaderProgress() {
  el.segBar.replaceChildren();
  SCORED_MODULES.forEach((m) => {
    const pip = document.createElement('span');
    pip.className = 'seg-pip';
    const cleared = state.clearedModules.has(m.id);
    if (cleared) pip.classList.add('is-cleared');
    else if (m.id === state.module) pip.classList.add('is-current');
    else if (state.attemptedModules.has(m.id)) pip.classList.add('is-attempted');
    const st = cleared ? 'Cleared' : m.id === state.module ? 'Current' : 'Not cleared';
    pip.title = `M${m.num}: ${m.title} (${st})`;
    pip.setAttribute('aria-label', pip.title);
    el.segBar.appendChild(pip);
  });
  const count = SCORED_MODULES.filter((m) => state.clearedModules.has(m.id)).length;
  el.segBar.setAttribute('aria-valuenow', String(count));
  el.progressText.textContent = `${count}/10`;
  if (el.navCaseProgress) {
    el.navCaseProgress.textContent = `${count}/10`;
  }
}

function renderModuleRail() {
  el.railList.replaceChildren();
  SCORED_MODULES.forEach((m) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rail-item-btn';
    const isCleared = state.clearedModules.has(m.id);
    if (m.id === state.module) btn.classList.add('is-selected');
    if (isCleared) btn.classList.add('is-cleared');
    const discText = isCleared ? '&#10003;' : m.isFullOp ? 'OP' : m.num;
    const subText = m.isFullOp ? m.time : `${m.pts} pts · ${m.time}`;
    btn.innerHTML = `
      <span class="rail-disc tabular">${discText}</span>
      <span class="rail-item-copy">
        <span class="rail-item-title">${escHtml(m.title)}</span>
        <span class="rail-item-pts tabular">${escHtml(subText)}</span>
      </span>`;
    btn.addEventListener('click', () => {
      switchModuleFromRail(m.id);
      if (window.innerWidth <= 900) toggleRail(false);
    });
    li.appendChild(btn);
    el.railList.appendChild(li);
  });
}

function toggleRail(force) {
  state.railOpen = typeof force === 'boolean' ? force : !state.railOpen;
  el.rail.classList.toggle('is-collapsed', !state.railOpen);
  el.btnRail.setAttribute('aria-expanded', String(state.railOpen));
  requestAnimationFrame(() => {
    if (disposed) return;
    pty.fit();
    tour._repositionActive();
  });
  if (railRepositionTimer) clearTimeout(railRepositionTimer);
  railRepositionTimer = setTimeout(() => {
    railRepositionTimer = null;
    if (!disposed) tour._repositionActive();
  }, 240);
}

function loadObjectiveTicks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_OBJ) || '{}'); } catch { return {}; }
}

function setChecklistOpen(open) {
  const isOpen = Boolean(open);
  el.objCard.classList.toggle('is-collapsed', !isOpen);
  if (el.objCollapseBtn) {
    el.objCollapseBtn.setAttribute('aria-expanded', String(isOpen));
  }
  if (el.objChev) {
    el.objChev.textContent = isOpen ? '\u25B4' : '\u25BE';
  }
  const stObj = document.getElementById('state-objectives');
  if (stObj) stObj.textContent = isOpen ? 'Open' : 'Closed';
  if (isOpen) tour.notifyEvent('objective-opened');
  requestAnimationFrame(() => tour._repositionActive());
}

function renderObjectiveCard() {
  const m = getMod();
  el.objTitle.textContent = m.isFullOp ? 'Full Op Objectives' : `M${m.num} Objectives`;
  el.objArtifact.textContent = m.artifactNote || m.artifact;
  const saved = loadObjectiveTicks();
  const modTicks = saved[m.id] || {};
  el.objList.replaceChildren();
  (m.objectives || []).forEach((txt, idx) => {
    const li = document.createElement('li');
    li.className = 'obj-item';
    const checked = Boolean(modTicks[idx]);
    li.innerHTML = `<label><input type="checkbox" ${checked ? 'checked' : ''}/><span>${escHtml(txt)}</span></label>`;
    li.querySelector('input').addEventListener('change', (e) => {
      const all = loadObjectiveTicks();
      if (!all[m.id]) all[m.id] = {};
      all[m.id][idx] = e.target.checked;
      try { localStorage.setItem(STORAGE_OBJ, JSON.stringify(all)); } catch {}
    });
    el.objList.appendChild(li);
  });
}

function renderMissionKeyTerms(m) {
  if (!el.missionKeyTerms) return;
  const termIds = Array.isArray(m.keyTerms) ? m.keyTerms : [];
  if (!termIds.length) {
    el.missionKeyTerms.classList.add('is-hidden');
    el.missionKeyTerms.replaceChildren();
    return;
  }
  el.missionKeyTerms.replaceChildren();
  const lbl = document.createElement('span');
  lbl.className = 'key-terms-label';
  lbl.textContent = 'Key terms:';
  el.missionKeyTerms.appendChild(lbl);

  termIds.forEach((tid) => {
    const entry = GLOSSARY_TERMS.find((t) => t.id === tid);
    if (!entry) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'term-chip-btn';
    btn.dataset.termChip = entry.id;
    btn.textContent = entry.term;
    btn.title = `${entry.fullForm}: click to open Glossary`;
    btn.addEventListener('click', () => glossary.open(entry.id));
    el.missionKeyTerms.appendChild(btn);
  });
  el.missionKeyTerms.classList.remove('is-hidden');
}

function renderBriefAndChecks() {
  const m = getMod();
  const shortTitle = story.getModuleShortTitle(m.contractId) || m.title.split(' ')[0];
  el.hdrModBadge.textContent = m.isFullOp ? 'OP' : `M${m.num}`;
  el.hdrModMeta.textContent = m.isFullOp ? '· Full op' : `· ${shortTitle}`;
  el.hdrModMeta.title = m.isFullOp ? 'Full operation mode' : `Module ${m.num} of 10`;

  story.renderMissionStoryBanner(m.contractId, () => setTab('dispatch'));
  renderMissionKeyTerms(m);

  document.getElementById('brief-title').textContent = m.title;
  const artDisp = m.artifactNote || m.artifact;
  document.getElementById('brief-meta').textContent = m.isFullOp
    ? `Full operation mode · 6 gates · Artifact: ${artDisp}`
    : `Module ${m.num} of 10 · ${m.pts} points (pass ${m.pass}) · ${m.time} · Artifact: ${artDisp}`;
  document.getElementById('brief-scenario').textContent = m.scenario;
  document.getElementById('brief-roe').textContent = m.roe;
  document.getElementById('brief-steps').innerHTML = m.steps.map((s) => `<li>${escHtml(s)}</li>`).join('');

  document.getElementById('hint-1').textContent = m.hints[0] || '';
  document.getElementById('hint-2').textContent = m.hints[1] || '';
  if (el.hintDetails1) el.hintDetails1.open = false;
  if (el.hintDetails2) el.hintDetails2.open = false;
  syncL3HintUI();

  const consoleKey = ['m1', 'm4', 'm8', 'm9'].includes(m.id) ? m.id : 'other';
  document.querySelectorAll('[data-console]').forEach((v) => {
    v.classList.toggle('is-hidden', v.dataset.console !== consoleKey);
  });
  if (consoleKey === 'other') {
    document.getElementById('other-console-title').textContent = `${m.title} workbench`;
  }
  const briefJumpBtn = document.getElementById('btn-brief-open-console');
  if (briefJumpBtn) {
    const jump = MODULE_PRIMARY_JUMP[m.id] || { tab: 'console', label: 'Open Controls' };
    briefJumpBtn.textContent = jump.label;
    briefJumpBtn.dataset.jumpTab = jump.tab;
  }

  syncEditorFileSelector(m);
  const shortFile = getActiveEditorFilename(m);
  el.editorToggleLabel.textContent = `Edit ${shortFile}`;
  el.btnToggleEditor.title = `Edit ~/workspace/${shortFile}`;
  el.editorPath.textContent = `~/workspace/${shortFile}`;
  el.submitArtifact.textContent = shortFile;
  el.submitArtifact.title = m.artifactNote || m.artifact;
  if (state.rightTab === 'editor' && state.editorLoadedFile !== shortFile) {
    void loadEditorFile(shortFile, false);
  }

  renderObjectiveCard();
  renderChecksTab();
  renderHistoryTab();
}

function syncM7ShimPill() {
  if (!el.m7ShimPill) return;
  const showM7 = state.module === 'm7';
  el.m7ShimPill.classList.toggle('is-hidden', !showM7);
  if (!showM7) return;
  const removed = !state.shimActive;
  el.m7ShimPill.classList.toggle('is-removed', removed);
  el.m7ShimPill.textContent = removed
    ? 'Shim status: Removed (live truth)'
    : 'Shim status: Active (blinded | remove in terminal)';
}

function syncM9ResetControls() {
  const trips = state.tripEvents;
  const pen = state.tripPenaltyPct;
  const maxPen = state.maxTripPenaltyPct || 30;
  if (el.btnResetElectrical) {
    el.btnResetElectrical.textContent = 'Reset electrical state';
  }
  if (el.checksResetNotice) {
    const showNotice = state.module === 'm9';
    el.checksResetNotice.classList.toggle('is-hidden', !showNotice);
    if (showNotice) {
      const warn3 = trips >= 2
        ? ' Warning: a 3rd trip disqualifies both Full Pass and Safe Partial.'
        : ' Avoid 3 trips (disqualifies Full Pass and Safe Partial).';
      el.checksResetNotice.textContent = `Each protection trip in Module 9 costs 10% (max ${maxPen}%). Trips so far: ${trips}${pen > 0 ? ` (-${pen}%)` : ''}.${warn3}`;
    }
  }
}

function renderChecksTab(lastResult = null) {
  const m = getMod();
  const attempts = state.attemptsByModule[m.id] || [];
  const latest = lastResult || attempts[0] || null;
  el.checksMeta.textContent = m.isFullOp
    ? `Full op gates: 6 required · Last check: ${latest ? latest.id : 'None'}`
    : `To pass: ${m.pass}/${m.pts} points · Last check: ${latest ? latest.id : 'None'}`;
  syncM9ResetControls();

  if (latest) {
    el.resultBanner.classList.remove('is-hidden');
    el.resultBanner.classList.toggle('is-pass', Boolean(latest.passed));
    el.bannerTitle.textContent = latest.title || (latest.passed ? `Passed (${latest.score}/${m.pts} pts)` : `Criteria pending (${latest.passedCount}/${latest.totalCount} areas)`);
    el.bannerDetail.textContent = latest.summary || '';
    el.btnNextMod.classList.toggle('is-hidden', !latest.passed || m.num >= 10);
  } else {
    el.resultBanner.classList.add('is-hidden');
  }

  story.renderCloserAndDebrief(m.contractId, state.clearedModules.has(m.id));

  if (latest && Array.isArray(latest.areas) && latest.areas.length) {
    el.rubricList.innerHTML = latest.areas
      .map((a) => `<li class="rubric-row"><span>${escHtml(a.area)}: ${escHtml(a.message)}</span><span class="cell-s ${a.passed >= a.total ? 'state-mint' : 'state-amber'}">${Number(a.passed) || 0}/${Number(a.total) || 0}</span></li>`)
      .join('');
  } else {
    el.rubricList.innerHTML = m.rubric
      .map((desc) => `<li class="rubric-row"><span>${escHtml(desc)}</span><span class="cell-s state-muted">Pending</span></li>`)
      .join('');
  }
}

function renderHistoryTab() {
  const m = getMod();
  const attempts = state.attemptsByModule[m.id] || [];
  if (!attempts.length) {
    el.historyList.innerHTML = '<li class="muted-empty">No checks submitted for this module yet.</li>';
    return;
  }
  el.historyList.innerHTML = attempts
    .map((a, idx) => `<li class="history-row"><span class="tabular">Attempt #${attempts.length - idx} · ${escHtml(a.id)} · ${escHtml(a.time)}</span><span class="cell-s ${a.passed ? 'state-mint' : 'state-amber'}">${a.passed ? `Passed (${Number(a.score) || 0} pts)` : `${Number(a.passedCount) || 0}/${Number(a.totalCount) || 0} areas`}</span></li>`)
    .join('');
}

function syncPolicyRulesForPair(pair, action, portsRaw) {
  const prefix = `${pair.src}->${pair.dst}:`;
  for (const k of Object.keys(state.policyRules)) {
    if (k.startsWith(prefix)) delete state.policyRules[k];
  }
  if (action !== 'allow' && action !== 'deny') return;
  const parts = String(portsRaw || '').split(/[\s,;]+/).filter(Boolean);
  for (const part of parts) {
    const port = parseInt(part, 10);
    if (port >= 1 && port <= 65535) {
      state.policyRules[`${prefix}${port}`] = { src: pair.src, dst: pair.dst, port, action };
    }
  }
}

function buildEmptyPolicyMatrixUI() {
  const host = document.getElementById('policy-matrix');
  host.replaceChildren();
  ZONE_PAIRS.forEach((pair) => {
    const card = document.createElement('div');
    card.className = 'policy-pair-card';
    card.dataset.policyPair = pair.key;
    card.innerHTML = `
      <span class="policy-pair-label">${escHtml(pair.src)} &#8594; ${escHtml(pair.dst)}</span>
      <div class="policy-pair-inputs">
        <select data-pair-action="${escHtml(pair.key)}" aria-label="Action for ${escHtml(pair.src)} to ${escHtml(pair.dst)}">
          <option value="">-- unset --</option>
          <option value="allow">allow</option>
          <option value="deny">deny</option>
        </select>
        <input type="text" inputmode="numeric" placeholder="port(s)" data-pair-port="${escHtml(pair.key)}" aria-label="Port or comma-separated ports for ${escHtml(pair.src)} to ${escHtml(pair.dst)}" />
      </div>`;
    const actSel = card.querySelector(`[data-pair-action="${pair.key}"]`);
    const portInp = card.querySelector(`[data-pair-port="${pair.key}"]`);
    const onPairEdit = () => syncPolicyRulesForPair(pair, actSel.value, portInp.value);
    actSel.addEventListener('change', onPairEdit);
    portInp.addEventListener('input', onPairEdit);
    host.appendChild(card);
  });

  const srcSel = document.getElementById('m8-probe-src');
  const dstSel = document.getElementById('m8-probe-dst');
  if (srcSel && dstSel) {
    srcSel.innerHTML = ZONES.map((z) => `<option value="${escHtml(z)}">${escHtml(z)}</option>`).join('');
    dstSel.innerHTML = ZONES.map((z) => `<option value="${escHtml(z)}">${escHtml(z)}</option>`).join('');
    dstSel.value = 'L1_FIELD';
  }
}

function policyMatrixToYaml() {
  const dp = document.getElementById('m8-default-policy')?.value === 'allow' ? 'allow' : 'deny';
  return serializePolicyRulesToYaml(dp, state.policyRules);
}

function hydrateMatrixFromYaml(yamlText) {
  const parsed = parsePolicyYamlToRules(yamlText);
  state.policyRules = { ...parsed.rules };
  const dpSel = document.getElementById('m8-default-policy');
  if (dpSel) dpSel.value = parsed.defaultPolicy;

  const grouped = {};
  for (const r of Object.values(state.policyRules)) {
    const pk = `${r.src}->${r.dst}`;
    if (!grouped[pk]) grouped[pk] = { action: r.action, ports: [] };
    grouped[pk].ports.push(r.port);
  }
  ZONE_PAIRS.forEach((pair) => {
    const g = grouped[pair.key];
    const actSel = document.querySelector(`[data-pair-action="${pair.key}"]`);
    const portInp = document.querySelector(`[data-pair-port="${pair.key}"]`);
    if (actSel) actSel.value = g ? g.action : '';
    if (portInp) portInp.value = g ? g.ports.sort((a, b) => a - b).join(', ') : '';
  });
}

function bayDisplayInfo(bayNum) {
  const bayId = `BAY-0${bayNum}`;
  const b = state.bays[bayId] || {};
  const roleKey = state.truthVisible && b.role ? String(b.role) : null;
  const rm = roleKey ? ROLE_META[roleKey] : null;
  return {
    bayId,
    closed: Boolean(b.closed),
    roleKey,
    label: bayId,
    name: rm ? rm.name : `Bay 0${bayNum}`,
    shortName: rm ? rm.shortName : `Bay 0${bayNum}`,
    tier: rm ? rm.tier : 'Unmapped',
    steadyMw: typeof b.steady_mw === 'number' ? b.steady_mw : (typeof b.mw === 'number' ? b.mw : null),
    clpuMult: typeof b.clpu_mult === 'number' ? b.clpu_mult : null,
  };
}

function syncSceneDOM() {
  if (disposed) return;
  if (typeof document !== 'undefined' && document.hidden) {
    state.sceneDomDirtyWhileHidden = true;
    return;
  }
  state.sceneDomDirtyWhileHidden = false;
  syncM7ShimPill();
  syncM9ResetControls();
  story.updateStakesStrip({
    districts: state.districts,
    dispatchEntries: state.dispatch,
    liveConnected: state.liveConnected,
  });

  const mod = getMod();
  const isPreM7 = mod.num <= 7;
  const opsMode = isOpsConsoleMod();
  const replayOn = opsMode && state.soeReplay.available && state.soeReplay.active;
  const rf = replayOn ? state.soeReplay.frames[state.soeReplay.index] : null;

  const viewBusHz = rf ? rf.busFreqHz : state.busFreqHz;
  const viewGenHz = rf ? rf.genFreqHz : state.genFreqHz;
  const viewKv = rf ? rf.busKv : state.busKv;
  const viewTr1 = rf ? rf.tr1Pct : state.tr1Pct;
  const viewTr2 = rf ? rf.tr2Pct : state.tr2Pct;
  const viewMw = rf ? rf.totalMw : state.totalMw;
  const viewLockout = rf ? rf.lockout86 : state.lockout86;
  const viewLockoutAssets = rf && Array.isArray(rf.lockoutAssets) ? rf.lockoutAssets : state.activeLockouts;
  const viewBusesLive = rf ? rf.busesLive : viewKv > 0.5;

  const preset = CAMERA_PRESETS[state.module] || CAMERA_PRESETS.m1;
  el.cameraRig.style.transform = preset.transform;
  el.hudCameraLabel.textContent = preset.label;

  const showLensBtn = state.module === 'm4';
  el.btnSplitLens.classList.toggle('is-hidden', !showLensBtn);
  const lensActive = showLensBtn && state.splitLensOn;
  el.btnSplitLens.setAttribute('aria-pressed', String(lensActive));
  el.lensHmiLayer.classList.toggle('is-hidden', !lensActive);
  el.lensLabelsLayer.classList.toggle('is-hidden', !lensActive);
  el.lensDivider.classList.toggle('is-hidden', !lensActive);
  el.lensHmiLayer.style.clipPath = `inset(0 ${100 - state.lensPct}% 0 0)`;
  el.lensLabelsLayer.style.clipPath = `inset(0 ${100 - state.lensPct}% 0 0)`;
  el.svgHost.style.clipPath = lensActive ? `inset(0 0 0 ${state.lensPct}%)` : '';
  el.svgLabelsHost.style.clipPath = lensActive ? `inset(0 0 0 ${state.lensPct}%)` : '';
  el.lensDivider.style.left = `${state.lensPct}%`;
  el.lensDivider.setAttribute('aria-valuenow', String(Math.round(state.lensPct)));

  const showLockout = opsMode && viewLockout;
  el.hudCameraLabel.classList.toggle('is-hidden', showLockout && !replayOn);
  el.hudLockoutPill.classList.toggle('is-hidden', !showLockout || replayOn);
  if (showLockout) {
    const assetLabel = viewLockoutAssets.length ? viewLockoutAssets.join(', ') : 'station';
    setTextIfChanged(el.hudLockoutPill, `Lockout 86 active on ${assetLabel}`);
  }
  el.chkTr2.checked = state.tr2Online;
  el.btnClear86.disabled = !(opsMode && state.lockout86 && state.liveConnected);
  el.soePanel.classList.toggle('is-hidden', !(opsMode && state.soeReplay.available));

  sceneDom.feederLines?.classList.toggle('is-masked', !state.truthVisible);
  sceneDom.cableGalleryMask?.classList.toggle('is-active', !state.truthVisible);

  const tieEl = sceneDom.cb220Tie1;
  const tieLive = state.tieClosed && !replayOn;
  tieEl?.classList.toggle('is-closed', tieLive);
  tieEl?.classList.toggle('is-open', !tieLive);
  tieEl?.classList.toggle('is-operable', opsMode && state.liveConnected);
  sceneDom.tieStemLower?.classList.toggle('is-live', tieLive);
  sceneDom.bus220A?.classList.toggle('is-hv-live', tieLive);

  sceneDom.busLines.forEach(({ id, node }) => {
    if (!node) return;
    node.classList.toggle('is-live', id === 'tr1-lv-stem' ? !viewLockout && viewBusesLive : viewBusesLive);
  });

  if (sceneDom.bc1Coupler) {
    sceneDom.bc1Coupler.classList.toggle('is-closed', viewBusesLive);
    sceneDom.bc1Coupler.classList.toggle('is-open', !viewBusesLive);
  }
  setTextIfChanged(
    sceneDom.genSvgHz,
    typeof viewGenHz === 'number' ? `GEN-132: ${viewGenHz.toFixed(2)} Hz` : '42 MW island turbine'
  );

  if (sceneDom.tr1Glow) {
    const tr1Fill = showLockout || viewTr1 > 95 ? 'url(#grad-tr-hot)' : viewTr1 >= 75 ? 'url(#grad-tr-warn)' : 'url(#grad-tr-calm)';
    if (sceneDom.tr1Glow.getAttribute('fill') !== tr1Fill) sceneDom.tr1Glow.setAttribute('fill', tr1Fill);
    sceneDom.tr1Glow.style.opacity = showLockout ? '0.88' : String(Math.min(0.84, 0.1 + (viewTr1 / 115) * 0.72));
  }
  if (sceneDom.tr2Glow) {
    const tr2Fill = viewTr2 > 95 ? 'url(#grad-tr-hot)' : viewTr2 >= 75 ? 'url(#grad-tr-warn)' : 'url(#grad-tr-calm)';
    if (sceneDom.tr2Glow.getAttribute('fill') !== tr2Fill) sceneDom.tr2Glow.setAttribute('fill', tr2Fill);
    sceneDom.tr2Glow.style.opacity = state.tr2Online ? String(Math.min(0.8, 0.1 + (viewTr2 / 115) * 0.68)) : '0.04';
  }

  setTextIfChanged(sceneDom.tr1SvgPct, showLockout ? 'Trip 86' : `${viewTr1}%`);
  setTextIfChanged(sceneDom.tr2SvgPct, state.tr2Online ? `${viewTr2}%` : 'Standby');
  sceneDom.tr1Lockout86?.classList.toggle('is-visible', showLockout);
  sceneDom.tr2Unit?.classList.toggle('is-operable', opsMode && state.liveConnected);

  sceneDom.tr2Lines.forEach((node) => {
    node?.classList.toggle('is-live', state.tr2Online);
  });

  const statusLabelFor = (s) => (s === 'lit' ? 'Energized' : s === 'diesel' ? 'Backup diesel' : s === 'dark' ? 'De-energized' : 'Unknown');
  const mobStatuses = [];

  sceneDom.bays.forEach((entry) => {
    const { slot, n, distEl, distLblGrp, distStatusEl, lineEl, bayEl, bayLblGrp, bayIdEl, bayLabel, baySub } = entry;
    const info = bayDisplayInfo(n);

    const dState = state.districts && state.districts[slot.sprite] ? state.districts[slot.sprite] : 'unknown';
    distEl?.classList.toggle('is-lit', dState === 'lit');
    distEl?.classList.toggle('is-diesel', dState === 'diesel');
    distLblGrp?.classList.toggle('is-lit', dState === 'lit');
    distLblGrp?.classList.toggle('is-diesel', dState === 'diesel');
    setTextIfChanged(distStatusEl, statusLabelFor(dState));
    mobStatuses.push({ name: slot.shortName, state: dState });

    const rfBay = rf && rf.breakers ? rf.breakers[info.bayId] : null;
    const closed = rfBay !== null ? Boolean(rfBay) : info.closed;
    const energized = closed && viewBusesLive;

    bayEl?.classList.toggle('is-operable', opsMode && state.liveConnected);
    bayEl?.classList.toggle('is-selected', opsMode && state.selectedBayId === info.bayId);
    bayEl?.classList.toggle('is-closed', energized);
    bayEl?.classList.toggle('is-open', !energized);
    bayEl?.classList.toggle('is-locked', showLockout && !energized);

    bayLblGrp?.classList.toggle('is-closed', energized);
    bayLblGrp?.classList.toggle('is-open', !energized);
    bayLblGrp?.classList.toggle('is-locked', showLockout && !energized);

    setTextIfChanged(bayIdEl, info.bayId);
    if (!state.truthVisible || isPreM7) {
      setTextIfChanged(bayLabel, '33 kV Feeder');
      setTextIfChanged(baySub, energized ? 'Closed · Unmapped' : 'Open · Unmapped');
      lineEl?.classList.remove('is-live', 'is-tripped');
    } else {
      setTextIfChanged(bayLabel, info.name);
      const mwStr = info.steadyMw !== null ? ` · ${info.steadyMw.toFixed(1)} MW` : '';
      setTextIfChanged(baySub, showLockout ? 'Open · Lockout 86' : energized ? `Closed${mwStr}` : `Open · ${info.tier}`);
      lineEl?.classList.toggle('is-live', energized);
      lineEl?.classList.toggle('is-tripped', showLockout);
    }
  });

  setTextIfChanged(
    el.mobSummary,
    state.liveConnected
      ? `${state.tieClosed ? 'Grid synced' : 'Islanded on GEN-132-GT1'} · Tie ${state.tieClosed ? 'Closed' : 'Open'}`
      : 'Not connected'
  );
  const mobKey = mobStatuses.map((d) => `${d.name}:${d.state}`).join('|');
  if (mobKey !== lastMobStripKey) {
    lastMobStripKey = mobKey;
    el.mobStrip.innerHTML = mobStatuses
      .map((d) => `<div class="mob-dist-tile ${d.state === 'lit' ? 'is-lit' : d.state === 'diesel' ? 'is-diesel' : ''}"><span>${escHtml(d.name)}</span><span>${d.state === 'lit' ? 'On' : d.state === 'diesel' ? 'Diesel' : d.state === 'dark' ? 'Off' : '--'}</span></div>`)
      .join('');
  }

  if (!state.truthVisible) {
    sceneDom.screens.forEach((s) => s?.classList.remove('is-truth-open'));
  } else {
    const openCount = BAY_SLOTS.filter((slot) => !bayDisplayInfo(slot.idx + 1).closed || !viewBusesLive).length;
    sceneDom.screens.forEach((s, i) => s?.classList.toggle('is-truth-open', i < Math.min(4, openCount)));
  }

  sceneDom.m1Comms.forEach((node) => {
    node?.classList.toggle('is-highlighted', state.module === 'm1' && state.m1Highlight);
  });

  const showShields = state.module === 'm8' && state.m8ShieldsRaised;
  sceneDom.shields.forEach((node) => {
    node?.classList.toggle('is-raised', showShields);
  });

  if (!state.liveConnected) {
    setTextIfChanged(el.telemHz, '--');
    setTextIfChanged(el.telemGenHz, '--');
    setTextIfChanged(el.telemKv, '--');
    setTextIfChanged(el.telemTr1, '--');
    setTextIfChanged(el.telemTr2, '--');
    setTextIfChanged(el.telemMw, '--');
    el.telemMw.title = '';
    setTextIfChanged(el.telemLink, '--');
  } else {
    const deadBus = viewBusHz === null || viewKv <= 0.1;
    setTextIfChanged(el.telemHz, deadBus ? '--' : `${viewBusHz.toFixed(2)} Hz`);
    setClassIfChanged(el.telemHz, `rail-v tabular ${deadBus ? '' : viewBusHz < 49.9 || viewBusHz > 50.05 ? 'val-danger' : ''}`);

    setTextIfChanged(el.telemGenHz, typeof viewGenHz === 'number' ? `${viewGenHz.toFixed(2)} Hz` : '--');
    setClassIfChanged(el.telemGenHz, `rail-v-sub tabular ${typeof viewGenHz === 'number' && (viewGenHz < 49.9 || viewGenHz > 50.05) ? 'val-warn' : ''}`);

    setTextIfChanged(el.telemKv, `${viewKv.toFixed(1)} kV`);
    setClassIfChanged(el.telemKv, `rail-v tabular ${viewKv < 31.35 ? 'val-danger' : ''}`);

    setTextIfChanged(el.telemTr1, showLockout ? 'Trip 86' : `${viewTr1}%`);
    setClassIfChanged(el.telemTr1, `rail-v-sub tabular ${showLockout || viewTr1 >= 100 ? 'val-danger' : viewTr1 >= 85 ? 'val-warn' : ''}`);

    setTextIfChanged(el.telemTr2, state.tr2Online ? `${viewTr2}%` : 'Standby');
    if (state.tieClosed && !rf) {
      setTextIfChanged(el.telemMw, `${viewMw.toFixed(1)} MW (Gen ${state.genMw.toFixed(0)} / Tie ${state.gridTieMw.toFixed(0)})`);
      el.telemMw.title = `Station load ${viewMw.toFixed(1)} MW | GEN-132-GT1 ${state.genMw.toFixed(1)} MW | 220 kV Tie ${state.gridTieMw.toFixed(1)} MW`;
    } else {
      setTextIfChanged(el.telemMw, `${viewMw.toFixed(1)} MW`);
      el.telemMw.title = `Station load ${viewMw.toFixed(1)} MW`;
    }

    const linkTxt = typeof state.pollPct === 'number' ? `${state.pollPct.toFixed(1)}%` : '--';
    setTextIfChanged(el.telemLink, linkTxt);
    setClassIfChanged(el.telemLink, `rail-v-sub tabular ${typeof state.pollPct === 'number' && state.pollPct < 99.0 ? 'val-danger' : 'val-mint'}`);
  }

  setTextIfChanged(sceneDom.m1Rtu1State, state.rtu1Connected ? 'Active polling' : 'Offline');
  setTextIfChanged(sceneDom.m1Rtu2State, state.rtu2Connected ? 'Active polling' : 'Offline');
  setTextIfChanged(sceneDom.m1PollPct, typeof state.pollPct === 'number' ? `${state.pollPct.toFixed(1)}%` : '--');

  setTextIfChanged(sceneDom.m4HmiVal, state.liveConnected ? `${viewMw.toFixed(1)} MW reported` : '--');
  setTextIfChanged(sceneDom.m4AlarmVal, `${state.alarms.filter((a) => a.state === 'active').length} reported`);

  if (opsMode && state.activeTab === 'console') {
    syncInlinePhysics(rf);
  }
  syncFeederButtonsInPlace(rf);
  fx.syncRunning();
  fx.renderStaticSnapshot();
}

function syncInlinePhysics(rf = null) {
  const dphi = state.tieClosed ? 0 : Number(state.syncAngleDeg || 0);
  const df = state.tieClosed ? 0 : Number(state.syncDf || 0);
  const dv = state.tieClosed ? 0 : Number(state.syncDv || 0);
  const inWindow = Boolean(state.ansi25InWindow) && !state.lockout86;

  sceneDom.syncNeedle?.setAttribute('transform', `rotate(${dphi.toFixed(1)} 110 122)`);
  setTextIfChanged(sceneDom.syncDphi, state.liveConnected ? `${dphi >= 0 ? '+' : ''}${dphi.toFixed(1)}°` : '--');
  setTextIfChanged(sceneDom.syncDf, state.liveConnected ? `${df >= 0 ? '+' : ''}${df.toFixed(2)} Hz` : '--');
  setTextIfChanged(sceneDom.syncDv, state.liveConnected ? `${dv >= 0 ? '+' : ''}${dv.toFixed(2)} p.u.` : '--');
  setTextIfChanged(sceneDom.syncTieState, state.tieClosed ? 'Closed (Live)' : 'Open (Safe)');

  if (sceneDom.syncStatusSvg) {
    sceneDom.syncStatusSvg.textContent = !state.liveConnected
      ? 'Offline'
      : state.tieClosed
        ? 'Synced'
        : inWindow
          ? 'In window'
          : Math.abs(df) < 0.005
            ? 'Static offset'
            : 'Slipping';
  }

  const dispGenMw = rf ? (typeof rf.genMw === 'number' ? rf.genMw : rf.totalMw) : state.genMw;
  const dispTr1 = rf ? rf.tr1Pct : state.tr1Pct;
  const dispTr2 = rf ? rf.tr2Pct : state.tr2Pct;
  const dispLockout = rf ? rf.lockout86 : state.lockout86;

  setTextIfChanged(sceneDom.physGenMw, `${dispGenMw.toFixed(1)} / 42.0 MW`);
  if (sceneDom.meterGen) {
    sceneDom.meterGen.style.width = `${Math.min(100, Math.round((dispGenMw / 50) * 100))}%`;
    sceneDom.meterGen.className = `meter-fill ${dispGenMw > 42 ? 'is-danger' : dispGenMw > 36 ? 'is-warn' : ''}`;
  }

  setTextIfChanged(sceneDom.physTr1Mva, dispLockout ? 'Lockout 86 trip' : `${((dispTr1 / 100) * 50).toFixed(1)} MVA (${dispTr1}%)`);
  if (sceneDom.meterTr1) {
    sceneDom.meterTr1.style.width = `${Math.min(100, dispTr1)}%`;
    sceneDom.meterTr1.className = `meter-fill ${dispLockout || dispTr1 >= 100 ? 'is-danger' : dispTr1 >= 85 ? 'is-warn' : ''}`;
  }

  setTextIfChanged(sceneDom.physTr2Mva, state.tr2Online ? `${((dispTr2 / 100) * 50).toFixed(1)} MVA (${dispTr2}%)` : 'Standby (0%)');
  if (sceneDom.meterTr2) {
    sceneDom.meterTr2.style.width = `${Math.min(100, dispTr2)}%`;
  }

  const pf = !rf && state.selectedBayId ? state.livePreflight : null;
  const gGen = sceneDom.ghostGen;
  const gTr1 = sceneDom.ghostTr1;
  const gTr2 = sceneDom.ghostTr2;

  if (pf && state.selectedBayId) {
    const peakMw = Number(pf.predicted_clpu_peak_mw ?? state.totalMw);
    const tr1P = Math.round(pf.predicted_tr1_pct ?? dispTr1);
    const tr2P = Math.round(pf.predicted_tr2_pct ?? dispTr2);
    const ceiling = Number(pf.gt1_ceiling_mw ?? 46);
    if (gGen) {
      gGen.style.width = `${Math.min(100, Math.round((peakMw / 50) * 100))}%`;
      gGen.classList.toggle('is-over', !state.tieClosed && peakMw > ceiling);
    }
    if (gTr1) {
      gTr1.style.width = `${Math.min(100, tr1P)}%`;
      gTr1.classList.toggle('is-over', tr1P > 115);
    }
    if (gTr2) {
      gTr2.style.width = `${state.tr2Online ? Math.min(100, tr2P) : 0}%`;
      gTr2.classList.toggle('is-over', state.tr2Online && tr2P > 115);
    }

    const bayNum = parseInt(state.selectedBayId.slice(-1), 10);
    const info = bayDisplayInfo(bayNum);
    const actionWord = info.closed ? 'open' : 'close';
    el.sboBar.classList.remove('is-hidden');
    el.sboSummary.textContent = `Selected ${info.bayId} (${info.name}): ${actionWord} preview -> peak ${peakMw.toFixed(1)} MW, TR-1 ${tr1P}%${state.tr2Online ? `, TR-2 ${tr2P}%` : ''}`;
    el.btnSboExec.textContent = `Permit: ${actionWord} ${info.bayId}`;
  } else {
    if (gGen) gGen.style.width = '0%';
    if (gTr1) gTr1.style.width = '0%';
    if (gTr2) gTr2.style.width = '0%';
    el.sboBar.classList.add('is-hidden');
  }
}

function syncFeederButtonsInPlace(rf = null) {
  if (!isOpsConsoleMod()) {
    if (el.feederGrid.childElementCount > 0) el.feederGrid.replaceChildren();
    return;
  }
  if (el.feederGrid.childElementCount !== 6) {
    el.feederGrid.replaceChildren();
    for (let n = 1; n <= 6; n++) {
      const bayId = `BAY-0${n}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'feeder-btn is-open';
      btn.id = `btn-feeder-f${n}`;
      btn.innerHTML = `
        <span class="feeder-head">
          <span>${bayId}</span>
          <span class="feeder-status-wrap"><span class="cb-sym is-open"></span><span class="feeder-status">Open</span></span>
        </span>
        <span class="feeder-name">Bay 0${n}</span>
        <span class="feeder-load tabular"></span>`;
      btn.addEventListener('click', () => selectFeederSBO(bayId));
      el.feederGrid.appendChild(btn);
    }
  }

  const busesLive = rf ? rf.busesLive : state.busKv > 0.5;
  for (let n = 1; n <= 6; n++) {
    const info = bayDisplayInfo(n);
    const btn = document.getElementById(`btn-feeder-f${n}`);
    if (!btn) continue;
    const closed = (rf && rf.breakers ? Boolean(rf.breakers[info.bayId]) : info.closed) && busesLive;
    const isSelected = !rf && state.selectedBayId === info.bayId;
    btn.classList.toggle('is-closed', closed);
    btn.classList.toggle('is-open', !closed);
    btn.classList.toggle('is-selected', isSelected);
    btn.setAttribute('aria-pressed', String(isSelected));
    const sym = btn.querySelector('.cb-sym');
    if (sym) {
      sym.classList.toggle('is-closed', closed);
      sym.classList.toggle('is-open', !closed);
    }
    const st = btn.querySelector('.feeder-status');
    if (st) st.textContent = closed ? 'Closed' : 'Open';
    const nm = btn.querySelector('.feeder-name');
    if (nm) {
      const fullName = state.truthVisible ? info.name : `Bay 0${n}`;
      nm.textContent = fullName;
      nm.title = fullName;
      nm.setAttribute('aria-label', `${info.bayId} feeder: ${fullName}`);
    }
    const ld = btn.querySelector('.feeder-load');
    if (ld) {
      ld.textContent = state.truthVisible && info.steadyMw !== null
        ? `${info.steadyMw.toFixed(1)} MW${info.clpuMult ? `, ${info.clpuMult.toFixed(2)}x` : ''}`
        : info.tier;
    }
  }
}

async function selectFeederSBO(bayId) {
  if (!isOpsConsoleMod() || !state.liveConnected) return;
  if (state.soeReplay.active) returnSoeToLive();
  if (state.selectedBayId === bayId) {
    state.selectedBayId = null;
    state.livePreflight = null;
    syncSceneDOM();
    return;
  }
  const resp = await apiJson('POST', '/api/ems/sbo/select', { bay_id: bayId });
  if (!resp || !resp.ok || resp.data.ok === false) {
    const reason = resp && resp.data ? (resp.data.detail || resp.data.error || resp.data.reason || `HTTP ${resp.status}`) : 'unreachable';
    state.selectedBayId = null;
    state.livePreflight = null;
    logStation(`SBO select rejected on ${bayId}: ${reason}`, 't-err');
    syncSceneDOM();
    return;
  }
  state.selectedBayId = bayId;
  state.livePreflight = resp.data.preflight || {};
  const bayNum = parseInt(bayId.slice(-1), 10);
  const slot = BAY_SLOTS[bayNum - 1];
  if (slot) fx.emitWireEcho(slot.bayX, slot.bayY, 'echo', 'substation');
  logStation(`SBO select accepted on ${bayId}; live pre-flight preview loaded.`, 't-dim');
  tour.notifyEvent('m9-sbo-select');
  syncSceneDOM();
}

let permitResolver = null;
function openPermitDialog({ device, action, preflightText, onExecute }) {
  el.permitSummary.textContent = `${action.toUpperCase()} ${device}`;
  el.permitPreflight.textContent = preflightText;
  el.permitTargetId.textContent = device;
  el.permitReason.value = '';
  el.permitInput.value = '';
  if (el.permitError) el.permitError.textContent = '';
  permitResolver = { device, action, preflightText, onExecute, holdTimer: null };
  if (typeof el.permitDialog.showModal === 'function') el.permitDialog.showModal();
  else el.permitDialog.setAttribute('open', 'open');
  el.permitReason.focus();
}

function closePermitDialog() {
  if (permitResolver && permitResolver.holdTimer) clearTimeout(permitResolver.holdTimer);
  permitResolver = null;
  if (typeof el.permitDialog.close === 'function' && el.permitDialog.open) el.permitDialog.close();
  else el.permitDialog.removeAttribute('open');
}

async function completePermitExecution() {
  if (!permitResolver) return;
  const reason = el.permitReason.value.trim();
  if (reason.length < 3) {
    if (el.permitError) el.permitError.textContent = 'Enter an operational reason (at least 3 characters) before executing.';
    el.permitReason.focus();
    return;
  }
  const ctx = permitResolver;
  closePermitDialog();
  const ok = await ctx.onExecute();
  const entry = {
    device: ctx.device,
    action: ctx.action,
    preflight: ctx.preflightText,
    reason,
    result: ok ? 'accepted' : 'rejected',
    utc: utcStamp(),
    ist: istStamp(),
  };
  state.operatorLog.unshift(entry);
  if (state.operatorLog.length > MAX_OPERATOR_LOG) {
    state.operatorLog.length = MAX_OPERATOR_LOG;
  }
  renderOperatorLog();
  apiJson('POST', '/api/ems/operator-log', entry);
  pinArtifact(`Permit: ${ctx.device}`, `${ctx.action} (${entry.result}): ${reason}`, 'Operator Log', entry.utc);
}

function renderOperatorLog() {
  if (!el.oplogList) return;
  if (!state.operatorLog.length) {
    el.oplogList.innerHTML = '<li class="muted-empty">No switching permits logged yet.</li>';
    return;
  }
  el.oplogList.innerHTML = state.operatorLog
    .map((e) => `<li class="oplog-item"><span><strong>${escHtml(e.device)}</strong> ${escHtml(e.action)} (${escHtml(e.result)}) · ${escHtml(e.reason)}</span><span class="tabular dispatch-time">${escHtml(e.utc)}</span></li>`)
    .join('');
}

function triggerPermitForSelectedBay() {
  if (!state.selectedBayId || !state.liveConnected) return;
  const bayId = state.selectedBayId;
  const bayNum = parseInt(bayId.slice(-1), 10);
  const info = bayDisplayInfo(bayNum);
  const action = info.closed ? 'open' : 'close';
  const pf = state.livePreflight || {};
  const preflightText = action === 'close'
    ? `Pre-flight: peak ${Number(pf.predicted_clpu_peak_mw ?? state.totalMw).toFixed(1)} MW, TR-1 ${Math.round(pf.predicted_tr1_pct ?? state.tr1Pct)}%, TR-2 ${Math.round(pf.predicted_tr2_pct ?? state.tr2Pct)}%`
    : `Pre-flight: opening ${bayId} sheds feeder load.`;

  openPermitDialog({
    device: bayId,
    action,
    preflightText,
    onExecute: async () => {
      const resp = await apiJson('POST', '/api/ems/sbo/execute', { bay_id: bayId, action });
      if (!resp || !resp.ok || resp.data.ok === false) {
        const reason = resp && resp.data ? (resp.data.detail || resp.data.error || resp.data.reason || `HTTP ${resp.status}`) : 'unreachable';
        logStation(`SBO execute rejected on ${bayId}: ${reason}`, 't-err');
        return false;
      }
      state.selectedBayId = null;
      state.livePreflight = null;
      playRelayCue('thunk');
      if (action === 'close') fx.emitCLPU(bayNum - 1);
      logStation(`SBO execute ${bayId} ${action} accepted by station RTU.`, 't-ok');
      await refreshStateOnce();
      return true;
    },
  });
}

function triggerPermitForTieClose() {
  if (!state.liveConnected) return;
  const preflightText = `Phase ${state.syncAngleDeg.toFixed(1)} deg, Freq delta ${state.syncDf.toFixed(2)} Hz, Volt delta ${state.syncDv.toFixed(2)} p.u. (${state.ansi25InWindow ? 'In window' : 'Out of window'})`;
  openPermitDialog({
    device: 'CB-220-TIE1',
    action: 'close',
    preflightText,
    onExecute: async () => {
      const resp = await apiJson('POST', '/api/ems/tie/close', {});
      if (!resp || !resp.ok || resp.data.ok === false) {
        const reason = resp && resp.data ? (resp.data.reason || resp.data.detail || resp.data.error || `HTTP ${resp.status}`) : 'unreachable';
        logStation(`ANSI 25 tie close rejected: ${reason}`, 't-err');
        return false;
      }
      playRelayCue('chime');
      fx.emitWireEcho(560, 122, 'echo', 'substation');
      logStation('CB-220-TIE1 closed via ANSI 25 permissive.', 't-ok');
      await refreshStateOnce();
      return true;
    },
  });
}

async function fetchLiveSoeWindow() {
  const resp = await apiJson('GET', '/api/ems/soe-window?seconds=15');
  if (!resp || !resp.ok || !Array.isArray(resp.data.frames) || !resp.data.frames.length) return;
  const raw = resp.data.frames;
  const stepCount = Math.min(8, raw.length);
  const sampled = [];
  for (let i = 0; i < stepCount; i++) {
    const idx = Math.min(raw.length - 1, Math.round((i / Math.max(1, stepCount - 1)) * (raw.length - 1)));
    const f = raw[idx];
    const breakers = {};
    for (let b = 1; b <= 6; b++) {
      const k = `BAY-0${b}`;
      const bk = f.breakers && f.breakers[k];
      breakers[k] = Boolean(typeof bk === 'object' ? bk.closed : bk);
    }
    const lockoutAssets = Array.isArray(f.lockouts) ? f.lockouts.map((x) => String(x)) : [];
    const lock = lockoutAssets.length > 0 || (!Array.isArray(f.lockouts) && Boolean(f.lockouts));
    const offStr = typeof f.offset_s === 'number' ? `T-${Math.abs(f.offset_s).toFixed(1)} s` : `Step ${i + 1}`;
    const evtText = formatSoeReplayEvents(f.events, f.tr1_pct);
    const frameGenMw = Number(f.gen_mw ?? 0);
    const frameTotalMw = typeof f.total_load_p_mw === 'number' ? Number(f.total_load_p_mw) : frameGenMw;
    sampled.push({
      label: offStr,
      caption: `${offStr}: ${evtText}`,
      busFreqHz: f.bus_33kv_freq_hz !== undefined ? f.bus_33kv_freq_hz : (Number(f.v33_pu ?? 1) > 0.01 ? Number(f.freq_hz ?? 50) : null),
      genFreqHz: f.gen_freq_hz !== undefined ? f.gen_freq_hz : Number(f.freq_hz ?? 50),
      busKv: Number(((f.v33_pu ?? 1) * 33.0).toFixed(1)),
      tr1Pct: Math.round(f.tr1_pct ?? 0),
      tr2Pct: Math.round(f.tr2_pct ?? 0),
      genMw: frameGenMw,
      totalMw: frameTotalMw,
      lockout86: lock,
      lockoutAssets,
      busesLive: Number(f.v33_pu ?? 0) > 0.01,
      breakers,
    });
  }
  state.soeReplay.frames = sampled;
  state.soeReplay.available = true;
  state.soeReplay.active = false;
  state.soeReplay.index = sampled.length - 1;
  el.soeScrubber.max = String(sampled.length - 1);
  el.soeScrubber.value = String(sampled.length - 1);
  el.soeCaption.textContent = sampled[sampled.length - 1].caption;
  syncSceneDOM();
}

function stopSoeReplayTimer() {
  if (state.soeReplay.timerId) { clearInterval(state.soeReplay.timerId); state.soeReplay.timerId = null; }
  state.soeReplay.playing = false;
  el.btnSoePlay.textContent = 'Play replay';
}

function setSoeReplayFrame(idx) {
  if (!state.soeReplay.available || !state.soeReplay.frames.length) return;
  const clamped = Math.max(0, Math.min(state.soeReplay.frames.length - 1, Number(idx)));
  state.soeReplay.index = clamped;
  state.soeReplay.active = true;
  el.soeScrubber.value = String(clamped);
  el.soeCaption.textContent = state.soeReplay.frames[clamped].caption;
  syncSceneDOM();
}

function returnSoeToLive() {
  stopSoeReplayTimer();
  state.soeReplay.active = false;
  syncSceneDOM();
}

function findCorrelation(item) {
  let best = null;
  for (const other of state.pinnedArtifacts) {
    if (other.id === item.id || other.vantage === item.vantage) continue;
    const diff = item.utcSec - other.utcSec;
    if (Math.abs(diff) <= 5 && (!best || Math.abs(diff) < Math.abs(best.diff))) {
      best = { partner: other, diff };
    }
  }
  return best;
}

function renderPinnedArtifacts() {
  if (!state.pinnedArtifacts.length) {
    el.pinnedList.innerHTML = '<li class="muted-empty">No artifacts pinned yet.</li>';
  } else {
    el.pinnedList.innerHTML = state.pinnedArtifacts
      .map((item) => {
        const corr = findCorrelation(item);
        return `
          <li class="pinned-row ${corr ? 'is-correlated' : ''}">
            <div class="pinned-top"><strong>${escHtml(item.source)} (${escHtml(item.vantage)})</strong><span class="dispatch-time tabular">${escHtml(item.utc)}</span></div>
            <span>${escHtml(item.summary)}</span>
            ${corr ? `<span class="corr-note tabular">Within +/-5 s of ${escHtml(corr.partner.vantage)} (${corr.diff >= 0 ? '+' : ''}${corr.diff} s)</span>` : ''}
          </li>`;
      })
      .join('');
  }
  renderTimelineView();
}

function renderTimelineView() {
  renderIncidentTimeline(
    document.getElementById('timeline-axis'),
    document.getElementById('timeline-list'),
    state.pinnedArtifacts,
    findCorrelation,
    (item) => {
      document.getElementById('timeline-scrub-label').textContent = `${item.utc} · ${item.source}`;
    }
  );
}

function normalizePin(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = String(raw.source || raw.label || 'Station');
  const summary = String(raw.summary || raw.value || '');
  const vantage = String(raw.vantage || 'Station');
  const utc = String(raw.utc || raw.ts_utc || utcStamp());
  const ist = raw.ist ? String(raw.ist) : '';
  const utcSec = typeof raw.utcSec === 'number' && Number.isFinite(raw.utcSec)
    ? raw.utcSec
    : parseUtcSeconds(utc);
  let id = raw.id ? String(raw.id) : '';
  const m = id.match(/^pin-(\d+)$/);
  if (m) {
    state.pinSeq = Math.max(state.pinSeq, Number(m[1]));
  } else if (!id) {
    state.pinSeq += 1;
    id = `pin-${state.pinSeq}`;
  }
  return { id, source, vantage, utc, ist, utcSec, summary };
}

function persistLocalNotesAndPins() {
  try { localStorage.setItem(STORAGE_NOTES, el.notesArea.value); } catch {}
  try { localStorage.setItem(STORAGE_PINS, JSON.stringify(state.pinnedArtifacts)); } catch {}
}

async function hydrateNotesFromServer() {
  const r = await apiJson('GET', '/api/ems/notes');
  if (disposed || !r || !r.ok || !r.data) return false;
  const serverTxt = typeof r.data.text === 'string' ? r.data.text : typeof r.data.notes === 'string' ? r.data.notes : '';
  const rawPins = Array.isArray(r.data.pins) ? r.data.pins : Array.isArray(r.data.pinned) ? r.data.pinned : [];
  const normalizedServerPins = rawPins.map(normalizePin).filter(Boolean);

  if (state.notesDirtyOffline) {
    // Preserve offline edits safely while merging any server notes/pins not yet in local buffer.
    const localTxt = el.notesArea.value;
    if (serverTxt && !localTxt) {
      el.notesArea.value = serverTxt;
    } else if (serverTxt && localTxt && !localTxt.includes(serverTxt)) {
      el.notesArea.value = `${serverTxt}\n\n${localTxt}`;
    }
    const existingKeys = new Set(state.pinnedArtifacts.map((p) => `${p.utc}|${p.source}|${p.summary}`));
    for (const sp of normalizedServerPins) {
      const k = `${sp.utc}|${sp.source}|${sp.summary}`;
      if (!existingKeys.has(k)) {
        state.pinnedArtifacts.push(sp);
        existingKeys.add(k);
      }
    }
    state.notesHydrated = true;
    persistLocalNotesAndPins();
    renderPinnedArtifacts();
    saveLiveNotes(true);
  } else {
    state.notesHydrated = true;
    el.notesArea.value = serverTxt;
    state.pinnedArtifacts = normalizedServerPins;
    persistLocalNotesAndPins();
    renderPinnedArtifacts();
  }
  return true;
}

let notesSaveTimer = null;
function saveLiveNotes(immediate = false) {
  state.notesDirtyOffline = true;
  persistLocalNotesAndPins();
  if (!state.liveConnected || !state.notesHydrated) return;
  if (notesSaveTimer) {
    clearTimeout(notesSaveTimer);
    notesSaveTimer = null;
  }
  const flush = async () => {
    notesSaveTimer = null;
    if (disposed || !state.liveConnected || !state.notesHydrated) return;
    const textSnap = el.notesArea.value;
    const pinsSnap = [...state.pinnedArtifacts];
    const resp = await apiJson('PUT', '/api/ems/notes', { text: textSnap, pins: pinsSnap });
    if (!disposed && resp && resp.ok && el.notesArea.value === textSnap && state.pinnedArtifacts.length === pinsSnap.length) {
      state.notesDirtyOffline = false;
    }
  };
  if (immediate) void flush();
  else notesSaveTimer = setTimeout(() => void flush(), 500);
}

function pinArtifact(source, summary, vantage = 'Station', explicitUtc = null) {
  const utc = explicitUtc || utcStamp();
  const ist = istStamp();
  state.pinSeq += 1;
  state.pinnedArtifacts.unshift({
    id: `pin-${state.pinSeq}`,
    source,
    vantage,
    utc,
    ist,
    utcSec: parseUtcSeconds(utc),
    summary,
  });
  if (state.pinnedArtifacts.length > 100) {
    state.pinnedArtifacts.length = 100;
  }
  renderPinnedArtifacts();
  saveLiveNotes(true);
  logStation(`Pinned evidence from ${source} (${utc}).`, 't-ok');
}

function copySanitizedTimeline() {
  const sorted = [...state.pinnedArtifacts].sort((a, b) => a.utcSec - b.utcSec);
  const lines = ['CISF OT Incident Handover Timeline (Sanitized UTC / IST)'];
  sorted.forEach((item) => {
    lines.push(`- ${item.utc} (${item.ist || ''}) | ${item.vantage} | ${item.source}: ${item.summary}`);
  });
  const text = lines.join('\n');
  navigator.clipboard?.writeText(text).catch(() => {});
  logStation(`Copied sanitized timeline (${sorted.length} pinned entries).`, 't-ok');
}

function renderDispatch() {
  el.dispatchList.replaceChildren();
  if (!state.dispatch.length) {
    const empty = document.createElement('div');
    empty.className = 'muted-empty';
    empty.textContent = 'No dispatch entries loaded yet.';
    el.dispatchList.appendChild(empty);
  }
  state.dispatch.forEach((d) => {
    if (d && d._storyOpenerId) {
      const openerEl = story.buildOpenerCardElement(d, (entry) => pinArtifact(entry.sender, entry.body, 'Field dispatch', entry.utc));
      el.dispatchList.appendChild(openerEl);
      return;
    }
    const sender = d.sender || d.from || 'Station Dispatch';
    const body = d.body || d.message || '';
    const utc = d.utc || utcStamp();
    const ist = d.ist || '';
    const card = document.createElement('article');
    card.className = 'dispatch-entry';
    card.innerHTML = `
      <div class="dispatch-meta">
        <strong>${escHtml(sender)}</strong>
        <div class="dispatch-time-group">
          <time class="dispatch-time tabular">${escHtml(utc)}${ist ? ` (${escHtml(ist)})` : ''}</time>
          <button type="button" class="btn-mini">Pin</button>
        </div>
      </div>
      <p>${escHtml(body)}</p>`;
    card.querySelector('button').addEventListener('click', () => pinArtifact(sender, body, 'Field dispatch', utc));
    el.dispatchList.appendChild(card);
  });
  el.dispatchCount.textContent = String(state.dispatch.length);
  if (el.navEvidenceCount) {
    el.navEvidenceCount.textContent = String(state.dispatch.length);
  }
  story.updateStakesStrip({
    districts: state.districts,
    dispatchEntries: state.dispatch,
    liveConnected: state.liveConnected,
  });
}

function getModuleArtifacts(m = getMod()) {
  if (Array.isArray(m.artifacts) && m.artifacts.length) return m.artifacts;
  return [m.artifact.split('/').pop()];
}

function getActiveEditorFilename(m = getMod()) {
  const list = getModuleArtifacts(m);
  if (state.editorFile && list.includes(state.editorFile)) {
    return state.editorFile;
  }
  return list[0];
}

function stashCurrentEditorDraft() {
  const curFile = state.editorLoadedFile || state.editorFile;
  if (!curFile || !state.editorDirty) return;
  const draft = { text: el.editorText.value, mtime: state.editorLoadedMtime, dirty: true };
  state.editorDrafts[curFile] = draft;
  try {
    sessionStorage.setItem(`${userPrefix}draft_${curFile}`, JSON.stringify(draft));
  } catch {}
}

function readStoredEditorDraft(fname) {
  if (state.editorDrafts[fname]?.dirty) return state.editorDrafts[fname];
  try {
    const raw = sessionStorage.getItem(`${userPrefix}draft_${fname}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.dirty && typeof parsed.text === 'string') {
      state.editorDrafts[fname] = parsed;
      return parsed;
    }
  } catch {}
  return null;
}

function clearEditorDraft(fname) {
  delete state.editorDrafts[fname];
  try {
    sessionStorage.removeItem(`${userPrefix}draft_${fname}`);
  } catch {}
}

function hideEditorConflict() {
  el.editorConflictBar?.classList.add('is-hidden');
}

function syncEditorFileSelector(m = getMod()) {
  const list = getModuleArtifacts(m);
  if (!list.includes(state.editorFile)) {
    stashCurrentEditorDraft();
    state.editorFile = list[0];
  }
  if (!el.editorFileSelect) return;
  const multi = list.length > 1;
  el.editorFileSelect.classList.toggle('is-hidden', !multi);
  const prevVals = Array.from(el.editorFileSelect.options).map((o) => o.value).join('|');
  const nextVals = list.join('|');
  if (prevVals !== nextVals) {
    el.editorFileSelect.replaceChildren();
    list.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      el.editorFileSelect.appendChild(opt);
    });
  }
  el.editorFileSelect.value = state.editorFile;
}

function updateEditorHeaderLabels(fname) {
  el.editorToggleLabel.textContent = `Edit ${fname}`;
  el.btnToggleEditor.title = `Edit ~/workspace/${fname}`;
  el.editorPath.textContent = `~/workspace/${fname}`;
}

function updateEditorGutter() {
  const lines = el.editorText.value.split('\n').length;
  let buf = '';
  for (let i = 1; i <= Math.max(12, lines); i++) buf += `${i}\n`;
  el.editorGutter.textContent = buf.trimEnd();
}

async function loadEditorFile(fnameOrModId, forceDisk = false) {
  const fname = String(fnameOrModId || '').includes('.')
    ? String(fnameOrModId)
    : getActiveEditorFilename(getMod(fnameOrModId));
  state.editorFile = fname;
  updateEditorHeaderLabels(fname);
  hideEditorConflict();

  if (!forceDisk) {
    const draft = readStoredEditorDraft(fname);
    if (draft && draft.dirty) {
      el.editorText.value = draft.text;
      state.editorLoadedFile = fname;
      state.editorLoadedMtime = draft.mtime ?? null;
      state.editorDirty = true;
      el.editorStatus.textContent = 'Unsaved draft';
      el.btnEditorReload?.classList.remove('is-hidden');
      updateEditorGutter();
      return;
    }
  }

  if (!state.liveConnected) {
    el.editorStatus.textContent = 'Not connected';
    el.btnEditorReload?.classList.remove('is-hidden');
    return;
  }

  const seq = ++state.editorLoadSeq;
  try {
    const r = await transport.readFile(fname);
    if (disposed || seq !== state.editorLoadSeq) return;
    if (r && r.ok) {
      const clean = String(r.text || '').replace(/\r\n/g, '\n');
      el.editorText.value = clean;
      state.editorLoadedFile = fname;
      state.editorLoadedMtime = typeof r.mtime === 'number' ? r.mtime : null;
      state.editorDirty = false;
      clearEditorDraft(fname);
      el.editorStatus.textContent = 'Synced';
      el.btnEditorReload?.classList.add('is-hidden');
      updateEditorGutter();
      return;
    }
    if (r && r.status === 404) {
      el.editorText.value = '';
      state.editorLoadedFile = fname;
      state.editorLoadedMtime = null;
      state.editorDirty = false;
      clearEditorDraft(fname);
      el.editorStatus.textContent = 'Empty / new';
      el.btnEditorReload?.classList.add('is-hidden');
      updateEditorGutter();
      return;
    }
    if (r && r.status === 415) {
      el.editorStatus.textContent = 'Binary or non-UTF8 file (edit in terminal)';
      el.btnEditorReload?.classList.remove('is-hidden');
      return;
    }
    // Preserve existing textarea buffer on 500/502/offline errors!
    el.editorStatus.textContent = `Load error (${r && r.status ? `HTTP ${r.status}` : 'offline'})`;
    el.btnEditorReload?.classList.remove('is-hidden');
  } catch {
    if (disposed || seq !== state.editorLoadSeq) return;
    el.editorStatus.textContent = 'Load failed (buffer kept)';
    el.btnEditorReload?.classList.remove('is-hidden');
  }
}

async function saveEditorFile(forceOverwrite = false) {
  if (!state.liveConnected) {
    el.editorStatus.textContent = 'Not connected';
    return;
  }
  const normalized = el.editorText.value.replace(/\r\n/g, '\n');
  el.editorText.value = normalized;
  const fname = getActiveEditorFilename();
  const expectedMtime = forceOverwrite ? null : state.editorLoadedMtime;
  try {
    const r = await transport.writeFile(fname, normalized, expectedMtime);
    if (disposed) return;
    if (r && r.ok) {
      state.editorDirty = false;
      state.editorLoadedFile = fname;
      if (typeof r.mtime === 'number') state.editorLoadedMtime = r.mtime;
      clearEditorDraft(fname);
      hideEditorConflict();
      el.btnEditorReload?.classList.add('is-hidden');
      el.editorStatus.textContent = 'Saved (LF)';
      logStation(`Saved ~/workspace/${fname}.`, 't-ok');
    } else if (r && r.status === 409 && r.error === 'file_modified_externally') {
      el.editorStatus.textContent = 'Conflict (modified in terminal)';
      if (el.editorConflictMsg) {
        el.editorConflictMsg.textContent = `~/workspace/${fname} changed in the terminal since you loaded it. Reload from disk or overwrite with your editor buffer.`;
      }
      el.editorConflictBar?.classList.remove('is-hidden');
      logStation(`Save conflict on ~/workspace/${fname}: modified externally in terminal.`, 't-warn');
    } else {
      el.editorStatus.textContent = `Error ${r && r.status ? r.status : 'offline'}`;
    }
  } catch {
    setConnectedState(false);
    el.editorStatus.textContent = 'Not connected';
  }
}

function setModule(modId, silent = false) {
  const changed = state.module !== modId;
  state.module = modId;
  state.selectedBayId = null;
  state.livePreflight = null;
  stopSoeReplayTimer();
  state.soeReplay.active = false;
  if (modId !== 'm4') state.splitLensOn = false;
  if (changed) {
    state.moduleEnteredAt = Date.now();
    fx.clearTransients();
  }
  const preset = CAMERA_PRESETS[modId] || CAMERA_PRESETS.m1;
  setSceneView(preset.defaultView || 'city');
  renderHeaderProgress();
  renderModuleRail();
  renderBriefAndChecks();
  syncSceneDOM();
  const cId = contractModId(modId);
  const opener = story.ensureOpenerInDispatch(cId, state.dispatch);
  if (opener) {
    state.dispatch.unshift(opener);
    renderDispatch();
  }
  if (!silent && changed) {
    const m = getMod(modId);
    logStation(`Switched view to ${m.isFullOp ? 'Full operation mode' : `Module ${m.num}: ${m.title}`}.`, 't-dim');
    story.maybeShowActCard(cId);
    tour.notifyEvent(`module-${cId}`);
  }
}

async function switchModuleFromRail(modId) {
  setModule(modId);
  if (tabChannel) {
    try { tabChannel.postMessage({ type: 'module', modId }); } catch {}
  }
  if (!state.liveConnected) return;
  const cId = contractModId(modId);
  state.lastServerModuleId = cId;
  const resp = await apiJson('POST', '/api/ems/reset-module', { module_id: cId });
  if (resp && resp.ok) {
    logStation(`Station switched active module to ${cId}.`, 't-ok');
    await Promise.all([refreshStateOnce(), refreshDispatch(), refreshAlarms(), refreshFrames()]);
  } else if (resp) {
    logStation(`Module switch to ${cId} rejected (HTTP ${resp.status}).`, 't-warn');
  }
}

async function renderLiveCheckOutcome(m, isSubmit, checkId, body) {
  const areas = Array.isArray(body.area_feedback) ? body.area_feedback : [];
  const passedAreas = areas.filter((a) => a.passed >= a.total).length;
  const totalAreas = areas.length || m.rubric.length;
  const passed = body.status === 'passed' || body.passed === true;
  const score = typeof body.score === 'number' ? body.score : 0;
  const maxScore = typeof body.max_score === 'number' ? body.max_score : m.pts;
  const label = isSubmit ? 'Submission' : 'Practice check';
  if (typeof body.post_trip_resets === 'number') state.postTripResets = body.post_trip_resets;
  if (typeof body.reset_penalty_pct === 'number') state.resetPenaltyPct = body.reset_penalty_pct;
  if (typeof body.next_reset_penalty_pct === 'number') state.nextResetPenaltyPct = body.next_reset_penalty_pct;
  if (typeof body.max_reset_penalty_pct === 'number') state.maxResetPenaltyPct = body.max_reset_penalty_pct;
  if (typeof body.trip_events === 'number') state.tripEvents = body.trip_events;
  else if (typeof body.post_trip_resets === 'number') state.tripEvents = body.post_trip_resets;
  if (typeof body.trip_penalty_pct === 'number') state.tripPenaltyPct = body.trip_penalty_pct;
  else if (typeof body.reset_penalty_pct === 'number') state.tripPenaltyPct = body.reset_penalty_pct;
  if (typeof body.max_trip_penalty_pct === 'number') state.maxTripPenaltyPct = body.max_trip_penalty_pct;
  const entry = {
    id: checkId,
    time: utcStamp(),
    passed,
    isSubmit,
    passedCount: passedAreas,
    totalCount: totalAreas,
    score,
    title: passed ? `${label} passed (${isSubmit ? `${score}/${maxScore} pts` : `${passedAreas}/${totalAreas} areas`})` : `Criteria pending (${passedAreas} of ${totalAreas} areas)`,
    summary: body.message || `${label} status: ${body.status || (passed ? 'passed' : 'failed')}.`,
    areas,
  };
  if (!state.attemptsByModule[m.id]) state.attemptsByModule[m.id] = [];
  state.attemptsByModule[m.id].unshift(entry);
  if (state.attemptsByModule[m.id].length > MAX_ATTEMPTS_PER_MODULE) {
    state.attemptsByModule[m.id].length = MAX_ATTEMPTS_PER_MODULE;
  }
  state.attemptedModules.add(m.id);
  if (isSubmit && passed) {
    await story.refreshCaseBoard(m.contractId);
    tour.notifyEvent('first-pass');
  }
  if (disposed) return;
  renderHeaderProgress();
  renderModuleRail();
  // Bind visible Checks tab rendering strictly to the check's module (E-03).
  if (state.module === m.id) {
    renderChecksTab(entry);
    renderHistoryTab();
    setTab('checks');
  }
  logStation(`${checkId} (M${m.num}): ${entry.title}`, passed ? 't-ok' : 't-warn');
}

let activeCheckPollId = 0;

function clearActiveCheckPoll() {
  if (checkPollTimer) {
    clearTimeout(checkPollTimer);
    checkPollTimer = null;
  }
  resumePendingCheckPoll = null;
}

async function runLiveEvaluation(isSubmit) {
  if (!state.liveConnected) {
    logStation('Cannot submit while disconnected from station backend.', 't-err');
    return;
  }
  if (state.verifyInFlight) return;
  const m = getMod();
  const cId = contractModId(m.id);
  const endpoint = isSubmit ? '/api/ems/verify' : '/api/ems/practice';
  state.verifyInFlight = true;
  syncEvalButtons();

  const resp = await apiJson('POST', endpoint, { module_id: cId });
  if (disposed) return;
  if (!resp) {
    state.verifyInFlight = false;
    syncEvalButtons();
    logStation('Check failed: backend not reachable.', 't-err');
    return;
  }
  if (resp.status === 429) {
    state.verifyInFlight = false;
    syncEvalButtons();
    const retry = resp.data?.retry_after_s || 15;
    const msg = String(resp.data?.detail || resp.data?.error || '');
    const alreadyRunning = /already running/i.test(msg);
    el.resultBanner.classList.remove('is-hidden', 'is-pass');
    el.bannerTitle.textContent = alreadyRunning
      ? `Verification already in progress (${retry} s)`
      : `Cooldown active (${retry} s remaining)`;
    el.bannerDetail.textContent = msg || 'Wait for module cooldown before retrying.';
    el.btnNextMod.classList.add('is-hidden');
    setTab('checks');
    return;
  }
  if (resp.status === 409) {
    state.verifyInFlight = false;
    syncEvalButtons();
    el.resultBanner.classList.remove('is-hidden', 'is-pass');
    el.bannerTitle.textContent = 'Check already in progress';
    el.bannerDetail.textContent = resp.data?.detail || resp.data?.error || 'Wait for active verification to finish.';
    el.btnNextMod.classList.add('is-hidden');
    setTab('checks');
    return;
  }
  const checkId = resp.data?.check_id;
  if (!checkId && resp.ok && resp.data && (resp.data.practice === true || resp.data.status === 'passed' || resp.data.status === 'failed')) {
    state.verifyInFlight = false;
    syncEvalButtons();
    void renderLiveCheckOutcome(m, isSubmit, `PRAC-${Date.now().toString().slice(-4)}`, resp.data);
    return;
  }
  if (!checkId) {
    state.verifyInFlight = false;
    syncEvalButtons();
    el.resultBanner.classList.remove('is-hidden', 'is-pass');
    el.bannerTitle.textContent = `Check error (HTTP ${resp.status})`;
    el.bannerDetail.textContent = resp.data?.detail || resp.data?.error || `Request to ${endpoint} failed.`;
    el.btnNextMod.classList.add('is-hidden');
    setTab('checks');
    logStation(`Check error from ${endpoint} (HTTP ${resp.status}).`, 't-err');
    return;
  }

  clearActiveCheckPoll();
  const pollSeq = ++activeCheckPollId;
  const parsedDeadline = resp.data?.deadline_at ? Date.parse(resp.data.deadline_at) : NaN;
  const pollDeadlineMs = Number.isFinite(parsedDeadline)
    ? Math.max(Date.now() + 60_000, parsedDeadline + 30_000)
    : Date.now() + 120_000;
  let transientBackoffMs = 1500;

  if (state.module === m.id) {
    el.resultBanner.classList.remove('is-hidden', 'is-pass');
    el.bannerTitle.textContent = `Running ${isSubmit ? 'verification' : 'practice check'} (${checkId})`;
    el.bannerDetail.textContent = 'Evaluating workspace artifact and live station telemetry...';
    el.btnNextMod.classList.add('is-hidden');
    setTab('checks');
  }

  const scheduleNext = (delayMs) => {
    if (checkPollTimer) clearTimeout(checkPollTimer);
    checkPollTimer = setTimeout(() => {
      checkPollTimer = null;
      void poll();
    }, delayMs);
  };

  const poll = async () => {
    if (disposed || pollSeq !== activeCheckPollId) return;
    const r = await apiJson('GET', `/api/ems/checks/${encodeURIComponent(checkId)}`);
    if (disposed || pollSeq !== activeCheckPollId) return;

    const isTransient = !r || r.status === 0 || r.status >= 500;
    if (isTransient) {
      if (Date.now() < pollDeadlineMs) {
        if (state.module === m.id) {
          el.resultBanner.classList.remove('is-hidden', 'is-pass');
          el.bannerTitle.textContent = 'Reconnecting to check status...';
          el.bannerDetail.textContent = `Waiting for check ${checkId} after temporary network interruption. Retrying automatically...`;
        }
        const waitMs = transientBackoffMs;
        transientBackoffMs = Math.min(8000, Math.round(transientBackoffMs * 1.5));
        scheduleNext(waitMs);
        return;
      }
      clearActiveCheckPoll();
      state.verifyInFlight = false;
      syncEvalButtons();
      if (state.module === m.id) {
        el.bannerTitle.textContent = 'Verification status timed out while disconnected';
        el.bannerDetail.textContent = 'Reconnect and check Case Board or resubmit once back online.';
      }
      return;
    }

    if (!r.ok) {
      clearActiveCheckPoll();
      state.verifyInFlight = false;
      syncEvalButtons();
      if (state.module === m.id) {
        el.bannerTitle.textContent = 'Verification status unavailable';
        el.bannerDetail.textContent = r.data?.detail || r.data?.error || `HTTP ${r.status}`;
      }
      return;
    }

    transientBackoffMs = 1500;
    if (r.data.status === 'running') {
      if (Date.now() >= pollDeadlineMs) {
        clearActiveCheckPoll();
        state.verifyInFlight = false;
        syncEvalButtons();
        if (state.module === m.id) {
          el.bannerTitle.textContent = 'Verification timed out';
          el.bannerDetail.textContent = `Check ${checkId} exceeded client polling deadline.`;
        }
        return;
      }
      scheduleNext(1000);
      return;
    }

    clearActiveCheckPoll();
    state.verifyInFlight = false;
    syncEvalButtons();
    void renderLiveCheckOutcome(m, isSubmit, checkId, r.data);
  };

  resumePendingCheckPoll = () => {
    if (disposed || pollSeq !== activeCheckPollId) return;
    transientBackoffMs = 1500;
    scheduleNext(200);
  };
  scheduleNext(800);
}

function setAlarmCountUI(activeCount) {
  const n = Math.max(0, Number(activeCount) || 0);
  el.hdrAlarmCount.textContent = String(n);
  el.tabAlarmCount.textContent = String(n);
  el.hdrAlarmsBtn.classList.toggle('has-alarms', n > 0);
  el.hdrAlarmsBtn.classList.toggle('is-zero', n === 0);
  if (el.navStationAlarmDot) {
    el.navStationAlarmDot.textContent = String(n);
    el.navStationAlarmDot.classList.toggle('is-hidden', n === 0);
  }
}

function updateAlarmBadges() {
  const activeCount = state.alarms.filter((a) => a.state === 'active').length;
  setAlarmCountUI(activeCount);
}

async function refreshAlarms() {
  const resp = await apiJson('GET', '/api/ems/alarms');
  if (!resp || !resp.ok) return;
  state.alarms = Array.isArray(resp.data.alarms) ? resp.data.alarms : [];
  updateAlarmBadges();
  renderAlarmsTable(
    document.getElementById('alarms-tbody'),
    document.getElementById('alarms-empty-msg'),
    state.alarms,
    {
      onAck: async (a) => {
        const r = await apiJson('POST', '/api/ems/alarms/ack', { alarm_id: a.id });
        if (r && r.ok) { logStation(`Acknowledged alarm ${a.point} (${a.id}).`, 't-ok'); refreshAlarms(); }
      },
      onShelve: async (a) => {
        const r = await apiJson('POST', '/api/ems/alarms/shelve', { alarm_id: a.id, reason: 'Operator shelved' });
        if (r && r.ok) { logStation(`Shelved alarm ${a.point} (${a.id}).`, 't-warn'); refreshAlarms(); }
      },
      onPin: (a) => pinArtifact(`Alarm ${a.point}`, `P${a.priority} ${a.state}: ${a.value} (${a.description || ''})`, 'Alarms', a.utc),
    }
  );
}

async function refreshSoe() {
  const resp = await apiJson('GET', '/api/ems/soe?limit=150');
  if (!resp || !resp.ok) return;
  state.soeEvents = Array.isArray(resp.data) ? resp.data : (Array.isArray(resp.data?.events) ? resp.data.events : []);
  renderSoeTable(
    document.getElementById('soe-tbody'),
    document.getElementById('soe-empty-msg'),
    state.soeEvents,
    async () => {
      await fetchLiveSoeWindow();
      setTab('console');
    }
  );
}

async function refreshFrames() {
  const dsSel = document.getElementById('frames-dataset-select');
  const prevValue = dsSel ? dsSel.value : '';
  const ds = prevValue ? `?dataset=${encodeURIComponent(prevValue)}` : '';
  const resp = await apiJson('GET', `/api/ems/frames${ds}`);
  if (disposed || !resp || !resp.ok) return;
  state.frames = Array.isArray(resp.data.frames) ? resp.data.frames : [];
  if (Array.isArray(resp.data.datasets) && dsSel) {
    const incoming = resp.data.datasets.map((d) => String(d));
    const current = Array.from(dsSel.options).map((o) => o.value);
    const changed = incoming.length !== current.length || incoming.some((v, idx) => v !== current[idx]);
    if (changed) {
      dsSel.replaceChildren();
      incoming.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        dsSel.appendChild(opt);
      });
      if (prevValue && incoming.includes(prevValue)) {
        dsSel.value = prevValue;
      }
    }
  }
  drawFramesPanel();
}

function drawFramesPanel() {
  renderFrameAnatomy(
    document.getElementById('frames-list'),
    document.getElementById('frames-detail'),
    state.frames,
    document.getElementById('frames-filter-input')?.value || '',
    state.selectedFrameId,
    {
      onSelect: (id) => { state.selectedFrameId = id; drawFramesPanel(); },
      onCopyFilter: (flt) => {
        navigator.clipboard?.writeText(flt).catch(() => {});
        logStation(`Copied tshark filter: ${flt}`, 't-ok');
      },
      onPinFrame: (fr, typeName) => {
        const ioaStr = (fr.ioas || []).map((o) => o.ioa).join(',');
        pinArtifact(
          `IEC-104 ${typeName}`,
          `${fr.src_ip} -> ${fr.dst_ip} CA=${fr.asdu?.ca ?? '-'} OA=${fr.asdu?.oa ?? '-'} COT=${fr.asdu?.cot ?? '-'} IOA=[${ioaStr}]`,
          'Field tap frame',
          fr.utc
        );
      },
    }
  );
}

async function refreshDispatch() {
  const resp = await apiJson('GET', '/api/ems/dispatch');
  if (resp && resp.ok && Array.isArray(resp.data.entries)) {
    const existingOpeners = state.dispatch.filter((d) => d && d._storyOpenerId);
    state.dispatch = [...existingOpeners, ...resp.data.entries];
    const op = story.ensureOpenerInDispatch(contractModId(state.module), state.dispatch);
    if (op) state.dispatch.unshift(op);
    renderDispatch();
  }
}

async function refreshStateOnce() {
  const resp = await apiJson('GET', '/api/ems/state');
  if (resp && resp.ok && resp.data) {
    setConnectedState(true);
    applyLiveDelta(resp.data);
  }
}

function applyLiveDelta(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'heartbeat' || msg.type === 'pong') return;
  if (msg.type === 'file_changed') {
    const curFile = getActiveEditorFilename();
    if (state.rightTab === 'editor' && msg.filename === curFile && !state.editorDirty) {
      void loadEditorFile(curFile, true);
    }
    return;
  }
  if (msg.type === 'wire_echo') {
    const zoneCoords = { L1_FIELD: [258, 464], L3_CTRL: [862, 464], L35_DMZ: [862, 148], L4_CORP: [258, 148] };
    const pt = zoneCoords[msg.zone] || [258, 464];
    fx.emitWireEcho(pt[0], pt[1], 'echo', 'network');
    return;
  }

  const prevLockout = state.lockout86;
  const s = msg.state || msg;

  if (typeof s.module_id === 'string') {
    const mapped = localModId(s.module_id);
    const externalSwitch = !state.liveInitialSynced
      || msg.type === 'module_changed'
      || (state.lastServerModuleId !== null && s.module_id !== state.lastServerModuleId);
    state.liveInitialSynced = true;
    state.lastServerModuleId = s.module_id;
    if (externalSwitch && mapped !== state.module && MODULES.some((x) => x.id === mapped)) {
      setModule(mapped, true);
    }
  }
  if (typeof s.truth_visible === 'boolean') state.truthVisible = s.truth_visible;
  if (typeof s.shim_active === 'boolean') state.shimActive = s.shim_active;
  if (typeof s.bus_33kv_c1_kv === 'number') state.busKv = Number(s.bus_33kv_c1_kv.toFixed(1));
  else if (typeof s.bus_v_pu === 'number') state.busKv = Number((s.bus_v_pu * 33.0).toFixed(1));

  if (s.bus_33kv_freq_hz === null) state.busFreqHz = null;
  else if (typeof s.bus_33kv_freq_hz === 'number') state.busFreqHz = s.bus_33kv_freq_hz;
  else if (typeof s.freq_hz === 'number') state.busFreqHz = state.busKv > 0.1 ? s.freq_hz : null;

  if (s.gen_freq_hz === null) state.genFreqHz = null;
  else if (typeof s.gen_freq_hz === 'number') state.genFreqHz = s.gen_freq_hz;
  else if (typeof s.freq_hz === 'number') state.genFreqHz = s.freq_hz;

  if (typeof s.gen_mw === 'number') state.genMw = Number(s.gen_mw.toFixed(1));
  if (typeof s.grid_tie_mw === 'number') state.gridTieMw = Number(s.grid_tie_mw.toFixed(1));
  if (typeof s.total_load_p_mw === 'number') state.totalMw = Number(s.total_load_p_mw.toFixed(1));
  else if (typeof s.gen_mw === 'number') state.totalMw = Number(s.gen_mw.toFixed(1));
  if (typeof s.tr1_mva_pct === 'number') state.tr1Pct = Math.round(s.tr1_mva_pct);
  if (typeof s.tr2_mva_pct === 'number') state.tr2Pct = Math.round(s.tr2_mva_pct);
  if (typeof s.tie_closed === 'boolean') state.tieClosed = s.tie_closed;
  if (typeof s.tr2_closed === 'boolean') state.tr2Online = s.tr2_closed;
  if (typeof s.sync_delta_deg === 'number') state.syncAngleDeg = s.sync_delta_deg;
  if (typeof s.sync_delta_hz === 'number') state.syncDf = s.sync_delta_hz;
  if (typeof s.sync_delta_v_pu === 'number') state.syncDv = s.sync_delta_v_pu;
  if (typeof s.ansi25_in_window === 'boolean') state.ansi25InWindow = s.ansi25_in_window;
  if (Array.isArray(s.lockouts)) {
    state.activeLockouts = s.lockouts.map((a) => String(a));
    state.lockout86 = state.activeLockouts.length > 0;
  }
  if (s.districts && typeof s.districts === 'object') state.districts = { ...(state.districts || {}), ...s.districts };
  if (s.poller && typeof s.poller === 'object') {
    if (typeof s.poller.poll_continuity_pct === 'number') state.pollPct = s.poller.poll_continuity_pct;
    state.rtu1Connected = Boolean(s.poller.rtu1_connected);
    state.rtu2Connected = Boolean(s.poller.rtu2_connected);
  }
  if (s.bays && typeof s.bays === 'object') {
    for (let i = 1; i <= 6; i++) {
      const k = `BAY-0${i}`;
      if (s.bays[k]) state.bays[k] = { ...(state.bays[k] || {}), ...s.bays[k] };
    }
  }
  if (s.breakers && typeof s.breakers === 'object') {
    for (let i = 1; i <= 6; i++) {
      const k = `BAY-0${i}`;
      if (typeof s.breakers[k] === 'boolean') {
        state.bays[k] = { ...(state.bays[k] || {}), closed: s.breakers[k] };
      }
    }
  }
  if (typeof s.alarms_active_count === 'number') {
    setAlarmCountUI(s.alarms_active_count);
  }
  if (typeof s.post_trip_resets === 'number') state.postTripResets = s.post_trip_resets;
  if (typeof s.reset_penalty_pct === 'number') state.resetPenaltyPct = s.reset_penalty_pct;
  if (typeof s.next_reset_penalty_pct === 'number') state.nextResetPenaltyPct = s.next_reset_penalty_pct;
  if (typeof s.max_reset_penalty_pct === 'number') state.maxResetPenaltyPct = s.max_reset_penalty_pct;
  if (typeof s.trip_events === 'number') state.tripEvents = s.trip_events;
  else if (typeof s.post_trip_resets === 'number') state.tripEvents = s.post_trip_resets;
  if (typeof s.trip_penalty_pct === 'number') state.tripPenaltyPct = s.trip_penalty_pct;
  else if (typeof s.reset_penalty_pct === 'number') state.tripPenaltyPct = s.reset_penalty_pct;
  if (typeof s.max_trip_penalty_pct === 'number') state.maxTripPenaltyPct = s.max_trip_penalty_pct;
  if (Array.isArray(s.passed_modules)) {
    syncPassedModulesFromSigned(s.passed_modules, false);
  }

  trends.pushSample({
    utc: utcStamp(),
    busHz: state.busFreqHz,
    genHz: state.genFreqHz,
    busKv: state.busKv,
    tr1Pct: state.tr1Pct,
    tr2Pct: state.tr2Pct,
    mw: state.totalMw,
    genMw: state.genMw,
    tieMw: state.gridTieMw,
    tieClosed: state.tieClosed,
  });

  if (!prevLockout && state.lockout86) {
    playRelayCue('trip');
    fx.emitTripSpark(506, 224);
    fetchLiveSoeWindow();
    refreshAlarms();
    tour.notifyEvent('m9-trip');
  }
  syncSceneDOM();
}

async function refreshOperatorLog() {
  const r = await apiJson('GET', '/api/ems/operator-log');
  if (disposed || !r || !r.ok || !Array.isArray(r.data.entries)) return;
  state.operatorLog = r.data.entries.slice(0, MAX_OPERATOR_LOG);
  renderOperatorLog();
}

function closeStationStream(isUnload = false) {
  if (state.wsConnectTimer) { clearTimeout(state.wsConnectTimer); state.wsConnectTimer = null; }
  if (state.wsRetryTimer) { clearTimeout(state.wsRetryTimer); state.wsRetryTimer = null; }
  const sock = state.stateWs;
  state.stateWs = null;
  if (!sock) return;
  sock.onopen = null;
  sock.onmessage = null;
  sock.onerror = null;
  sock.onclose = null;
  if (sock.readyState === WebSocket.OPEN) {
    try { sock.close(1000, isUnload ? 'page unload' : 'closing'); } catch {}
  } else if (sock.readyState === WebSocket.CONNECTING) {
    if (isUnload) {
      try { sock.close(1000, 'page unload'); } catch {}
    } else {
      sock.onopen = () => {
        try { sock.close(1000, 'closing'); } catch {}
      };
    }
  }
}

function connectStationStream() {
  if (disposed) return;
  const seq = ++state.wsConnectSeq;
  closeStationStream(false);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setConnectedState(false);
    return;
  }
  state.wsConnectTimer = setTimeout(async () => {
    state.wsConnectTimer = null;
    if (disposed || seq !== state.wsConnectSeq) return;
    let ws;
    try {
      ws = typeof transport.openEmsSocket === 'function'
        ? await transport.openEmsSocket()
        : null;
      if (disposed || seq !== state.wsConnectSeq) {
        if (ws) { try { ws.close(1000, 'stale'); } catch {} }
        return;
      }
      if (!ws) {
        setConnectedState(false);
        scheduleStreamReconnect();
        return;
      }
    } catch {
      setConnectedState(false);
      scheduleStreamReconnect();
      return;
    }
    state.stateWs = ws;
    ws.onopen = () => {
      if (state.stateWs !== ws || disposed) {
        try { ws.close(1000, 'stale'); } catch {}
        return;
      }
      const isReconnect = state.wsHasConnectedOnce;
      state.wsHasConnectedOnce = true;
      state.wsRetryMs = 4000;
      state.lastWsRxAt = Date.now();
      setConnectedState(true);
      logStation(isReconnect ? 'Reconnected to live station telemetry stream.' : 'Connected to live station telemetry stream.', 't-ok');

      if (!state.notesHydrated) {
        void hydrateNotesFromServer();
      } else if (state.notesDirtyOffline) {
        saveLiveNotes(true);
      }
      if (typeof resumePendingCheckPoll === 'function') {
        resumePendingCheckPoll();
      }
      if (isReconnect) {
        void Promise.all([
          story.refreshCaseBoard(),
          refreshDispatch(),
          refreshAlarms(),
          refreshOperatorLog(),
          state.activeTab === 'frames' ? refreshFrames() : Promise.resolve(),
        ]);
      }
    };
    ws.onmessage = (ev) => {
      if (state.stateWs !== ws || disposed) return;
      state.lastWsRxAt = Date.now();
      try { applyLiveDelta(JSON.parse(ev.data)); } catch {}
    };
    ws.onerror = () => {
      if (state.stateWs !== ws || disposed) return;
      setConnectedState(false);
    };
    ws.onclose = () => {
      if (state.stateWs !== ws || disposed) return;
      state.stateWs = null;
      setConnectedState(false);
      if (typeof options.onUpstreamLost === 'function' && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        options.onUpstreamLost(502);
      }
      scheduleStreamReconnect();
    };
  }, 0);
}

function scheduleStreamReconnect() {
  if (disposed || state.wsRetryTimer) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const delay = state.wsRetryMs;
  state.wsRetryMs = Math.min(15000, Math.round(state.wsRetryMs * 1.8));
  state.wsRetryTimer = setTimeout(() => {
    state.wsRetryTimer = null;
    connectStationStream();
  }, delay);
}

async function initLiveSession() {
  await Promise.all([tour.init(), story.init()]);
  if (disposed) return;
  renderBriefAndChecks();

  void pty.connect();

  await refreshStateOnce();
  if (disposed) return;
  await Promise.all([
    refreshDispatch(),
    refreshAlarms(),
    refreshFrames(),
    story.refreshCaseBoard(),
    hydrateNotesFromServer(),
    refreshOperatorLog(),
  ]);
  if (disposed) return;

  const initOpener = story.ensureOpenerInDispatch(contractModId(state.module), state.dispatch);
  if (initOpener) {
    state.dispatch.unshift(initOpener);
    renderDispatch();
  }
  story.updateStakesStrip({
    districts: state.districts,
    dispatchEntries: state.dispatch,
    liveConnected: state.liveConnected,
  });

  connectStationStream();

  if (!tour.isColdOpenSeen()) {
    story.startColdOpen();
  } else if (!tour.isSeen()) {
    tour.showWelcome();
  }
}

let pendingConfirmAction = null;
function openConfirmDialog({ title, body, confirmLabel = 'Confirm', onConfirm }) {
  el.dialogTitle.textContent = title;
  el.dialogBody.textContent = body;
  el.dialogConfirm.textContent = confirmLabel;
  pendingConfirmAction = onConfirm;
  if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
  else el.dialog.setAttribute('open', 'open');
}

function closeConfirmDialog() {
  pendingConfirmAction = null;
  if (typeof el.dialog.close === 'function' && el.dialog.open) el.dialog.close();
  else el.dialog.removeAttribute('open');
}

function wirePanelDragAndDrop() {
  let draggedPanel = null;
  const panels = Array.from(document.querySelectorAll('.ws-panel'));
  const handles = Array.from(document.querySelectorAll('.panel-drag-handle'));

  handles.forEach((handle) => {
    handle.addEventListener('dragstart', (e) => {
      const pid = handle.dataset.dragPanel;
      draggedPanel = pid;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', pid);
      }
      const host = handle.closest('.ws-panel');
      host?.classList.add('is-dragging');
    });
    handle.addEventListener('dragend', () => {
      draggedPanel = null;
      panels.forEach((p) => p.classList.remove('is-dragging', 'is-drop-target'));
    });
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const pid = handle.dataset.dragPanel;
        const order = ['station', 'terminal', 'mission'];
        const next = order[(order.indexOf(pid) + 1) % order.length];
        swapWorkspacePanels(pid, next);
      }
    });
  });

  panels.forEach((panel) => {
    panel.addEventListener('dragover', (e) => {
      if (!draggedPanel || panel.dataset.panelId === draggedPanel) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      panel.classList.add('is-drop-target');
    });
    panel.addEventListener('dragleave', (e) => {
      if (!panel.contains(e.relatedTarget)) {
        panel.classList.remove('is-drop-target');
      }
    });
    panel.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetId = panel.dataset.panelId;
      const srcId = draggedPanel || e.dataTransfer?.getData('text/plain');
      panels.forEach((p) => p.classList.remove('is-dragging', 'is-drop-target'));
      draggedPanel = null;
      if (srcId && targetId && srcId !== targetId) {
        swapWorkspacePanels(srcId, targetId);
      }
    });
  });
}

function wireResizers() {
  const split = document.getElementById('split-handle');
  const main = el.workspaceMain;
  let dragX = false;
  const setColPct = (pct) => {
    const c = Math.max(28, Math.min(72, Math.round(pct)));
    if (state.gridLayout.orientation === 'sidebar') {
      main?.style.setProperty('--sidebar-w', `${c}%`);
    } else {
      main?.style.setProperty('--left-pane-pct', `${c}%`);
    }
    split.setAttribute('aria-valuenow', String(c));
    requestAnimationFrame(() => {
      pty.scheduleFit();
      scheduleResponsiveStage();
      tour._repositionActive();
    });
  };
  split.addEventListener('pointerdown', (e) => { dragX = true; split.setPointerCapture(e.pointerId); });
  split.addEventListener('pointermove', (e) => {
    if (!dragX) return;
    const r = main.getBoundingClientRect();
    setColPct(((e.clientX - r.left) / r.width) * 100);
  });
  split.addEventListener('pointerup', () => { dragX = false; });
  split.addEventListener('pointercancel', () => { dragX = false; });

  const deck = document.getElementById('deck-resize-handle');
  let dragY = false;
  const applyDeckH = (px) => {
    if (state.deckExpanded) setDeckExpanded(false);
    const maxH = Math.max(220, window.innerHeight - 400);
    const clamped = Math.max(220, Math.min(maxH, Math.round(px)));
    main?.style.setProperty('--deck-h', `${clamped}px`);
    deck.setAttribute('aria-valuenow', String(clamped));
    try { localStorage.setItem(STORAGE_DECK_H, String(clamped)); } catch {}
    requestAnimationFrame(() => {
      pty.scheduleFit();
      scheduleResponsiveStage();
      tour._repositionActive();
    });
  };
  try {
    const savedH = parseInt(localStorage.getItem(STORAGE_DECK_H) || '', 10);
    if (savedH >= 220) applyDeckH(savedH);
  } catch {}
  deck.addEventListener('pointerdown', (e) => { dragY = true; deck.setPointerCapture(e.pointerId); });
  deck.addEventListener('pointermove', (e) => {
    if (!dragY) return;
    if (state.gridLayout.orientation === 'sidebar') {
      const r = main.getBoundingClientRect();
      const pct = Math.max(25, Math.min(75, Math.round(((e.clientY - r.top) / r.height) * 100)));
      main?.style.setProperty('--side-top-pct', `${pct}%`);
      requestAnimationFrame(() => {
        pty.scheduleFit();
        scheduleResponsiveStage();
        tour._repositionActive();
      });
    } else {
      applyDeckH(window.innerHeight - e.clientY - 14);
    }
  });
  deck.addEventListener('pointerup', () => { dragY = false; });
  deck.addEventListener('pointercancel', () => { dragY = false; });
  deck.addEventListener('keydown', (e) => {
    const cur = parseInt(deck.getAttribute('aria-valuenow') || '292', 10);
    if (e.key === 'ArrowUp') { e.preventDefault(); applyDeckH(cur + 24); }
    if (e.key === 'ArrowDown') { e.preventDefault(); applyDeckH(cur - 24); }
  });
}

let stageRo = null;
function wireEvents() {
  const sig = { signal: ac.signal };
  document.getElementById('btn-all-labs')?.addEventListener('click', () => {
    if (typeof options.onBackToAllLabs === 'function') options.onBackToAllLabs();
  }, sig);
  el.btnRail.addEventListener('click', () => toggleRail(), sig);
  el.btnTheme.addEventListener('click', () => setTheme(state.theme === 'daylight' ? 'ember' : 'daylight', true), sig);
  el.btnGlossary?.addEventListener('click', () => glossary.open(null));
  el.hdrAlarmsBtn.addEventListener('click', () => setTab('alarms'));
  el.stakesPill?.addEventListener('click', () => {
    setSceneView('city');
    setTab('dispatch');
  });
  el.btnDeckExpand?.addEventListener('click', () => setDeckExpanded(!state.deckExpanded));

  const setPresetMenuOpen = (open) => {
    el.layoutPresetMenu?.classList.toggle('is-hidden', !open);
    el.btnLayoutPreset?.setAttribute('aria-expanded', String(open));
  };
  el.btnLayoutPreset?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPresetMenuOpen(el.layoutPresetMenu.classList.contains('is-hidden'));
  });
  document.getElementById('btn-preset-wide')?.addEventListener('click', () => {
    setPresetMenuOpen(false);
    setGridOrientation('wide');
  });
  document.getElementById('btn-preset-sidebar')?.addEventListener('click', () => {
    setPresetMenuOpen(false);
    setGridOrientation('sidebar');
  });
  document.getElementById('btn-preset-swap-top')?.addEventListener('click', () => {
    setPresetMenuOpen(false);
    swapWorkspacePanels(state.gridLayout.slotA, state.gridLayout.slotB);
  });
  document.getElementById('btn-preset-reset')?.addEventListener('click', () => {
    setPresetMenuOpen(false);
    resetGridLayout();
  });

  document.getElementById('btn-end-session').addEventListener('click', () => {
    openConfirmDialog({
      title: 'End this sitting?',
      body: 'Stopping the session removes your private task containers. Saved notes and completed module points remain stored.',
      confirmLabel: 'End sitting',
      onConfirm: () => {
        if (typeof options.onEndSession === 'function') options.onEndSession();
        else logStation('Session end requested by operator.', 't-warn');
      },
    });
  }, sig);

  document.querySelectorAll('[data-layout-mode]').forEach((b) => {
    b.addEventListener('click', () => setLayoutMode(b.dataset.layoutMode), sig);
  });
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === '1') { e.preventDefault(); setLayoutMode('scene'); }
    if (e.altKey && e.key === '2') { e.preventDefault(); setLayoutMode('split'); }
    if (e.altKey && e.key === '3') { e.preventDefault(); setLayoutMode('terminal'); }
  }, sig);

  el.dialogCancel.addEventListener('click', closeConfirmDialog);
  el.dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeConfirmDialog();
  });
  el.dialogConfirm.addEventListener('click', () => {
    const fn = pendingConfirmAction;
    closeConfirmDialog();
    if (fn) fn();
  });

  el.permitCancel.addEventListener('click', closePermitDialog);
  el.permitDialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closePermitDialog();
  });
  el.permitHoldBtn.addEventListener('click', () => {
    if (!permitResolver) return;
    if (el.permitInput.value.trim().toUpperCase() === permitResolver.device.toUpperCase()) {
      completePermitExecution();
    } else if (el.permitError) {
      el.permitError.textContent = `Type ${permitResolver.device} or press and hold Confirm for 0.8 s.`;
    }
  });
  el.permitHoldBtn.addEventListener('pointerdown', () => {
    if (!permitResolver) return;
    if (el.permitInput.value.trim().toUpperCase() === permitResolver.device.toUpperCase()) return;
    el.permitHoldBtn.textContent = 'Holding...';
    permitResolver.holdTimer = setTimeout(() => {
      el.permitHoldBtn.textContent = 'Hold to execute';
      completePermitExecution();
    }, 800);
  });
  const cancelHold = () => {
    if (permitResolver && permitResolver.holdTimer) {
      clearTimeout(permitResolver.holdTimer);
      permitResolver.holdTimer = null;
      el.permitHoldBtn.textContent = 'Hold to execute';
    }
  };
  el.permitHoldBtn.addEventListener('pointerup', cancelHold);
  el.permitHoldBtn.addEventListener('pointerleave', cancelHold);
  el.permitHoldBtn.addEventListener('pointercancel', cancelHold);

  document.querySelectorAll('[data-scene-view]').forEach((btn) => {
    btn.addEventListener('click', () => setSceneView(btn.dataset.sceneView));
  });

  document.querySelectorAll('[data-nav-group]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const grp = btn.dataset.navGroup;
      const targetTab = state.lastSubTabByGroup[grp] || GROUP_DEFAULT_TAB[grp] || 'brief';
      setTab(targetTab);
    });
  });

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

  el.btnRightTerm.addEventListener('click', () => setRightTab('terminal'));
  el.btnRightLog.addEventListener('click', () => setRightTab('log'));
  el.btnToggleEditor.addEventListener('click', () => setRightTab(state.rightTab === 'editor' ? 'terminal' : 'editor'));
  document.getElementById('btn-term-reconnect').addEventListener('click', () => pty.reconnectNow());
  document.getElementById('btn-log-clear').addEventListener('click', () => { el.stationLogOut.replaceChildren(); });
  document.getElementById('btn-term-pin').addEventListener('click', () => {
    const sel = pty.getSelection();
    if (sel) {
      pinArtifact('Terminal selection', sel.slice(0, 180), 'Shell');
      return;
    }
    const rows = el.stationLogOut.querySelectorAll('.term-line');
    const latest = rows.length ? rows[rows.length - 1].textContent.trim() : '';
    if (latest) pinArtifact('Station log', latest.slice(0, 180), 'Station log');
  });

  el.editorText.addEventListener('input', () => {
    state.editorDirty = true;
    el.editorStatus.textContent = 'Unsaved';
    stashCurrentEditorDraft();
    updateEditorGutter();
  });
  el.editorText.addEventListener('scroll', () => { el.editorGutter.scrollTop = el.editorText.scrollTop; });
  document.getElementById('btn-editor-save').addEventListener('click', () => void saveEditorFile(false));
  el.btnEditorReload?.addEventListener('click', () => {
    const fname = getActiveEditorFilename();
    clearEditorDraft(fname);
    void loadEditorFile(fname, true);
  });
  el.btnConflictReload?.addEventListener('click', () => {
    const fname = getActiveEditorFilename();
    clearEditorDraft(fname);
    hideEditorConflict();
    void loadEditorFile(fname, true);
  });
  el.btnConflictOverwrite?.addEventListener('click', () => {
    hideEditorConflict();
    void saveEditorFile(true);
  });
  el.editorFileSelect?.addEventListener('change', () => {
    stashCurrentEditorDraft();
    const nextFile = el.editorFileSelect.value;
    if (nextFile) {
      state.editorFile = nextFile;
      void loadEditorFile(nextFile, false);
    }
  });

  const optBtn = document.getElementById('btn-stage-options');
  const optMenu = document.getElementById('stage-options-menu');
  const setOptOpen = (open) => { optMenu.classList.toggle('is-hidden', !open); optBtn.setAttribute('aria-expanded', String(open)); };
  optBtn.addEventListener('click', (e) => { e.stopPropagation(); setOptOpen(optMenu.classList.contains('is-hidden')); });
  document.addEventListener('click', (e) => {
    if (!optMenu.classList.contains('is-hidden') && !optMenu.contains(e.target) && e.target !== optBtn) setOptOpen(false);
    if (el.layoutPresetMenu && !el.layoutPresetMenu.classList.contains('is-hidden') && !el.layoutPresetMenu.contains(e.target) && !el.btnLayoutPreset.contains(e.target)) {
      setPresetMenuOpen(false);
    }
    if (!el.objCard.classList.contains('is-collapsed') && !el.objCard.contains(e.target) && !el.objCollapseBtn.contains(e.target)) {
      setChecklistOpen(false);
    }
  }, sig);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !optMenu.classList.contains('is-hidden')) { setOptOpen(false); optBtn.focus(); }
    if (e.key === 'Escape' && el.layoutPresetMenu && !el.layoutPresetMenu.classList.contains('is-hidden')) { setPresetMenuOpen(false); el.btnLayoutPreset?.focus(); }
    if (e.key === 'Escape' && !el.objCard.classList.contains('is-collapsed') && !tour.mode && !story.coldOpenActive) {
      setChecklistOpen(false);
      el.objCollapseBtn?.focus();
    }
  }, sig);

  el.btnRelayAudio.addEventListener('click', () => {
    state.relayAudio = !state.relayAudio;
    el.btnRelayAudio.setAttribute('aria-pressed', String(state.relayAudio));
    document.getElementById('state-relay-audio').textContent = state.relayAudio ? 'On' : 'Off';
  });
  document.getElementById('btn-pause-motion').addEventListener('click', () => {
    state.motionPaused = !state.motionPaused;
    document.getElementById('state-pause-motion').textContent = state.motionPaused ? 'Paused' : 'Playing';
    fx.setUserPaused(state.motionPaused);
  });
  const syncReduced = (v) => {
    state.reducedMotion = Boolean(v);
    document.documentElement.dataset.reducedMotion = String(state.reducedMotion);
    document.getElementById('btn-reduced-motion').setAttribute('aria-pressed', String(state.reducedMotion));
    document.getElementById('state-reduced-motion').textContent = state.reducedMotion ? 'On' : 'Off';
    fx.setReducedMotion(state.reducedMotion);
  };
  syncReduced(state.reducedMotion);
  osReducedMotionQuery.addEventListener('change', (ev) => syncReduced(ev.matches), sig);
  document.getElementById('btn-reduced-motion').addEventListener('click', () => syncReduced(!state.reducedMotion), sig);

  document.getElementById('btn-toggle-objectives').addEventListener('click', () => {
    setOptOpen(false);
    setChecklistOpen(el.objCard.classList.contains('is-collapsed'));
  });
  el.objCollapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setChecklistOpen(el.objCard.classList.contains('is-collapsed'));
  });

  document.getElementById('btn-mobile-show-map').addEventListener('click', (e) => {
    state.mobileMapOpen = !state.mobileMapOpen;
    el.stageCard.classList.toggle('mobile-map-open', state.mobileMapOpen);
    e.currentTarget.setAttribute('aria-expanded', String(state.mobileMapOpen));
    e.currentTarget.textContent = state.mobileMapOpen ? 'Hide map' : 'Show map';
  });

  document.getElementById('btn-brief-open-console').addEventListener('click', (e) => {
    const targetTab = e.currentTarget.dataset.jumpTab || 'console';
    setTab(targetTab);
  });
  document.getElementById('btn-m1-open-frames').addEventListener('click', () => setTab('frames'));
  document.getElementById('btn-other-open-frames').addEventListener('click', () => setTab('frames'));
  document.getElementById('btn-other-open-trends').addEventListener('click', () => setTab('trends'));

  document.getElementById('chk-m1-outline').addEventListener('change', (e) => { state.m1Highlight = e.target.checked; syncSceneDOM(); });

  const requestBay = async () => {
    if (!state.liveConnected) return;
    const bayId = document.getElementById('bay-readout-select')?.value || 'BAY-01';
    const resp = await apiJson('POST', '/api/ems/dispatch/bay-readout', { bay_id: bayId });
    if (resp && resp.ok && resp.data) {
      state.readoutCount += 1;
      const rc = document.getElementById('m4-readout-count');
      if (rc) rc.textContent = `${state.readoutCount} bay check${state.readoutCount === 1 ? '' : 's'}`;
      state.dispatch.unshift(resp.data);
      renderDispatch();
      setTab('dispatch');
      tour.notifyEvent('bay-readout-requested');
      logStation(`Field bay readout ${bayId}: ${resp.data.body || resp.data.message}`, 't-warn');
    } else {
      logStation(`Field bay readout failed on ${bayId}.`, 't-err');
    }
  };
  document.getElementById('btn-m4-baycheck').addEventListener('click', requestBay);
  document.getElementById('btn-dispatch-bay').addEventListener('click', requestBay);
  document.getElementById('btn-m4-pin').addEventListener('click', () => {
    pinArtifact('Control room HMI', `Reported ${state.totalMw.toFixed(1)} MW, ${state.busKv.toFixed(1)} kV, ${state.alarms.filter((a) => a.state === 'active').length} alarms`, 'L3 HMI');
  });

  document.getElementById('btn-m8-load').addEventListener('click', async () => {
    if (!state.liveConnected) return;
    const r = await transport.readFile('policy.yaml').catch(() => null);
    if (r && r.ok) {
      hydrateMatrixFromYaml(r.text || '');
      logStation('Loaded ~/workspace/policy.yaml into policy matrix.', 't-ok');
    }
  }, sig);
  document.getElementById('btn-m8-write').addEventListener('click', async () => {
    if (!state.liveConnected) return;
    const yml = policyMatrixToYaml();
    const r = await transport.writeFile('policy.yaml', yml).catch(() => null);
    if (r && r.ok) logStation('Wrote matrix rules to ~/workspace/policy.yaml.', 't-ok');
  }, sig);
  document.getElementById('btn-m8-test').addEventListener('click', async () => {
    if (!state.liveConnected) return;
    const resp = await apiJson('POST', '/api/ems/policy/dry-run', { policy_yaml: policyMatrixToYaml() });
    if (resp && resp.ok) {
      logStation(`Policy dry-run: ${resp.data.valid === false ? 'invalid' : 'valid'} (${resp.data.rule_count ?? 0} rules).`, resp.data.valid === false ? 't-err' : 't-ok');
    } else {
      logStation(`Policy dry-run rejected: ${resp?.data?.error || 'error'}.`, 't-err');
    }
  }, sig);
  document.getElementById('btn-m8-apply').addEventListener('click', async () => {
    if (!state.liveConnected) return;
    const yml = policyMatrixToYaml();
    await transport.writeFile('policy.yaml', yml).catch(() => {});
    const resp = await apiJson('POST', '/api/ems/policy/apply', { policy_yaml: yml });
    if (resp && resp.ok && resp.data.applied !== false) {
      state.m8ShieldsRaised = true;
      logStation(`Policy applied (${resp.data.rule_count ?? 0} rules active).`, 't-ok');
      syncSceneDOM();
    } else {
      logStation(`Policy apply rejected: ${resp?.data?.error || 'error'}.`, 't-err');
    }
  }, sig);
  document.getElementById('btn-m8-probe').addEventListener('click', async () => {
    if (!state.liveConnected) return;
    const src_zone = document.getElementById('m8-probe-src').value;
    const dst_zone = document.getElementById('m8-probe-dst').value;
    const dst_port = parseInt(document.getElementById('m8-probe-port').value, 10);
    const outEl = document.getElementById('m8-probe-out');
    if (!dst_port || dst_port < 1 || dst_port > 65535) {
      outEl.textContent = 'Enter a valid port (1 to 65535).';
      return;
    }
    const resp = await apiJson('POST', '/api/ems/policy/probe', { src_zone, dst_zone, dst_port });
    if (resp && resp.ok) {
      const outcome = String(resp.data.outcome || 'UNKNOWN');
      outEl.textContent = `${src_zone} -> ${dst_zone}:${dst_port} = ${outcome}`;
      if (outcome.toUpperCase() === 'DENY') fx.emitProbeRipples(['corp-dmz', 'dmz-field', 'corp-field']);
      logStation(`Dashboard probe preview: ${src_zone} -> ${dst_zone}:${dst_port} = ${outcome} (run fwctl probe in shell for evidence).`, 't-dim');
    }
  });

  document.getElementById('btn-sbo-cancel').addEventListener('click', () => { state.selectedBayId = null; state.livePreflight = null; syncSceneDOM(); });
  el.btnSboExec.addEventListener('click', triggerPermitForSelectedBay);
  document.getElementById('btn-sync-close').addEventListener('click', triggerPermitForTieClose);

  const applyGovernorSetpoint = async () => {
    if (!state.liveConnected || !el.govFreqInput) return;
    const freqHz = Number(el.govFreqInput.value);
    if (!Number.isFinite(freqHz) || freqHz < 48.5 || freqHz > 51.5) {
      logStation('Governor setpoint must be between 48.50 and 51.50 Hz.', 't-err');
      return;
    }
    const resp = await apiJson('POST', '/api/ems/governor/set', { freq_hz: Number(freqHz.toFixed(2)) });
    if (resp && resp.ok && resp.data?.ok !== false) {
      logStation(`Governor frequency reference set to ${freqHz.toFixed(2)} Hz.`, 't-ok');
      await refreshStateOnce();
    } else {
      logStation(`Governor setpoint rejected: ${resp?.data?.detail || resp?.data?.error || 'error'}.`, 't-err');
    }
  };
  el.btnGovSet?.addEventListener('click', () => void applyGovernorSetpoint());
  el.govFreqInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void applyGovernorSetpoint();
    }
  });

  el.btnClear86.addEventListener('click', async () => {
    if (!state.liveConnected) return;
    const targets = state.activeLockouts.length ? [...state.activeLockouts] : ['TR-1'];
    let clearedAny = false;
    for (const asset of targets) {
      const resp = await apiJson('POST', '/api/ems/lockout/clear', { asset });
      if (resp && resp.ok && resp.data?.ok !== false) {
        if (resp.data?.code === 'NOT_LATCHED') {
          logStation(`No active Lockout 86 latch on ${asset}.`, 't-dim');
        } else {
          clearedAny = true;
          logStation(`Lockout 86 cleared on ${asset}.`, 't-ok');
        }
      } else {
        logStation(`Clear lockout rejected on ${asset}: ${resp?.data?.detail || resp?.data?.error || 'error'}`, 't-err');
      }
    }
    if (clearedAny) {
      returnSoeToLive();
      state.soeReplay.available = false;
      await refreshStateOnce();
    }
  });
  document.getElementById('btn-reset-electrical').addEventListener('click', () => {
    const maxPen = state.maxTripPenaltyPct || 30;
    const tripWarn = state.tripEvents >= 2
      ? ' Warning: you have 2 trips logged; a 3rd trip disqualifies both Full Pass and Safe Partial.'
      : '';
    const costNote = state.module === 'm9'
      ? `Each protection trip in Module 9 costs 10% (max ${maxPen}%). Trips so far: ${state.tripEvents}. Resetting does not lower your trip count.${tripWarn} `
      : '';
    openConfirmDialog({
      title: 'Reset electrical state?',
      body: `${costNote}Returns all 33 kV feeders, TR-2, and CB-220-TIE1 to Clean Start while preserving notes and timeline pins.`,
      confirmLabel: 'Reset electrical state',
      onConfirm: async () => {
        const resp = await apiJson('POST', '/api/ems/reset-electrical', { module_id: contractModId() });
        if (resp && resp.ok) {
          if (typeof resp.data?.post_trip_resets === 'number') state.postTripResets = resp.data.post_trip_resets;
          if (typeof resp.data?.reset_penalty_pct === 'number') state.resetPenaltyPct = resp.data.reset_penalty_pct;
          if (typeof resp.data?.next_reset_penalty_pct === 'number') state.nextResetPenaltyPct = resp.data.next_reset_penalty_pct;
          if (typeof resp.data?.max_reset_penalty_pct === 'number') state.maxResetPenaltyPct = resp.data.max_reset_penalty_pct;
          if (typeof resp.data?.trip_events === 'number') state.tripEvents = resp.data.trip_events;
          else if (typeof resp.data?.post_trip_resets === 'number') state.tripEvents = resp.data.post_trip_resets;
          if (typeof resp.data?.trip_penalty_pct === 'number') state.tripPenaltyPct = resp.data.trip_penalty_pct;
          else if (typeof resp.data?.reset_penalty_pct === 'number') state.tripPenaltyPct = resp.data.reset_penalty_pct;
          if (typeof resp.data?.max_trip_penalty_pct === 'number') state.maxTripPenaltyPct = resp.data.max_trip_penalty_pct;
          returnSoeToLive();
          state.soeReplay.available = false;
          logStation(`Electrical state reset to Clean Start (trips so far: ${state.tripEvents}, -${state.tripPenaltyPct}%).`, 't-ok');
          await refreshStateOnce();
          renderChecksTab();
        } else {
          logStation(`Electrical reset rejected (HTTP ${resp ? resp.status : 'offline'}).`, 't-err');
        }
      },
    });
  });

  el.chkTr2.addEventListener('change', async () => {
    if (!state.liveConnected) { el.chkTr2.checked = state.tr2Online; return; }
    const nextVal = el.chkTr2.checked;
    const resp = await apiJson('POST', '/api/ems/tr2/set', { closed: nextVal });
    if (!resp || !resp.ok || resp.data.ok === false) {
      el.chkTr2.checked = state.tr2Online;
      logStation(`TR-2 switching rejected: ${resp?.data?.detail || resp?.data?.error || 'error'}.`, 't-err');
      return;
    }
    fx.emitWireEcho(930, 250, 'echo', 'substation');
    logStation(`TR-2 ${nextVal ? 'paralleled' : 'set to standby'}.`, 't-ok');
    await refreshStateOnce();
  });

  document.getElementById('btn-export-oplog').addEventListener('click', () => {
    const text = ['CISF OT Operator Log (UTC / IST)', ...state.operatorLog.map((e) => `- ${e.utc} (${e.ist}) | ${e.device} ${e.action} (${e.result}) | ${e.reason}`)].join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
    logStation(`Copied operator log (${state.operatorLog.length} entries).`, 't-ok');
  });

  el.soeScrubber.addEventListener('input', (e) => { stopSoeReplayTimer(); setSoeReplayFrame(Number(e.target.value)); });
  el.btnSoePlay.addEventListener('click', () => {
    if (!state.soeReplay.available) return;
    if (state.soeReplay.playing) { stopSoeReplayTimer(); return; }
    state.soeReplay.playing = true;
    el.btnSoePlay.textContent = 'Pause replay';
    let step = state.soeReplay.index >= state.soeReplay.frames.length - 1 ? 0 : state.soeReplay.index;
    setSoeReplayFrame(step);
    state.soeReplay.timerId = setInterval(() => {
      step += 1;
      if (step >= state.soeReplay.frames.length) { stopSoeReplayTimer(); return; }
      setSoeReplayFrame(step);
    }, 900);
  });
  el.btnSoeLive.addEventListener('click', returnSoeToLive);

  document.querySelectorAll('[data-alarm-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sub = btn.dataset.alarmSub;
      document.querySelectorAll('[data-alarm-sub]').forEach((b) => b.classList.toggle('is-active', b.dataset.alarmSub === sub));
      document.getElementById('alarms-sub-list').classList.toggle('is-hidden', sub !== 'list');
      document.getElementById('alarms-sub-soe').classList.toggle('is-hidden', sub !== 'soe');
    });
  });
  document.getElementById('btn-refresh-alarms').addEventListener('click', () => { refreshAlarms(); refreshSoe(); });

  document.getElementById('btn-trends-pause').addEventListener('click', (e) => {
    trends.setPaused(!trends.paused);
    e.currentTarget.textContent = trends.paused ? 'Resume' : 'Pause';
  });
  document.getElementById('btn-trends-reset').addEventListener('click', () => trends.resetZoom());

  document.getElementById('btn-timeline-copy').addEventListener('click', copySanitizedTimeline);
  document.getElementById('btn-copy-timeline').addEventListener('click', copySanitizedTimeline);
  document.getElementById('timeline-scrubber').addEventListener('input', (e) => {
    const pct = Number(e.target.value);
    const sorted = [...state.pinnedArtifacts].sort((a, b) => a.utcSec - b.utcSec);
    if (!sorted.length) {
      document.getElementById('timeline-scrub-label').textContent = 'No pins yet';
      return;
    }
    const idx = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
    const item = sorted[idx];
    document.getElementById('timeline-scrub-label').textContent = `${item.utc} · ${item.vantage}`;
  });

  document.getElementById('frames-dataset-select').addEventListener('change', refreshFrames);
  document.getElementById('frames-filter-input').addEventListener('input', () => {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
      filterDebounceTimer = null;
      if (!disposed) drawFramesPanel();
    }, 120);
  });
  document.getElementById('btn-frames-refresh').addEventListener('click', refreshFrames);

  const trackFreeHint = (level) => {
    if (!state.liveConnected) return;
    const cId = contractModId(state.module);
    const key = `${cId}:${level}`;
    if (state.hintsTracked.has(key)) return;
    state.hintsTracked.add(key);
    void apiJson('POST', `/api/ems/hints/${cId}/${level}`, { confirmed: true });
  };
  el.hintDetails1?.addEventListener('toggle', () => {
    if (el.hintDetails1.open) trackFreeHint(1);
  });
  el.hintDetails2?.addEventListener('toggle', () => {
    if (el.hintDetails2.open) trackFreeHint(2);
  });

  document.getElementById('btn-unlock-l3').addEventListener('click', () => {
    const m = getMod();
    openConfirmDialog({
      title: 'Reveal Level 3 hint?',
      body: `Unlocking Level 3 for Module ${m.num} logs a permanent 10% point deduction on this module.`,
      confirmLabel: 'Reveal hint (-10%)',
      onConfirm: async () => {
        const resp = await apiJson('POST', `/api/ems/hints/${contractModId(m.id)}/3`, { confirmed: true });
        if (disposed) return;
        if (resp && resp.ok) {
          state.l3Unlocked.add(m.id);
          if (typeof resp.data?.hint === 'string' && resp.data.hint.trim()) {
            state.l3HintText[m.id] = resp.data.hint.trim();
          }
          // Update only L3 DOM directly so unsaved File Editor buffers are never reloaded/wiped (E-02/E-06).
          syncL3HintUI();
          logStation(`Level 3 hint unlocked for Module ${m.num} (-10% recorded).`, 't-warn');
        }
      },
    });
  });

  BAY_SLOTS.forEach((slot) => {
    const bayEl = document.getElementById(`bay-${slot.idx + 1}`);
    const activate = () => {
      if (isOpsConsoleMod()) {
        setTab('console');
        selectFeederSBO(`BAY-0${slot.idx + 1}`);
      }
    };
    bayEl?.addEventListener('click', activate);
    bayEl?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });

  document.getElementById('tr-2-unit')?.addEventListener('click', () => {
    if (isOpsConsoleMod() && state.liveConnected) {
      el.chkTr2.checked = !el.chkTr2.checked;
      el.chkTr2.dispatchEvent(new Event('change'));
    }
  });

  el.btnSplitLens.addEventListener('click', () => {
    state.splitLensOn = !state.splitLensOn;
    if (state.splitLensOn) setSceneView('city');
    syncSceneDOM();
  });

  let dragLens = false;
  const setLens = (pct) => {
    state.lensPct = Math.max(12, Math.min(88, Math.round(pct)));
    el.lensHmiLayer.style.clipPath = `inset(0 ${100 - state.lensPct}% 0 0)`;
    el.lensLabelsLayer.style.clipPath = `inset(0 ${100 - state.lensPct}% 0 0)`;
    el.svgHost.style.clipPath = `inset(0 0 0 ${state.lensPct}%)`;
    el.svgLabelsHost.style.clipPath = `inset(0 0 0 ${state.lensPct}%)`;
    el.lensDivider.style.left = `${state.lensPct}%`;
    el.lensDivider.setAttribute('aria-valuenow', String(state.lensPct));
  };
  el.lensDivider.addEventListener('pointerdown', (e) => { dragLens = true; el.lensDivider.setPointerCapture(e.pointerId); });
  el.lensDivider.addEventListener('pointermove', (e) => {
    if (!dragLens) return;
    const r = el.stageViewport.getBoundingClientRect();
    setLens(((e.clientX - r.left) / r.width) * 100);
  });
  el.lensDivider.addEventListener('pointerup', () => { dragLens = false; });
  el.lensDivider.addEventListener('pointercancel', () => { dragLens = false; });

  el.btnNextMod.addEventListener('click', () => {
    const cur = getMod();
    const next = MODULES.find((m) => m.num === cur.num + 1);
    if (next) { switchModuleFromRail(next.id); setTab('brief'); }
  });

  // Load local notes/pins inside try/catch, but register the input listener OUTSIDE so blocked localStorage never disables Postgres saving (M-10).
  try {
    el.notesArea.value = localStorage.getItem(STORAGE_NOTES) || '';
    const savedPinsRaw = localStorage.getItem(STORAGE_PINS);
    if (savedPinsRaw) {
      const parsedPins = JSON.parse(savedPinsRaw);
      if (Array.isArray(parsedPins)) {
        state.pinnedArtifacts = parsedPins.map(normalizePin).filter(Boolean);
      }
    }
  } catch {}
  el.notesArea.addEventListener('input', () => {
    saveLiveNotes(false);
  });

  el.btnPractice.addEventListener('click', () => {
    tour.notifyEvent('practice-clicked');
    runLiveEvaluation(false);
  });
  el.btnSubmit.addEventListener('click', () => runLiveEvaluation(true));
  document.getElementById('btn-refresh-case')?.addEventListener('click', () => story.refreshCaseBoard());
  el.btnCaseOpenShift?.addEventListener('click', () => {
    story.openShiftReportFull(document.documentElement.dataset.shiftReport !== 'open');
  });

  wirePanelDragAndDrop();
  wireResizers();

  if ('ResizeObserver' in window && el.stageViewport) {
    stageRo = new ResizeObserver(() => scheduleResponsiveStage());
    stageRo.observe(el.stageViewport);
  }
  window.addEventListener('resize', scheduleResponsiveStage, { passive: true, signal: ac.signal });
  const handleUnload = () => closeStationStream(true);
  window.addEventListener('beforeunload', handleUnload, sig);
  window.addEventListener('pagehide', handleUnload, sig);

  // Network-drop and laptop-sleep liveness resume listeners (E-05).
  window.addEventListener('offline', () => {
    if (disposed) return;
    setConnectedState(false);
    logStation('Browser offline detected; local notes and editor drafts are preserved.', 't-warn');
  }, sig);
  window.addEventListener('online', () => {
    if (disposed) return;
    logStation('Network restored; reconnecting to station telemetry and terminal...', 't-dim');
    state.wsRetryMs = 1000;
    connectStationStream();
    pty.handleNetworkOnline();
    if (typeof resumePendingCheckPoll === 'function') resumePendingCheckPoll();
  }, sig);
  document.addEventListener('visibilitychange', () => {
    if (disposed || document.hidden) return;
    if (state.sceneDomDirtyWhileHidden) {
      syncSceneDOM();
    }
    if (state.activeTab === 'trends') {
      trends.render();
    }
    const stale = state.lastWsRxAt > 0 && Date.now() - state.lastWsRxAt > WS_STALE_THRESHOLD_MS;
    if (!state.stateWs || state.stateWs.readyState !== WebSocket.OPEN || stale) {
      state.wsRetryMs = 1000;
      connectStationStream();
    }
    if (typeof resumePendingCheckPoll === 'function') resumePendingCheckPoll();
  }, sig);

  // Cross-tab awareness so switching modules in another tab keeps this tab in sync (E-17).
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      tabChannel = new BroadcastChannel('cisf-ot-grid-tab');
      tabChannel.onmessage = (ev) => {
        if (disposed || !ev.data) return;
        if (ev.data.type === 'module' && typeof ev.data.modId === 'string' && ev.data.modId !== state.module) {
          if (MODULES.some((m) => m.id === ev.data.modId)) {
            setModule(ev.data.modId, true);
          }
        }
      };
    } catch {
      tabChannel = null;
    }
  }
}

const timerIntervalId = setInterval(() => {
  if (disposed) return;
  const sec = Math.max(0, Math.floor((Date.now() - state.moduleEnteredAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  if (el.objTimer) el.objTimer.textContent = `${mm}:${ss}`;
}, 1000);

const wsWatchdogIntervalId = setInterval(() => {
  if (disposed || document.hidden) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (state.stateWs && state.stateWs.readyState === WebSocket.OPEN && state.lastWsRxAt > 0) {
    if (Date.now() - state.lastWsRxAt > WS_STALE_THRESHOLD_MS) {
      logStation('Station telemetry silent >12 s; forcing WebSocket reconnect...', 't-warn');
      setConnectedState(false);
      state.wsRetryMs = 1000;
      connectStationStream();
    }
  }
}, WS_WATCHDOG_INTERVAL_MS);

loadSavedGridLayout();
applyGridLayoutToDOM();
buildEmptyPolicyMatrixUI();
wireEvents();
try {
  const savedLayout = localStorage.getItem(STORAGE_LAYOUT);
  if (savedLayout) setLayoutMode(savedLayout);
} catch {}
setTheme(state.theme, false);
setModule('m1', true);
setTab('brief');
setRightTab('terminal');
setConnectedState(false);
renderDispatch();
renderPinnedArtifacts();
renderOperatorLog();
syncResponsiveStage(true);
initLiveSession();

function dispose() {
  if (disposed) return;
  disposed = true;
  state.wsConnectSeq += 1;
  activeCheckPollId += 1;
  ac.abort();
  clearInterval(timerIntervalId);
  clearInterval(wsWatchdogIntervalId);
  clearActiveCheckPoll();
  if (flipCleanupTimer) {
    clearTimeout(flipCleanupTimer);
    flipCleanupTimer = null;
  }
  if (railRepositionTimer) {
    clearTimeout(railRepositionTimer);
    railRepositionTimer = null;
  }
  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = null;
  }
  if (notesSaveTimer) {
    clearTimeout(notesSaveTimer);
    notesSaveTimer = null;
  }
  if (tabChannel) {
    try { tabChannel.close(); } catch {}
    tabChannel = null;
  }
  stopSoeReplayTimer();
  closeStationStream(false);
  if (stageResizeRaf) {
    cancelAnimationFrame(stageResizeRaf);
    stageResizeRaf = null;
  }
  if (stageRo) {
    stageRo.disconnect();
    stageRo = null;
  }
  if (permitResolver && permitResolver.holdTimer) {
    clearTimeout(permitResolver.holdTimer);
    permitResolver = null;
  }
  pendingConfirmAction = null;
  fx.dispose();
  pty.dispose();
  tour.dispose();
  story.dispose();
  glossary.dispose();
  if (audioCtx && typeof audioCtx.close === 'function') {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  delete document.documentElement.dataset.layout;
  delete document.documentElement.dataset.deckExpanded;
  delete document.documentElement.dataset.shiftReport;
  delete document.documentElement.dataset.reducedMotion;
  delete document.documentElement.dataset.theme;
}

return {
  dispose,
  setTheme: (nextTheme) => setTheme(nextTheme, false),
  setModule: (modId, silent = false) => setModule(modId, silent),
  getState: () => state,
};
}

