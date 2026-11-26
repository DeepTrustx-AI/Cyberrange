import { createMascot, setMascotPose, hopMascot, isReducedMotion } from './mascot.js';

const STORAGE_TOUR = 'cg-tour-v1';

const SELECTOR_TAB_MAP = {
  '#tab-btn-dispatch': 'dispatch',
  '#btn-dispatch-bay': 'dispatch',
  '#tab-btn-frames': 'frames',
  '#frames-list': 'frames',
  '#tab-btn-timeline': 'timeline',
  '#tab-btn-notes': 'notes',
  '#tab-btn-console': 'console',
  '#policy-matrix': 'console',
  '#feeder-grid': 'console',
  '#sbo-confirm-bar': 'console',
  '#btn-clear-86': 'console',
  '#btn-reset-electrical': 'console',
  '#btn-m4-baycheck': 'console',
  '#soe-replay-panel': 'console',
  '#tab-btn-alarms': 'alarms',
  '#tab-btn-trends': 'trends',
  '#tab-btn-checks': 'checks',
  '#tab-btn-case': 'case',
  '#hint-1': 'brief',
};

function readTourStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_TOUR);
    if (!raw) return { seen: false, coldOpenSeen: false, tipsSeen: {} };
    const parsed = JSON.parse(raw);
    return {
      seen: Boolean(parsed.seen),
      coldOpenSeen: Boolean(parsed.coldOpenSeen),
      tipsSeen: parsed.tipsSeen && typeof parsed.tipsSeen === 'object' ? parsed.tipsSeen : {},
    };
  } catch {
    return { seen: false, coldOpenSeen: false, tipsSeen: {} };
  }
}

function writeTourStorage(data) {
  try {
    localStorage.setItem(STORAGE_TOUR, JSON.stringify(data));
  } catch {
  }
}

function appendRichText(parent, text) {
  const str = String(text || '');
  const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  parts.forEach((seg) => {
    if (!seg) return;
    if (seg.startsWith('**') && seg.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = seg.slice(2, -2);
      parent.appendChild(strong);
    } else if (seg.startsWith('`') && seg.endsWith('`')) {
      const code = document.createElement('code');
      code.textContent = seg.slice(1, -1);
      parent.appendChild(code);
    } else {
      parent.appendChild(document.createTextNode(seg));
    }
  });
}

function isElementVisible(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function resolveTarget(selectors) {
  if (!Array.isArray(selectors)) return null;
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (isElementVisible(el)) return el;
    } catch {
    }
  }
  return null;
}

function rectsOverlap(a, b, pad = 0) {
  if (!a || !b) return false;
  return !(
    a.right + pad <= b.left
    || a.left - pad >= b.right
    || a.bottom + pad <= b.top
    || a.top - pad >= b.bottom
  );
}

function supportsCssAnchor() {
  try {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('position-area: block-end');
  } catch {
    return false;
  }
}

export class TourController {
  constructor({
    tourData = null,
    loadTourData = null,
    initialPrefs = null,
    onPrefsChange = null,
    onReplayColdOpen,
    onInterruptColdOpen,
    isStoryOverlayActive,
    onEnsureTab,
    onOpenGlossary,
    onDemoPanelSwap,
    onEventDispatch,
  } = {}) {
    this.data = tourData || null;
    this.loadTourData = loadTourData || null;
    this.onPrefsChange = onPrefsChange || null;
    this.stored = readTourStorage();
    if (initialPrefs && typeof initialPrefs === 'object') {
      this.applyExternalPrefs(initialPrefs);
    }
    this.onReplayColdOpen = onReplayColdOpen || (() => {});
    this.onInterruptColdOpen = onInterruptColdOpen || (() => {});
    this.isStoryOverlayActive = isStoryOverlayActive || (() => false);
    this.onEnsureTab = onEnsureTab || (() => {});
    this.onOpenGlossary = onOpenGlossary || (() => {});
    this.onDemoPanelSwap = onDemoPanelSwap || (() => {});
    this.onEventDispatch = onEventDispatch || (() => {});

    this.mode = null;
    this.stepIndex = 0;
    this.stepSatisfied = false;
    this.activeTarget = null;
    this.lastTarget = null;
    this.lastMascotRect = null;
    this.activeMascotSvg = null;
    this.activeAnchorEl = null;
    this.activeItem = null;
    this.mobileIndex = 0;
    this.guideAutoCloseTimer = null;
    this.pendingTips = [];
    this._tipTimer = null;
    this._repositionRaf = null;
    this._demoTimers = [];
    this._demoActive = false;
    this._demoRan = false;
    this._helpBeaconTimer = null;
    this._helpToastFadeTimer = null;
    this._helpToastRemoveTimer = null;

    this.spotlightEl = document.getElementById('tour-spotlight');
    this._scrimParts = null;
    this._ringEl = null;
    this.welcomeEl = document.getElementById('tour-welcome');
    this.bubbleEl = document.getElementById('tour-bubble');
    this.guideMenuEl = document.getElementById('guide-menu');
    this.guideBtnEl = document.getElementById('btn-guide-menu');
    this.dockHostEl = document.getElementById('hdr-mascot-dock');
    this.mobileDeckEl = document.getElementById('tour-mobile-deck');

    this._ro = null;
    this._disposed = false;
    this._prefsNotifyQueued = false;
    this._repositionBound = () => this._scheduleReposition();
    this._keyBound = (e) => this._handleGlobalKey(e);
  }

  applyExternalPrefs(prefs) {
    if (!prefs || typeof prefs !== 'object') return;
    if (prefs.tour_seen) this.stored.seen = true;
    if (prefs.cold_open_seen) this.stored.coldOpenSeen = true;
    if (Array.isArray(prefs.dismissed_tips)) {
      prefs.dismissed_tips.forEach((tid) => {
        if (tid) this.stored.tipsSeen[String(tid)] = true;
      });
    }
    writeTourStorage(this.stored);
  }

  _persistPrefs() {
    writeTourStorage(this.stored);
    if (typeof this.onPrefsChange === 'function' && !this._prefsNotifyQueued) {
      this._prefsNotifyQueued = true;
      queueMicrotask(() => {
        this._prefsNotifyQueued = false;
        if (this._disposed || typeof this.onPrefsChange !== 'function') return;
        this.onPrefsChange({
          cold_open_seen: Boolean(this.stored.coldOpenSeen),
          tour_seen: Boolean(this.stored.seen),
          dismissed_tips: Object.keys(this.stored.tipsSeen || {}).filter((k) => this.stored.tipsSeen[k]),
        });
      });
    }
  }

  async init() {
    this._mountHeaderMascotDock();
    if (!this.data) {
      try {
        if (typeof this.loadTourData === 'function') {
          this.data = await this.loadTourData();
        } /* platform provides tourData statically */
      } catch {
      }
    }
    if (!this.data) return false;

    this._buildGuideMenu();
    this._wireListeners();
    return true;
  }

  dispose() {
    this._clearDemoSwap(true);
    this._clearHelpArrivalBeacon();
    this._clearPulseTargets();
    this._clearInertRegions();
    this._clearAnchorName();
    this._disposed = true;
    this._hideSpotlight();
    this._closePopover(this.bubbleEl);
    this._closePopover(this.welcomeEl);
    this._closePopover(this.guideMenuEl);
    if (this._tipTimer) {
      clearTimeout(this._tipTimer);
      this._tipTimer = null;
    }
    if (this._repositionRaf) {
      cancelAnimationFrame(this._repositionRaf);
      this._repositionRaf = null;
    }
    if (this.guideAutoCloseTimer) {
      clearTimeout(this.guideAutoCloseTimer);
      this.guideAutoCloseTimer = null;
    }
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    window.removeEventListener('resize', this._repositionBound);
    window.removeEventListener('scroll', this._repositionBound, true);
    document.removeEventListener('keydown', this._keyBound);
    ['module-rail', 'left-pane', 'right-pane'].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.removeEventListener('transitionend', this._repositionBound);
    });
  }

  _mountHeaderMascotDock() {
    if (!this.dockHostEl || this.dockHostEl.childElementCount > 0) return;
    this.dockHostEl.appendChild(createMascot({ pose: 'idle', size: 24 }));
  }

  isSeen() {
    return Boolean(this.stored.seen);
  }

  isColdOpenSeen() {
    return Boolean(this.stored.coldOpenSeen);
  }

  markColdOpenSeen() {
    this.stored.coldOpenSeen = true;
    this._persistPrefs();
  }

  markSeen() {
    this.stored.seen = true;
    this._persistPrefs();
  }

  _clearDemoSwap(restoreInstant = true) {
    this._demoTimers.forEach((id) => clearTimeout(id));
    this._demoTimers = [];
    if (this._demoActive || this._demoRan) {
      this._demoActive = false;
      this._demoRan = false;
      this.onDemoPanelSwap(restoreInstant ? 'restore-instant' : 'restore');
    }
  }

  _triggerDemoSwap() {
    this._clearDemoSwap(true);
    if (isReducedMotion() || window.innerWidth <= 900) return;
    const t1 = setTimeout(() => {
      if (this.mode !== 'guided' || !this.activeItem || this.activeItem.demoAction !== 'swap-panels') return;
      this._demoActive = true;
      this._demoRan = true;
      this.onDemoPanelSwap('preview-swap');
    }, 450);
    const t2 = setTimeout(() => {
      if (!this._demoActive) return;
      this._demoActive = false;
      this.onDemoPanelSwap('restore');
    }, 2150);
    this._demoTimers.push(t1, t2);
  }

  _clearHelpArrivalBeacon() {
    if (this._helpBeaconTimer) {
      clearTimeout(this._helpBeaconTimer);
      this._helpBeaconTimer = null;
    }
    if (this._helpToastFadeTimer) {
      clearTimeout(this._helpToastFadeTimer);
      this._helpToastFadeTimer = null;
    }
    if (this._helpToastRemoveTimer) {
      clearTimeout(this._helpToastRemoveTimer);
      this._helpToastRemoveTimer = null;
    }
    this.guideBtnEl?.classList.remove('is-dock-settled', 'is-help-highlighted');
    document.getElementById('help-arrival-toast')?.remove();
  }

  _clearPulseTargets() {
    document.querySelectorAll('.is-tour-pulse-target').forEach((n) => n.classList.remove('is-tour-pulse-target'));
  }

  _animateMascotToDock(fromRect) {
    const dockTarget = this.dockHostEl || this.guideBtnEl;
    if (!dockTarget || !this.guideBtnEl) return;

    this._clearHelpArrivalBeacon();

    const triggerBeacon = () => {
      this.guideBtnEl.classList.add('is-dock-settled', 'is-help-highlighted');

      const toast = document.createElement('div');
      toast.id = 'help-arrival-toast';
      toast.className = 'help-arrival-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.textContent = "I'm right here whenever you need help!";
      (document.querySelector('.cg-v13-root') || document.body).appendChild(toast);

      const btnRect = this.guideBtnEl.getBoundingClientRect();
      const toastRect = toast.getBoundingClientRect();
      const vw = window.innerWidth;
      const clampedLeft = Math.max(12, Math.min(vw - toastRect.width - 12, btnRect.right - toastRect.width));
      toast.style.left = `${Math.round(clampedLeft)}px`;
      toast.style.top = `${Math.round(btnRect.bottom + 10)}px`;

      requestAnimationFrame(() => {
        toast.classList.add('is-visible');
      });

      this._helpToastFadeTimer = setTimeout(() => {
        this._helpToastFadeTimer = null;
        toast.classList.remove('is-visible');
      }, 2150);

      this._helpBeaconTimer = setTimeout(() => {
        this._helpBeaconTimer = null;
        this.guideBtnEl?.classList.remove('is-dock-settled', 'is-help-highlighted');
      }, 2400);

      this._helpToastRemoveTimer = setTimeout(() => {
        this._helpToastRemoveTimer = null;
        toast.remove();
      }, 2450);
    };

    if (isReducedMotion() || !fromRect || !isElementVisible(dockTarget)) {
      triggerBeacon();
      return;
    }

    const toRect = dockTarget.getBoundingClientRect();
    const flyer = createMascot({ pose: 'cheer', size: Math.round(fromRect.width || 60) });
    flyer.classList.add('tour-flying-mascot');
    flyer.style.left = `${Math.round(fromRect.left)}px`;
    flyer.style.top = `${Math.round(fromRect.top)}px`;
    (document.querySelector('.cg-v13-root') || document.body).appendChild(flyer);

    const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
    const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);
    const scaleEnd = Math.max(0.32, (toRect.width || 24) / Math.max(1, fromRect.width || 60));
    const nearScale = Math.max(scaleEnd, 0.72);

    if (typeof flyer.animate === 'function') {
      const anim = flyer.animate(
        [
          { transform: 'translate3d(0px, 0px, 0) scale(1)', opacity: 1, offset: 0 },
          { transform: `translate3d(${Math.round(dx * 0.44)}px, ${Math.round(dy * 0.42 - 44)}px, 0) scale(1.12)`, opacity: 1, offset: 0.42 },
          { transform: `translate3d(${Math.round(dx * 0.8)}px, ${Math.round(dy * 0.8 - 12)}px, 0) scale(${nearScale.toFixed(3)})`, opacity: 0.96, offset: 0.78 },
          { transform: `translate3d(${Math.round(dx)}px, ${Math.round(dy)}px, 0) scale(${scaleEnd.toFixed(3)})`, opacity: 0.3, offset: 1 },
        ],
        { duration: 1150, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      );
      anim.onfinish = () => {
        flyer.remove();
        triggerBeacon();
      };
      anim.oncancel = () => {
        flyer.remove();
      };
    } else {
      flyer.remove();
      triggerBeacon();
    }
  }

  _ensureItemTab(item) {
    if (!item) return;
    if (item.ensureTab) {
      this.onEnsureTab(item.ensureTab);
      return;
    }
    const targets = Array.isArray(item.targets) ? item.targets : [];
    const firstVisible = resolveTarget(targets);
    if (firstVisible) return;
    for (const sel of targets) {
      if (SELECTOR_TAB_MAP[sel]) {
        this.onEnsureTab(SELECTOR_TAB_MAP[sel]);
        return;
      }
    }
  }

  _wireListeners() {
    if (this.guideBtnEl) {
      this.guideBtnEl.addEventListener('click', () => {
        if (this.guideMenuEl && this.guideMenuEl.matches(':popover-open')) {
          this.closeGuideMenu();
        } else {
          this.openGuideMenu(false);
        }
      });
    }

    window.addEventListener('resize', this._repositionBound, { passive: true });
    window.addEventListener('scroll', this._repositionBound, { passive: true, capture: true });
    document.addEventListener('keydown', this._keyBound);

    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(() => {
        this._scheduleReposition();
      });
      ['lab-shell', 'living-stage-card', 'left-pane', 'right-pane', 'module-rail'].forEach((id) => {
        const node = document.getElementById(id);
        if (node) this._ro.observe(node);
      });
    }

    ['module-rail', 'left-pane', 'right-pane'].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.addEventListener('transitionend', this._repositionBound);
    });
  }

  _scheduleReposition() {
    if (this._repositionRaf) return;
    this._repositionRaf = requestAnimationFrame(() => {
      this._repositionRaf = null;
      this._repositionActive();
    });
  }

  _handleGlobalKey(e) {
    if (e.key === 'Escape') {
      if (this.guideMenuEl && this.guideMenuEl.matches(':popover-open')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.closeGuideMenu();
        return;
      }
      if (this.welcomeEl && this.welcomeEl.matches(':popover-open')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.dismissWelcome(false);
        return;
      }
      if (this.mode) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.endTour(true);
      }
    }
  }

  _openPopover(dlg) {
    if (!dlg) return;
    if (typeof dlg.showPopover === 'function') {
      if (!dlg.matches(':popover-open')) dlg.showPopover();
    } else {
      dlg.setAttribute('open', 'open');
    }
  }

  _closePopover(dlg) {
    if (!dlg) return;
    if (typeof dlg.hidePopover === 'function') {
      if (dlg.matches(':popover-open')) dlg.hidePopover();
    } else {
      dlg.removeAttribute('open');
    }
  }

  _clearInertRegions() {
    const regions = [
      document.querySelector('.lab-header'),
      document.getElementById('module-rail'),
      document.getElementById('left-pane'),
      document.getElementById('right-pane'),
      document.getElementById('workspace-bottom-row'),
    ];
    regions.forEach((r) => {
      if (r) r.inert = false;
    });
  }

  _applyInertExceptTarget(targetEl) {
    this._clearInertRegions();
    if (this.mode !== 'guided' || !targetEl) return;
    const regions = [
      document.querySelector('.lab-header'),
      document.getElementById('module-rail'),
      document.getElementById('left-pane'),
      document.getElementById('right-pane'),
      document.getElementById('workspace-bottom-row'),
    ];
    regions.forEach((r) => {
      if (r && !r.contains(targetEl)) {
        r.inert = true;
      }
    });
  }

  _clearAnchorName() {
    if (this.activeAnchorEl) {
      this.activeAnchorEl.style.removeProperty('anchor-name');
      this.activeAnchorEl = null;
    }
  }

  _ensureSpotlightParts() {
    if (!this.spotlightEl) return false;
    if (this._scrimSvg && this._maskCutoutEl && this._ringEl && this.spotlightEl.childElementCount === 2) {
      return true;
    }
    this.spotlightEl.replaceChildren();
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('class', 'tour-scrim-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'none');

    const defs = document.createElementNS(svgNs, 'defs');
    const mask = document.createElementNS(svgNs, 'mask');
    mask.setAttribute('id', 'tour-spotlight-mask');

    const fullWhite = document.createElementNS(svgNs, 'rect');
    fullWhite.setAttribute('x', '0');
    fullWhite.setAttribute('y', '0');
    fullWhite.setAttribute('width', '100%');
    fullWhite.setAttribute('height', '100%');
    fullWhite.setAttribute('fill', 'white');

    const cutout = document.createElementNS(svgNs, 'rect');
    cutout.setAttribute('id', 'tour-mask-cutout');
    cutout.setAttribute('x', '0');
    cutout.setAttribute('y', '0');
    cutout.setAttribute('width', '0');
    cutout.setAttribute('height', '0');
    cutout.setAttribute('rx', '14');
    cutout.setAttribute('ry', '14');
    cutout.setAttribute('fill', 'black');

    mask.append(fullWhite, cutout);
    defs.appendChild(mask);

    const scrimFill = document.createElementNS(svgNs, 'rect');
    scrimFill.setAttribute('class', 'tour-scrim-fill');
    scrimFill.setAttribute('x', '0');
    scrimFill.setAttribute('y', '0');
    scrimFill.setAttribute('width', '100%');
    scrimFill.setAttribute('height', '100%');
    scrimFill.setAttribute('mask', 'url(#tour-spotlight-mask)');

    svg.append(defs, scrimFill);
    this.spotlightEl.appendChild(svg);
    this._scrimSvg = svg;
    this._maskCutoutEl = cutout;

    const ring = document.createElement('div');
    ring.className = 'tour-spotlight-ring';
    this.spotlightEl.appendChild(ring);
    this._ringEl = ring;
    return true;
  }

  _hideSpotlight() {
    if (this.spotlightEl) {
      this.spotlightEl.classList.add('is-hidden');
    }
  }

  _renderSpotlight(targetEl) {
    if (!this.spotlightEl || !targetEl) {
      this._hideSpotlight();
      return;
    }
    if (!this._ensureSpotlightParts()) return;

    const r = targetEl.getBoundingClientRect();
    const pad = 6;
    const top = Math.max(0, r.top - pad);
    const left = Math.max(0, r.left - pad);
    const right = Math.min(window.innerWidth, r.right + pad);
    const bottom = Math.min(window.innerHeight, r.bottom + pad);
    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);

    const rawRad = parseFloat(getComputedStyle(targetEl).borderRadius) || 8;
    const ringRadius = rawRad > 100 ? 999 : Math.max(10, Math.min(28, Math.round(rawRad + pad)));
    const maskRadius = rawRad > 100 ? Math.round(Math.min(w, h) / 2) : Math.min(ringRadius, Math.round(Math.min(w, h) / 2));

    this._maskCutoutEl.setAttribute('x', String(Math.round(left)));
    this._maskCutoutEl.setAttribute('y', String(Math.round(top)));
    this._maskCutoutEl.setAttribute('width', String(Math.round(w)));
    this._maskCutoutEl.setAttribute('height', String(Math.round(h)));
    this._maskCutoutEl.setAttribute('rx', String(maskRadius));
    this._maskCutoutEl.setAttribute('ry', String(maskRadius));

    this._ringEl.style.top = `${Math.round(top)}px`;
    this._ringEl.style.left = `${Math.round(left)}px`;
    this._ringEl.style.width = `${Math.round(w)}px`;
    this._ringEl.style.height = `${Math.round(h)}px`;
    this._ringEl.style.borderRadius = `${ringRadius}px`;
    this.spotlightEl.classList.remove('is-hidden');
  }

  showWelcome() {
    if (!this.data || !this.welcomeEl) return;
    const w = this.data.welcome;
    this.welcomeEl.replaceChildren();

    const topRow = document.createElement('div');
    topRow.className = 'tour-welcome-top';
    const mascot = createMascot({ pose: w.pose || 'wave', size: 68, label: w.heading });
    topRow.appendChild(mascot);

    const copy = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.id = 'tour-welcome-title';
    h2.textContent = w.heading;
    copy.appendChild(h2);
    (w.lines || []).forEach((line) => {
      const p = document.createElement('p');
      p.className = 'tour-welcome-body';
      appendRichText(p, line);
      copy.appendChild(p);
    });
    topRow.appendChild(copy);
    this.welcomeEl.appendChild(topRow);

    const actions = document.createElement('div');
    actions.className = 'tour-welcome-actions';
    const secBtn = document.createElement('button');
    secBtn.type = 'button';
    secBtn.className = 'btn-secondary';
    secBtn.id = 'btn-tour-explore';
    secBtn.textContent = w.secondaryLabel;
    secBtn.addEventListener('click', () => this.dismissWelcome(true));

    const priBtn = document.createElement('button');
    priBtn.type = 'button';
    priBtn.className = 'btn-primary';
    priBtn.id = 'btn-tour-start';
    priBtn.textContent = w.primaryLabel;
    priBtn.addEventListener('click', () => {
      this._closePopover(this.welcomeEl);
      this.startGuidedTour(true);
    });

    actions.append(secBtn, priBtn);
    this.welcomeEl.appendChild(actions);

    this._openPopover(this.welcomeEl);
    this._positionWelcome();
    priBtn.focus();
  }

  _positionWelcome() {
    if (!this.welcomeEl || !this.welcomeEl.matches(':popover-open')) return;
    if (window.innerWidth <= 900) {
      this.welcomeEl.style.removeProperty('left');
      this.welcomeEl.style.removeProperty('top');
      this.welcomeEl.style.removeProperty('right');
      this.welcomeEl.style.removeProperty('bottom');
      this.welcomeEl.style.removeProperty('margin');
      return;
    }
    const stage = document.getElementById('living-stage-card') || document.getElementById('left-pane');
    const rp = document.getElementById('right-pane');
    const sRect = isElementVisible(stage) ? stage.getBoundingClientRect() : null;
    const rpRect = isElementVisible(rp) ? rp.getBoundingClientRect() : null;
    const wRect = this.welcomeEl.getBoundingClientRect();
    const minTop = this._getProtectedTopBottom() + 10;
    const maxRight = rpRect ? rpRect.left - 12 : window.innerWidth - 12;
    const bw = Math.min(wRect.width || 440, Math.max(260, maxRight - 20));
    const bh = wRect.height || 220;
    const targetLeft = sRect ? sRect.left + (sRect.width - bw) / 2 : (maxRight - bw) / 2;
    const targetTop = sRect ? sRect.top + (sRect.height - bh) / 2 : (window.innerHeight - bh) / 2;
    const left = Math.max(12, Math.min(maxRight - bw, targetLeft));
    const top = Math.max(minTop, Math.min(window.innerHeight - bh - 12, targetTop));
    this.welcomeEl.style.left = `${Math.round(left)}px`;
    this.welcomeEl.style.top = `${Math.round(top)}px`;
    this.welcomeEl.style.right = 'auto';
    this.welcomeEl.style.bottom = 'auto';
    this.welcomeEl.style.margin = '0';
  }

  dismissWelcome(brieflyShowGuide) {
    this._closePopover(this.welcomeEl);
    this.markSeen();
    if (brieflyShowGuide) {
      this.openGuideMenu(true);
    }
  }

  startGuidedTour(focusBubble = true) {
    if (!this.data) return;
    this._clearHelpArrivalBeacon();
    this.onInterruptColdOpen();
    this.closeGuideMenu();
    this._closePopover(this.welcomeEl);
    this.lastMascotRect = null;

    if (window.innerWidth <= 900) {
      this.mode = 'mobile';
      this.mobileIndex = 0;
      this._renderMobileDeck();
      return;
    }

    this.mode = 'guided';
    this.stepIndex = 0;
    this.stepSatisfied = false;
    this._showGuidedStop(0, focusBubble);
  }

  _showGuidedStop(idx, focusFirstBtn = false) {
    this._clearDemoSwap(true);
    this._clearPulseTargets();
    const stops = this.data.stops || [];
    if (idx < 0 || idx >= stops.length) {
      this.endTour(false);
      return;
    }
    this.stepIndex = idx;
    const step = stops[idx];
    this.activeItem = step;
    this.stepSatisfied = !step.waitFor;
    this._ensureItemTab(step);

    if (this.activeMascotSvg) {
      this.lastMascotRect = this.activeMascotSvg.getBoundingClientRect();
    }

    const target = resolveTarget(step.targets);
    this.activeTarget = target;
    if (target) this.lastTarget = target;

    if (step.id === 'your-desk') {
      document.getElementById('nav-tab-evidence')?.classList.add('is-tour-pulse-target');
    }

    this._applyInertExceptTarget(target);
    this._renderSpotlight(target);
    this._renderBubble({
      heading: step.heading,
      body: step.body,
      pose: step.pose || 'idle',
      dir: step.dir || null,
      preferSide: step.preferSide || 'bottom',
      stepNum: idx + 1,
      totalSteps: stops.length,
      waitFor: step.waitFor,
      showBack: idx > 0,
      isLast: idx === stops.length - 1,
      showLoop: idx === stops.length - 1,
      isSingleCard: false,
      target,
      focusFirstBtn,
    });

    if (step.demoAction === 'swap-panels') {
      this._triggerDemoSwap();
    }
  }

  _renderBubble(opts) {
    if (!this.bubbleEl || !this.data) return;
    const ctrl = this.data.controls || {};
    this._clearAnchorName();
    this.bubbleEl.replaceChildren();
    this.bubbleEl.dataset.tourStep = this.activeItem ? this.activeItem.id : '';

    const perch = document.createElement('div');
    perch.className = 'tour-mascot-perch';
    const mascot = createMascot({
      pose: opts.pose,
      dir: opts.dir,
      size: 64,
      seated: true,
    });
    this.activeMascotSvg = mascot;
    perch.appendChild(mascot);
    this.bubbleEl.appendChild(perch);

    const head = document.createElement('div');
    head.className = 'tour-bubble-head';
    const h2 = document.createElement('h2');
    h2.id = 'tour-bubble-title';
    h2.textContent = opts.heading;
    head.appendChild(h2);

    if (!opts.isSingleCard && opts.totalSteps) {
      const cnt = document.createElement('span');
      cnt.className = 'tour-step-count tabular';
      cnt.textContent = String(ctrl.stepCounterTemplate || 'Step {current} of {total}')
        .replace('{current}', String(opts.stepNum))
        .replace('{total}', String(opts.totalSteps));
      head.appendChild(cnt);
    }
    this.bubbleEl.appendChild(head);

    const bodyP = document.createElement('p');
    bodyP.className = 'tour-bubble-body';
    appendRichText(bodyP, opts.body);
    this.bubbleEl.appendChild(bodyP);

    if (opts.showLoop && this.data.loopStripText) {
      const loopBox = document.createElement('div');
      loopBox.className = 'tour-loop-strip';
      loopBox.textContent = this.data.loopStripText;
      this.bubbleEl.appendChild(loopBox);

      if (this.data.finalLine) {
        const fin = document.createElement('p');
        fin.className = 'tour-final-line';
        appendRichText(fin, this.data.finalLine);
        this.bubbleEl.appendChild(fin);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'tour-actions';

    let firstFocusTarget = null;

    if (opts.isSingleCard) {
      const spacer = document.createElement('span');
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn-primary';
      closeBtn.id = 'btn-tour-dismiss';
      closeBtn.textContent = this.mode === 'tip' ? (ctrl.dismissLabel || 'Got it') : (ctrl.closeLabel || 'Close');
      closeBtn.addEventListener('click', () => this.endTour(false));
      actions.append(spacer, closeBtn);
      firstFocusTarget = closeBtn;
    } else {
      const skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.className = 'btn-text';
      skipBtn.id = 'btn-tour-skip';
      skipBtn.textContent = ctrl.skipLabel || 'Skip tour';
      skipBtn.addEventListener('click', () => this.endTour(true));

      const right = document.createElement('div');
      right.className = 'tour-actions-right';

      if (opts.waitFor && !this.stepSatisfied) {
        const waitPill = document.createElement('span');
        waitPill.className = 'tour-wait-pill';
        waitPill.id = 'tour-wait-pill';
        waitPill.textContent = ctrl.waitingLabel || 'Waiting for you\u2026';
        right.appendChild(waitPill);
      }

      if (opts.showBack) {
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'btn-secondary';
        backBtn.id = 'btn-tour-back';
        backBtn.textContent = ctrl.backLabel || 'Back';
        backBtn.addEventListener('click', () => this._showGuidedStop(this.stepIndex - 1, true));
        right.appendChild(backBtn);
        if (!firstFocusTarget) firstFocusTarget = backBtn;
      }

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'btn-primary';
      nextBtn.id = 'btn-tour-next';
      nextBtn.textContent = opts.isLast ? (ctrl.finishLabel || 'Start Module 1') : (ctrl.nextLabel || 'Next');
      nextBtn.addEventListener('click', () => {
        if (opts.isLast) this.endTour(false);
        else this._showGuidedStop(this.stepIndex + 1, true);
      });
      right.appendChild(nextBtn);
      firstFocusTarget = nextBtn;

      actions.append(skipBtn, right);
    }

    this.bubbleEl.appendChild(actions);
    this._openPopover(this.bubbleEl);
    this._placeBubble(opts.target, opts.preferSide || 'bottom');

    if (this.lastMascotRect && this.activeMascotSvg && this.mode === 'guided') {
      const toRect = this.activeMascotSvg.getBoundingClientRect();
      hopMascot(this.activeMascotSvg, this.lastMascotRect, toRect);
    }

    if (opts.focusFirstBtn && firstFocusTarget) {
      firstFocusTarget.focus();
    }
  }

  _getProtectedTopBottom() {
    let bottom = 0;
    const hdr = document.querySelector('.lab-header');
    if (isElementVisible(hdr)) bottom = Math.max(bottom, hdr.getBoundingClientRect().bottom);
    return bottom;
  }

  _getDemoSwapRightBoundary() {
    if (window.innerWidth <= 900) return window.innerWidth;
    if (!this.activeItem || this.activeItem.demoAction !== 'swap-panels') return window.innerWidth;
    return Math.min(Math.floor((window.innerWidth - 40) * 0.40) + 14, 412);
  }

  _getForbiddenRects() {
    const out = [];
    const rightPane = document.getElementById('right-pane');
    const termCol = document.getElementById('terminal-column');
    const hdr = document.querySelector('.lab-header');
    if (window.innerWidth > 900) {
      if (isElementVisible(hdr)) out.push(hdr.getBoundingClientRect());
      if (isElementVisible(termCol)) out.push(termCol.getBoundingClientRect());
      if (isElementVisible(rightPane)) out.push(rightPane.getBoundingClientRect());
      const demoBound = this._getDemoSwapRightBoundary();
      if (demoBound < window.innerWidth) {
        out.push({ left: demoBound, top: 0, right: window.innerWidth, bottom: window.innerHeight });
      }
    }
    const submitBar = document.getElementById('submit-bar');
    if (this.activeItem && this.activeItem.id === 'hand-it-in' && isElementVisible(submitBar)) {
      out.push(submitBar.getBoundingClientRect());
    }
    return out;
  }

  _getRightForbiddenLeft() {
    if (window.innerWidth <= 900) return window.innerWidth;
    let left = this._getDemoSwapRightBoundary();
    ['right-pane', 'terminal-column'].forEach((id) => {
      const node = document.getElementById(id);
      if (isElementVisible(node)) {
        const r = node.getBoundingClientRect();
        if (r.left > window.innerWidth * 0.25) left = Math.min(left, r.left);
      }
    });
    return left;
  }

  _bubbleUnionRect(left, top, width, height) {
    return {
      left,
      top: top - 58,
      right: left + width,
      bottom: top + height,
    };
  }

  _measuredUnionRect() {
    const bRect = this.bubbleEl.getBoundingClientRect();
    const mRect = this.activeMascotSvg ? this.activeMascotSvg.getBoundingClientRect() : null;
    if (!mRect) {
      return this._bubbleUnionRect(bRect.left, bRect.top, bRect.width, bRect.height);
    }
    return {
      left: Math.min(bRect.left, mRect.left),
      top: Math.min(bRect.top, mRect.top),
      right: Math.max(bRect.right, mRect.right),
      bottom: Math.max(bRect.bottom, mRect.bottom),
    };
  }

  _placeBubble(targetEl, preferSide) {
    if (!this.bubbleEl) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const forbidden = this._getForbiddenRects();
    const protectedTop = this._getProtectedTopBottom();
    const minTop = Math.max(protectedTop + 68, 128);
    const maxForbiddenLeft = this._getRightForbiddenLeft();
    const tRect = targetEl ? targetEl.getBoundingClientRect() : null;

    this.bubbleEl.style.removeProperty('left');
    this.bubbleEl.style.removeProperty('top');
    this.bubbleEl.style.removeProperty('right');
    this.bubbleEl.style.removeProperty('bottom');
    this.bubbleEl.style.removeProperty('margin');
    delete this.bubbleEl.dataset.anchorMode;

    if (supportsCssAnchor() && targetEl && preferSide === 'bottom') {
      targetEl.style.anchorName = '--tour-target';
      this.activeAnchorEl = targetEl;
      this.bubbleEl.dataset.anchorMode = 'css';
      const union = this._measuredUnionRect();
      const inBounds = union.left >= 8 && union.top >= protectedTop + 6 && union.right <= vw - 8 && union.bottom <= vh - 8;
      const hitsForbidden = forbidden.some((fr) => rectsOverlap(union, fr, 6));
      if (inBounds && !hitsForbidden) {
        this.bubbleEl.dataset.placementEngine = 'css-anchor';
        return;
      }
      this._clearAnchorName();
      delete this.bubbleEl.dataset.anchorMode;
    }

    this.bubbleEl.style.right = 'auto';
    this.bubbleEl.style.bottom = 'auto';
    this.bubbleEl.style.margin = '0';

    const bRect = this.bubbleEl.getBoundingClientRect();
    const bw = Math.min(bRect.width || 352, vw - 16);
    const bh = bRect.height || 180;
    const gap = 14;
    const topSafe = minTop;

    const candidates = [];
    if (tRect) {
      const order = [];
      [preferSide, 'bottom', 'top', 'left', 'right'].forEach((s) => {
        if (s && !order.includes(s)) order.push(s);
      });
      order.forEach((side) => {
        let x = 12;
        let y = topSafe;
        if (side === 'bottom') {
          x = Math.max(10, Math.min(maxForbiddenLeft - bw - 12, tRect.left + tRect.width / 2 - bw / 2));
          y = Math.max(topSafe, tRect.bottom + gap);
        } else if (side === 'top') {
          x = Math.max(10, Math.min(maxForbiddenLeft - bw - 12, tRect.left + tRect.width / 2 - bw / 2));
          y = Math.max(topSafe, tRect.top - bh - gap);
        } else if (side === 'left') {
          x = Math.min(tRect.left - bw - gap, maxForbiddenLeft - bw - 12);
          y = Math.max(topSafe, Math.min(vh - bh - 12, tRect.top + tRect.height / 2 - bh / 2));
        } else if (side === 'right') {
          x = tRect.right + gap;
          y = Math.max(topSafe, Math.min(vh - bh - 12, tRect.top + tRect.height / 2 - bh / 2));
        }
        candidates.push({ x, y, side });
      });
    }

    let chosen = null;
    for (const c of candidates) {
      const u = this._bubbleUnionRect(c.x, c.y, bw, bh);
      const inBounds = u.left >= 8 && u.top >= protectedTop + 6 && u.right <= vw - 8 && u.bottom <= vh - 8;
      const hitsForbidden = forbidden.some((fr) => rectsOverlap(u, fr, 8));
      const hitsTarget = tRect ? rectsOverlap({ left: c.x, top: c.y, right: c.x + bw, bottom: c.y + bh }, tRect, 2) : false;
      if (inBounds && !hitsForbidden && !hitsTarget) {
        chosen = c;
        break;
      }
    }

    if (!chosen) {
      const stage = document.getElementById('living-stage-card');
      const sRect = isElementVisible(stage) ? stage.getBoundingClientRect() : null;
      const maxRight = maxForbiddenLeft - 12;
      const safeX = sRect
        ? Math.max(10, Math.min(maxRight - bw, sRect.left + 14))
        : Math.max(10, maxRight - bw);
      const safeY = sRect
        ? Math.max(topSafe, Math.min(vh - bh - 12, sRect.bottom - bh - 12))
        : Math.max(topSafe, vh - bh - 12);
      chosen = { x: Math.max(8, safeX), y: Math.max(topSafe, safeY), side: 'scene-bottom' };
    }

    this.bubbleEl.style.left = `${Math.round(chosen.x)}px`;
    this.bubbleEl.style.top = `${Math.round(chosen.y)}px`;
    this.bubbleEl.dataset.placementEngine = 'js-rect';
    this.bubbleEl.dataset.placedSide = chosen.side;
  }

  _repositionActive() {
    if (this.welcomeEl && this.welcomeEl.matches(':popover-open')) {
      this._positionWelcome();
    }
    if (!this.mode || this.mode === 'mobile' || !this.activeItem) return;
    if (window.innerWidth <= 900 && this.mode === 'guided') {
      this._clearDemoSwap(true);
      this._clearInertRegions();
      this._hideSpotlight();
      this._closePopover(this.bubbleEl);
      this.mode = 'mobile';
      this._renderMobileDeck();
      return;
    }
    const target = resolveTarget(this.activeItem.targets);
    this.activeTarget = target;
    this._renderSpotlight(target);
    this._placeBubble(target, this.activeItem.preferSide || 'bottom');
  }

  notifyEvent(eventName) {
    if (!this.data) return;
    if (this.mode === 'guided' && this.activeItem && this.activeItem.waitFor === eventName && !this.stepSatisfied) {
      this.stepSatisfied = true;
      const pill = document.getElementById('tour-wait-pill');
      if (pill) pill.remove();
      if (this.activeMascotSvg) {
        const nextPose = this.activeItem.completePose || 'nod';
        setMascotPose(this.activeMascotSvg, nextPose);
      }
      return;
    }

    if (!this.mode) {
      this.maybeShowTip(eventName);
    }
  }

  maybeShowTip(triggerName) {
    if (!this.data || this.mode || window.innerWidth <= 900) return;
    const tip = (this.data.tips || []).find((t) => t.trigger === triggerName);
    if (!tip || this.stored.tipsSeen[tip.id]) return;

    if (this.isStoryOverlayActive()) {
      if (!this.pendingTips.includes(triggerName)) {
        this.pendingTips.push(triggerName);
      }
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => this._showTipNow(triggerName));
    });
  }

  flushPendingTips() {
    if (this._tipTimer) {
      clearTimeout(this._tipTimer);
      this._tipTimer = null;
    }
    if (!this.pendingTips.length) return;
    this._tipTimer = setTimeout(() => {
      this._tipTimer = null;
      if (this.mode || this.isStoryOverlayActive() || !this.pendingTips.length) return;
      const next = this.pendingTips.shift();
      this._showTipNow(next);
    }, 240);
  }

  _showTipNow(triggerName) {
    if (!this.data || this.mode || this.isStoryOverlayActive() || window.innerWidth <= 900) return;
    const tip = (this.data.tips || []).find((t) => t.trigger === triggerName);
    if (!tip || this.stored.tipsSeen[tip.id]) return;

    this._ensureItemTab(tip);
    const target = resolveTarget(tip.targets);
    if (!target) return;

    this.stored.tipsSeen[tip.id] = true;
    this._persistPrefs();
    this.mode = 'tip';
    this.activeItem = tip;
    this.activeTarget = target;
    this.lastTarget = target;
    this._renderSpotlight(target);
    this._renderBubble({
      heading: tip.heading,
      body: tip.body,
      pose: tip.pose || 'think',
      dir: tip.dir || null,
      preferSide: tip.preferSide || 'bottom',
      isSingleCard: true,
      target,
      focusFirstBtn: true,
    });
  }

  _buildGuideMenu() {
    if (!this.guideMenuEl || !this.data) return;
    const ctrl = this.data.controls || {};
    this.guideMenuEl.replaceChildren();

    const head = document.createElement('div');
    head.className = 'guide-menu-head';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'guide-menu-title-wrap';
    titleWrap.appendChild(createMascot({ pose: 'wave', size: 42 }));
    const h2 = document.createElement('h2');
    h2.id = 'guide-menu-title';
    h2.textContent = ctrl.guideHeading || 'How do I\u2026';
    titleWrap.appendChild(h2);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-mini';
    closeBtn.textContent = ctrl.closeLabel || 'Close';
    closeBtn.addEventListener('click', () => this.closeGuideMenu());
    head.append(titleWrap, closeBtn);
    this.guideMenuEl.appendChild(head);

    const replayRow = document.createElement('div');
    replayRow.className = 'guide-replay-row';

    const btnGloss = document.createElement('button');
    btnGloss.type = 'button';
    btnGloss.className = 'btn-secondary';
    btnGloss.id = 'btn-guide-open-glossary';
    btnGloss.textContent = ctrl.glossaryLabel || 'Glossary';
    btnGloss.addEventListener('click', () => {
      this.closeGuideMenu();
      this.onOpenGlossary();
    });

    const btnCold = document.createElement('button');
    btnCold.type = 'button';
    btnCold.className = 'btn-secondary';
    btnCold.id = 'btn-guide-replay-cold';
    btnCold.textContent = ctrl.replayColdOpenLabel || 'Replay opening';
    btnCold.addEventListener('click', () => {
      this.closeGuideMenu();
      this.onReplayColdOpen();
    });

    const btnTour = document.createElement('button');
    btnTour.type = 'button';
    btnTour.className = 'btn-primary';
    btnTour.id = 'btn-guide-replay-tour';
    btnTour.textContent = ctrl.replayTourLabel || 'Replay tour';
    btnTour.addEventListener('click', () => {
      this.closeGuideMenu();
      this.startGuidedTour(true);
    });
    replayRow.append(btnGloss, btnCold, btnTour);
    this.guideMenuEl.appendChild(replayRow);

    const ul = document.createElement('ul');
    ul.className = 'guide-list';
    (this.data.guideItems || []).forEach((item) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'guide-item-btn';
      btn.dataset.guideId = item.id;
      btn.textContent = item.question;
      btn.addEventListener('click', () => this._runGuideItem(item));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    this.guideMenuEl.appendChild(ul);
  }

  _runGuideItem(item) {
    this.closeGuideMenu();
    this._ensureItemTab(item);
    const target = resolveTarget(item.targets);
    this.mode = 'guide-item';
    this.activeItem = item;
    this.activeTarget = target;
    if (target) this.lastTarget = target;
    this._renderSpotlight(target);
    this._renderBubble({
      heading: item.question,
      body: item.body,
      pose: item.pose || 'point',
      dir: item.dir || null,
      preferSide: item.preferSide || 'bottom',
      isSingleCard: true,
      target,
      focusFirstBtn: true,
    });
  }

  openGuideMenu(autoCloseBriefly = false) {
    if (!this.guideMenuEl) return;
    if (this.guideAutoCloseTimer) {
      clearTimeout(this.guideAutoCloseTimer);
      this.guideAutoCloseTimer = null;
    }
    this._openPopover(this.guideMenuEl);
    if (this.guideBtnEl) this.guideBtnEl.setAttribute('aria-expanded', 'true');
    if (autoCloseBriefly) {
      this.guideAutoCloseTimer = setTimeout(() => {
        this.guideAutoCloseTimer = null;
        this.closeGuideMenu();
      }, 2200);
    } else {
      const firstBtn = this.guideMenuEl.querySelector('button');
      if (firstBtn) firstBtn.focus();
    }
  }

  closeGuideMenu() {
    if (this.guideAutoCloseTimer) {
      clearTimeout(this.guideAutoCloseTimer);
      this.guideAutoCloseTimer = null;
    }
    this._closePopover(this.guideMenuEl);
    if (this.guideBtnEl) this.guideBtnEl.setAttribute('aria-expanded', 'false');
  }

  _renderMobileDeck() {
    if (!this.mobileDeckEl || !this.data) return;
    const cards = this.data.mobileCards || [];
    const ctrl = this.data.controls || {};
    this.mobileDeckEl.replaceChildren();

    const track = document.createElement('div');
    track.className = 'tour-mobile-track';
    track.id = 'tour-mobile-track';

    cards.forEach((c) => {
      const art = document.createElement('article');
      art.className = 'tour-mobile-card';
      const head = document.createElement('div');
      head.className = 'tour-mobile-head';
      head.appendChild(createMascot({ pose: c.pose || 'idle', size: 54 }));
      const h2 = document.createElement('h2');
      h2.textContent = c.heading;
      head.appendChild(h2);
      art.appendChild(head);

      const p = document.createElement('p');
      p.className = 'tour-bubble-body';
      appendRichText(p, c.body);
      art.appendChild(p);

      if (c.showLoop && this.data.loopStripText) {
        const lp = document.createElement('div');
        lp.className = 'tour-loop-strip';
        lp.textContent = this.data.loopStripText;
        art.appendChild(lp);
      }
      track.appendChild(art);
    });

    const foot = document.createElement('div');
    foot.className = 'tour-mobile-foot';

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'btn-text';
    skipBtn.textContent = ctrl.skipLabel || 'Skip tour';
    skipBtn.addEventListener('click', () => this.endTour(true));

    const dots = document.createElement('div');
    dots.className = 'tour-mobile-dots';
    cards.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = `tour-mobile-dot ${i === this.mobileIndex ? 'is-active' : ''}`;
      dots.appendChild(d);
    });

    const nav = document.createElement('div');
    nav.className = 'tour-actions-right';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn-primary';
    nextBtn.id = 'btn-tour-mobile-next';
    nextBtn.textContent = this.mobileIndex >= cards.length - 1 ? (ctrl.finishLabel || 'Start Module 1') : (ctrl.nextLabel || 'Next');
    nextBtn.addEventListener('click', () => {
      if (this.mobileIndex >= cards.length - 1) {
        this.endTour(false);
      } else {
        this.mobileIndex += 1;
        track.scrollTo({ left: track.clientWidth * this.mobileIndex, behavior: isReducedMotion() ? 'auto' : 'smooth' });
        Array.from(dots.children).forEach((el, i) => el.classList.toggle('is-active', i === this.mobileIndex));
        nextBtn.textContent = this.mobileIndex >= cards.length - 1 ? (ctrl.finishLabel || 'Start Module 1') : (ctrl.nextLabel || 'Next');
      }
    });

    track.addEventListener('scroll', () => {
      const idx = Math.max(0, Math.min(cards.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
      this.mobileIndex = idx;
      Array.from(dots.children).forEach((el, i) => el.classList.toggle('is-active', i === idx));
      nextBtn.textContent = idx >= cards.length - 1 ? (ctrl.finishLabel || 'Start Module 1') : (ctrl.nextLabel || 'Next');
    }, { passive: true });

    nav.appendChild(nextBtn);
    foot.append(skipBtn, dots, nav);
    this.mobileDeckEl.append(track, foot);
    this.mobileDeckEl.classList.remove('is-hidden');
    nextBtn.focus();
  }

  endTour(skipped) {
    this._clearDemoSwap(true);
    this._clearPulseTargets();
    const wasGuided = this.mode === 'guided' || this.mode === 'mobile';
    const shouldGlideDock = this.mode === 'guided' && !skipped && this.activeMascotSvg;
    const mascotFromRect = shouldGlideDock ? this.activeMascotSvg.getBoundingClientRect() : null;

    this.mode = null;
    this.activeItem = null;
    this.activeMascotSvg = null;
    this.lastMascotRect = null;
    this._clearInertRegions();
    this._clearAnchorName();
    this._hideSpotlight();
    this._closePopover(this.bubbleEl);
    if (this.mobileDeckEl) {
      this.mobileDeckEl.classList.add('is-hidden');
      this.mobileDeckEl.replaceChildren();
    }
    if (wasGuided || skipped) {
      this.markSeen();
    }
    if (shouldGlideDock) {
      this._animateMascotToDock(mascotFromRect);
    }
    if (this.lastTarget) {
      const sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusable = this.lastTarget.matches(sel)
        ? this.lastTarget
        : this.lastTarget.querySelector(sel);
      const focusEl = focusable || this.lastTarget;
      if (!focusable && !focusEl.hasAttribute('tabindex')) {
        focusEl.setAttribute('tabindex', '-1');
      }
      if (typeof focusEl.focus === 'function') {
        try {
          focusEl.focus();
        } catch {
        }
      }
    }
  }
}
