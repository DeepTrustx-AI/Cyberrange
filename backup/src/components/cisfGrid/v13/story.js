import { createMascot, isReducedMotion } from './mascot.js';

const STORAGE_STORY = 'cg-story-v1';

const CINEMA_DISTRICTS = [
  { key: 'hospital', name: 'District Trauma Hospital', offLabel: 'Backup diesel', hasDiesel: true },
  { key: 'water', name: 'Suryanagar Water Works', offLabel: 'Pumps stopped', hasDiesel: false },
  { key: 'metro', name: 'Metro Rail Traction', offLabel: 'No power', hasDiesel: false },
  { key: 'airport', name: 'Airport Runway Lighting', offLabel: 'No power', hasDiesel: false },
  { key: 'industrial', name: 'Industrial Estate', offLabel: 'No power', hasDiesel: false },
  { key: 'municipal', name: 'Municipal Street Grid', offLabel: 'No power', hasDiesel: false },
];

const CINEMA_SCENES = [
  { id: 'beat-1', startMs: 0, endMs: 4200, clock: '21:39:52 IST · Suryanagar 220/132/33 kV' },
  { id: 'beat-2', startMs: 4200, endMs: 8800, clock: '21:40:00 IST · Suryanagar 220/132/33 kV' },
  { id: 'beat-3', startMs: 8800, endMs: 14500, clock: '21:40:10 IST · Suryanagar 220/132/33 kV' },
  { id: 'beat-4', startMs: 14500, endMs: 14500, clock: '21:40:15 IST · Incoming Dispatch' },
];

function readStoryStorage(storageKey = STORAGE_STORY) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { actsSeen: {}, openersShown: {} };
    const p = JSON.parse(raw);
    return {
      actsSeen: p.actsSeen && typeof p.actsSeen === 'object' ? p.actsSeen : {},
      openersShown: p.openersShown && typeof p.openersShown === 'object' ? p.openersShown : {},
    };
  } catch {
    return { actsSeen: {}, openersShown: {} };
  }
}

function writeStoryStorage(storageKey, obj) {
  try {
    localStorage.setItem(storageKey || STORAGE_STORY, JSON.stringify(obj));
  } catch {
  }
}

function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

export class StoryController {
  constructor({
    apiJson,
    storageKey = STORAGE_STORY,
    storyData = null,
    loadStoryData = null,
    assetBase = './assets',
    setSceneView,
    getBlindedInsetRows,
    getWelcomeCopy,
    onCinemaStartTour,
    onCinemaExplore,
    onColdOpenFinished,
    onColdOpenVisibilityChange,
    onActCardHidden,
    onCasesUpdated,
    onHintsHydrated,
    onTabCase,
  }) {
    this.data = storyData || null;
    this.loadStoryData = loadStoryData || null;
    this.storageKey = storageKey || STORAGE_STORY;
    this.assetBase = String(assetBase || './assets').replace(/\/+$/, '');
    this.stored = readStoryStorage(this.storageKey);
    this.apiJson = apiJson;
    this.setSceneView = setSceneView || (() => {});
    this.getBlindedInsetRows = getBlindedInsetRows || (() => [
      ['33 kV Bus', 'Nominal'],
      ['Reported feeders', 'Closed · Normal'],
      ['Active alarms', '0 reported'],
    ]);
    this.getWelcomeCopy = getWelcomeCopy || (() => null);
    this.onCinemaStartTour = onCinemaStartTour || (() => {});
    this.onCinemaExplore = onCinemaExplore || (() => {});
    this.onColdOpenFinished = onColdOpenFinished || (() => {});
    this.onColdOpenVisibilityChange = onColdOpenVisibilityChange || (() => {});
    this.onActCardHidden = onActCardHidden || (() => {});
    this.onCasesUpdated = onCasesUpdated || (() => {});
    this.onHintsHydrated = onHintsHydrated || (() => {});
    this.onTabCase = onTabCase || (() => {});

    this.coldOpenActive = false;
    this.cinemaMounted = false;
    this.cinemaPaused = false;
    this.cinemaReduced = false;
    this.cinemaRaf = null;
    this.cinemaElapsedMs = 0;
    this.cinemaLastTick = 0;
    this.cinemaSceneIdx = -1;
    this.cinemaFrameCount = 0;
    this.cinemaFadeTimer = null;

    this.cinemaClockEl = null;
    this.cinemaHeadlineEl = null;
    this.cinemaSublineEl = null;
    this.cinemaPauseBtn = null;
    this.cinemaNextBtn = null;
    this.cinemaSkipBtn = null;
    this.cinemaSegFills = [];
    this.cinemaDistCards = {};
    this.cinemaHmiRowsEl = null;
    this.cinemaDispatchBriefEl = null;
    this.cinemaQuoteEl = null;
    this.cinemaStartBtn = null;
    this.cinemaExploreBtn = null;

    this.actTimer = null;
    this.knownPassedIds = new Set();
    this.cases = {};
    this.shiftReport = null;

    this.cinemaEl = document.getElementById('cinema-intro');
    this.actCardEl = document.getElementById('act-card-layer');
    this.stakesEl = document.getElementById('stakes-strip');
    this.missionBannerEl = document.getElementById('mission-story-banner');
    this.closerEl = document.getElementById('closer-debrief-card');
    this.caseChainEl = document.getElementById('case-board-chain');
    this.caseCountEl = document.getElementById('case-count');
    this.navCaseProgressEl = document.getElementById('nav-case-progress');
    this.shiftHostEl = document.getElementById('shift-report-host');

    this._keyBound = (e) => {
      if (this.coldOpenActive && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.finishColdOpen(false, 'skip');
      } else if (this.actCardEl && !this.actCardEl.classList.contains('is-hidden') && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.hideActCard();
      }
    };
  }

  async init() {
    if (!this.data) {
      try {
        if (typeof this.loadStoryData === 'function') {
          this.data = await this.loadStoryData();
        } /* platform provides storyData statically */
      } catch {
      }
    }
    if (!this.data) return false;

    document.addEventListener('keydown', this._keyBound);
    this.renderCaseBoard();
    return true;
  }

  dispose() {
    document.removeEventListener('keydown', this._keyBound);
    if (this.cinemaRaf) {
      cancelAnimationFrame(this.cinemaRaf);
      this.cinemaRaf = null;
    }
    if (this.cinemaFadeTimer) {
      clearTimeout(this.cinemaFadeTimer);
      this.cinemaFadeTimer = null;
    }
    if (this.actTimer) {
      clearTimeout(this.actTimer);
      this.actTimer = null;
    }
    this.coldOpenActive = false;
    delete document.documentElement.dataset.shiftReport;
  }

  getModuleShortTitle(contractModId) {
    return this.data?.modules?.[contractModId]?.cardTitle || null;
  }

  _ensureCinemaMounted() {
    if (this.cinemaMounted || !this.cinemaEl) return;
    this.cinemaMounted = true;
    this.cinemaEl.replaceChildren();

    const top = document.createElement('div');
    top.className = 'cinema-top';

    const clock = document.createElement('span');
    clock.className = 'cinema-clock tabular';
    clock.id = 'cinema-clock';
    clock.textContent = CINEMA_SCENES[0].clock;
    this.cinemaClockEl = clock;

    const progress = document.createElement('div');
    progress.className = 'cinema-progress';
    progress.setAttribute('role', 'group');
    progress.setAttribute('aria-label', 'Introduction scenes');
    this.cinemaSegFills = [];
    CINEMA_SCENES.forEach((sc, idx) => {
      const seg = document.createElement('button');
      seg.type = 'button';
      seg.className = 'cinema-seg';
      seg.dataset.cinemaScene = String(idx);
      seg.setAttribute('aria-label', `Scene ${idx + 1} of 4`);
      const fill = document.createElement('span');
      fill.className = 'cinema-seg-fill';
      seg.appendChild(fill);
      seg.addEventListener('click', () => this._jumpToCinemaScene(idx));
      this.cinemaSegFills.push(fill);
      progress.appendChild(seg);
    });

    const controls = document.createElement('div');
    controls.className = 'cinema-controls';

    const pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.className = 'cinema-btn';
    pauseBtn.id = 'btn-cinema-pause';
    pauseBtn.setAttribute('aria-pressed', 'false');
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => this._toggleCinemaPause());
    this.cinemaPauseBtn = pauseBtn;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'cinema-btn is-hidden';
    nextBtn.id = 'btn-cold-open-next';
    nextBtn.textContent = 'Next frame';
    nextBtn.addEventListener('click', () => {
      const next = Math.min(CINEMA_SCENES.length - 1, this.cinemaSceneIdx + 1);
      this._jumpToCinemaScene(next);
    });
    this.cinemaNextBtn = nextBtn;

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'cinema-btn';
    skipBtn.id = 'btn-cold-open-skip';
    skipBtn.textContent = 'Skip intro';
    skipBtn.addEventListener('click', () => this.finishColdOpen(false, 'skip'));
    this.cinemaSkipBtn = skipBtn;

    controls.append(pauseBtn, nextBtn, skipBtn);
    top.append(clock, progress, controls);

    const stage = document.createElement('div');
    stage.className = 'cinema-stage';

    const cityPanel = document.createElement('div');
    cityPanel.className = 'cinema-city-panel';
    this.cinemaDistCards = {};
    CINEMA_DISTRICTS.forEach((d) => {
      const card = document.createElement('div');
      card.className = 'cinema-district-card is-lit';
      card.dataset.dist = d.key;

      const plinth = document.createElement('div');
      plinth.className = 'cinema-plinth-glow';
      plinth.setAttribute('aria-hidden', 'true');

      const stack = document.createElement('div');
      stack.className = 'cinema-img-stack';

      const darkImg = document.createElement('img');
      darkImg.className = 'c-img c-img-dark';
      darkImg.src = `${this.assetBase}/${d.key}-dark-dark.webp`;
      darkImg.alt = '';
      darkImg.decoding = 'async';

      const litImg = document.createElement('img');
      litImg.className = 'c-img c-img-lit';
      litImg.src = `${this.assetBase}/${d.key}-lit-dark.webp`;
      litImg.alt = '';
      litImg.decoding = 'async';

      stack.append(darkImg, litImg);

      if (d.hasDiesel) {
        const dieselImg = document.createElement('img');
        dieselImg.className = 'c-img c-img-diesel';
        dieselImg.src = `${this.assetBase}/hospital-diesel-dark.webp`;
        dieselImg.alt = '';
        dieselImg.decoding = 'async';
        stack.appendChild(dieselImg);
      }

      const meta = document.createElement('div');
      meta.className = 'cinema-dist-meta';
      const nm = document.createElement('span');
      nm.className = 'cinema-dist-name';
      nm.textContent = d.name;
      const st = document.createElement('span');
      st.className = 'cinema-dist-status';
      st.textContent = 'Energized';
      meta.append(nm, st);

      card.append(plinth, stack, meta);
      cityPanel.appendChild(card);
      this.cinemaDistCards[d.key] = { card, statusEl: st, offLabel: d.offLabel };
    });

    const comparePanel = document.createElement('div');
    comparePanel.className = 'cinema-compare-panel';

    const fieldCard = document.createElement('div');
    fieldCard.className = 'cinema-compare-card is-field';
    const fieldKicker = document.createElement('div');
    fieldKicker.className = 'cinema-compare-kicker';
    fieldKicker.textContent = 'Outside · City & switchyard';
    const fieldTitle = document.createElement('h3');
    fieldTitle.className = 'cinema-compare-title';
    fieldTitle.textContent = 'Three feeders offline';
    const fieldRows = document.createElement('div');
    fieldRows.className = 'cinema-compare-rows';
    [
      { img: `${this.assetBase}/hospital-diesel-dark.webp`, name: 'District Trauma Hospital', val: 'Backup diesel', cls: 'is-amber' },
      { img: `${this.assetBase}/water-dark-dark.webp`, name: 'Suryanagar Water Works', val: 'Pumps stopped', cls: 'is-rose' },
      { img: `${this.assetBase}/industrial-dark-dark.webp`, name: 'Industrial Estate', val: 'No power', cls: 'is-rose' },
    ].forEach((r) => {
      const row = document.createElement('div');
      row.className = 'cinema-compare-row';
      const left = document.createElement('div');
      left.className = 'cinema-compare-row-left';
      const thumb = document.createElement('img');
      thumb.className = 'cinema-mini-thumb';
      thumb.src = r.img;
      thumb.alt = '';
      thumb.decoding = 'async';
      const k = document.createElement('span');
      k.className = 'cinema-compare-k';
      k.textContent = r.name;
      left.append(thumb, k);
      const v = document.createElement('span');
      v.className = `cinema-compare-v ${r.cls}`;
      v.textContent = r.val;
      row.append(left, v);
      fieldRows.appendChild(row);
    });
    fieldCard.append(fieldKicker, fieldTitle, fieldRows);

    const hmiCard = document.createElement('div');
    hmiCard.className = 'cinema-compare-card is-hmi';
    const hmiKicker = document.createElement('div');
    hmiKicker.className = 'cinema-compare-kicker';
    hmiKicker.textContent = 'Inside · Control room screen';
    const hmiTitle = document.createElement('h3');
    hmiTitle.className = 'cinema-compare-title';
    hmiTitle.textContent = 'Reports all nominal';
    const hmiRows = document.createElement('div');
    hmiRows.className = 'cinema-compare-rows';
    this.cinemaHmiRowsEl = hmiRows;
    hmiCard.append(hmiKicker, hmiTitle, hmiRows);

    comparePanel.append(fieldCard, hmiCard);

    const dispatchPanel = document.createElement('div');
    dispatchPanel.className = 'cinema-dispatch-panel';
    const dispatchCard = document.createElement('div');
    dispatchCard.className = 'cinema-dispatch-card';

    const dTop = document.createElement('div');
    dTop.className = 'cinema-dispatch-top';
    const dWho = document.createElement('div');
    dWho.className = 'cinema-dispatch-who';
    const chipWrap = document.createElement('div');
    chipWrap.className = 'cinema-call-ring';
    const chip = document.createElement('span');
    chip.className = 'monogram-chip';
    chip.textContent = 'RM';
    chipWrap.appendChild(chip);

    const whoText = document.createElement('div');
    const dBadge = document.createElement('span');
    dBadge.className = 'cinema-dispatch-badge';
    dBadge.textContent = 'Incoming dispatch · 21:40:15 IST';
    const dName = document.createElement('h2');
    dName.className = 'cinema-dispatch-name';
    dName.textContent = 'Raghav Menon';
    const dRole = document.createElement('div');
    dRole.className = 'cinema-dispatch-role';
    dRole.textContent = 'Shift Charge Engineer, SN-220-MAIN';
    whoText.append(dBadge, dName, dRole);
    dWho.append(chipWrap, whoText);

    const mascotDisc = document.createElement('div');
    mascotDisc.className = 'cinema-mascot-disc';
    mascotDisc.appendChild(createMascot({ pose: 'phone', size: 68 }));
    dTop.append(dWho, mascotDisc);

    const quote = document.createElement('blockquote');
    quote.className = 'cinema-dispatch-quote';
    this.cinemaQuoteEl = quote;

    const briefing = document.createElement('div');
    briefing.className = 'cinema-dispatch-briefing';
    this.cinemaDispatchBriefEl = briefing;

    const actions = document.createElement('div');
    actions.className = 'cinema-dispatch-actions';
    const exploreBtn = document.createElement('button');
    exploreBtn.type = 'button';
    exploreBtn.className = 'cinema-btn';
    exploreBtn.id = 'btn-cinema-explore';
    exploreBtn.textContent = "I'll explore on my own";
    exploreBtn.addEventListener('click', () => this.finishColdOpen(false, 'explore'));
    this.cinemaExploreBtn = exploreBtn;

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'cinema-btn-primary';
    startBtn.id = 'btn-cinema-start';
    startBtn.textContent = 'Show me around';
    startBtn.addEventListener('click', () => this.finishColdOpen(false, 'tour'));
    this.cinemaStartBtn = startBtn;

    actions.append(exploreBtn, startBtn);
    dispatchCard.append(dTop, quote, briefing, actions);
    dispatchPanel.appendChild(dispatchCard);

    stage.append(cityPanel, comparePanel, dispatchPanel);

    const caption = document.createElement('div');
    caption.className = 'cinema-caption';
    const headline = document.createElement('h2');
    headline.className = 'cinema-headline';
    headline.id = 'cinema-headline';
    const subline = document.createElement('p');
    subline.className = 'cinema-subline';
    subline.id = 'cinema-subline';
    this.cinemaHeadlineEl = headline;
    this.cinemaSublineEl = subline;
    caption.append(headline, subline);

    this.cinemaEl.append(top, stage, caption);
  }

  _populateCinemaCopy() {
    const beats = (this.data && this.data.coldOpen && this.data.coldOpen.beats) || [];
    const beat5 = beats[4] || {};
    if (this.cinemaQuoteEl) {
      const raw = String(beat5.line || '"My screens say normal, and the city is dark. I need you here."');
      this.cinemaQuoteEl.textContent = raw.replace(/^Raghav Menon:\s*/, '');
    }

    if (this.cinemaDispatchBriefEl) {
      this.cinemaDispatchBriefEl.replaceChildren();
      const welcome = this.getWelcomeCopy();
      const lines = [
        'You are the engineer on call tonight. Find out why the screens are lying, lock out the intruder, and bring the city back safely.',
      ];
      lines.forEach((txt) => {
        const p = document.createElement('p');
        p.textContent = txt;
        this.cinemaDispatchBriefEl.appendChild(p);
      });
      if (welcome && welcome.primaryLabel && this.cinemaStartBtn) {
        this.cinemaStartBtn.textContent = welcome.primaryLabel;
      }
      if (welcome && welcome.secondaryLabel && this.cinemaExploreBtn) {
        this.cinemaExploreBtn.textContent = welcome.secondaryLabel;
      }
    }
  }

  _refreshCinemaHmiRows() {
    if (!this.cinemaHmiRowsEl) return;
    this.cinemaHmiRowsEl.replaceChildren();
    const rows = this.getBlindedInsetRows();
    rows.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'cinema-compare-row';
      const kEl = document.createElement('span');
      kEl.className = 'cinema-compare-k';
      kEl.textContent = k;
      const vEl = document.createElement('span');
      vEl.className = 'cinema-compare-v is-mint tabular';
      vEl.textContent = v;
      row.append(kEl, vEl);
      this.cinemaHmiRowsEl.appendChild(row);
    });
  }

  _applyCinemaScene(idx) {
    const clamped = Math.max(0, Math.min(CINEMA_SCENES.length - 1, idx));
    const scene = CINEMA_SCENES[clamped];
    this.cinemaSceneIdx = clamped;
    if (!this.cinemaEl) return;

    this.cinemaEl.dataset.beat = scene.id;
    if (this.cinemaClockEl) this.cinemaClockEl.textContent = scene.clock;

    const beats = (this.data && this.data.coldOpen && this.data.coldOpen.beats) || [];
    const b1 = beats[0]?.line || 'Suryanagar. A Wednesday night.';
    const b2 = beats[1]?.line || '21:40. Three feeders drop.';
    const b3 = beats[2]?.line || 'The control room sees nothing wrong.';
    const b4 = beats[3]?.line || 'The hospital is on diesel. The screens say all is well.';

    if (clamped === 0) {
      if (this.cinemaHeadlineEl) this.cinemaHeadlineEl.textContent = b1;
      if (this.cinemaSublineEl) this.cinemaSublineEl.textContent = 'One substation powers the trauma hospital, city water pumps, metro rail, and airport runway.';
      CINEMA_DISTRICTS.forEach((d) => this._setCinemaDistrictState(d.key, 'lit'));
    } else if (clamped === 1) {
      if (this.cinemaHeadlineEl) this.cinemaHeadlineEl.textContent = b2;
      if (this.cinemaSublineEl) this.cinemaSublineEl.textContent = 'The hospital falls back to emergency diesel. City water pumps stop. Three districts go dark.';
      this._setCinemaDistrictState('hospital', 'diesel');
      this._setCinemaDistrictState('water', 'dark');
      this._setCinemaDistrictState('industrial', 'dark');
      this._setCinemaDistrictState('metro', 'lit');
      this._setCinemaDistrictState('airport', 'lit');
      this._setCinemaDistrictState('municipal', 'lit');
    } else if (clamped === 2) {
      if (this.cinemaHeadlineEl) this.cinemaHeadlineEl.textContent = b3;
      if (this.cinemaSublineEl) this.cinemaSublineEl.textContent = b4;
      this._refreshCinemaHmiRows();
    } else {
      if (this.cinemaHeadlineEl) this.cinemaHeadlineEl.textContent = '';
      if (this.cinemaSublineEl) this.cinemaSublineEl.textContent = '';
      this._refreshCinemaHmiRows();
      if (this.cinemaStartBtn && this.coldOpenActive) {
        this.cinemaStartBtn.focus();
      }
    }

    if (this.cinemaNextBtn) {
      this.cinemaNextBtn.classList.toggle('is-hidden', !this.cinemaReduced || clamped >= CINEMA_SCENES.length - 1);
    }
    this._syncCinemaProgressBars();
  }

  _setCinemaDistrictState(key, mode) {
    const ref = this.cinemaDistCards[key];
    if (!ref) return;
    ref.card.classList.toggle('is-lit', mode === 'lit');
    ref.card.classList.toggle('is-diesel', mode === 'diesel');
    ref.card.classList.toggle('is-dark', mode === 'dark');
    ref.statusEl.textContent = mode === 'lit' ? 'Energized' : ref.offLabel;
  }

  _syncCinemaProgressBars() {
    this.cinemaSegFills.forEach((fill, idx) => {
      if (idx < this.cinemaSceneIdx) {
        fill.style.transform = 'scaleX(1)';
      } else if (idx > this.cinemaSceneIdx) {
        fill.style.transform = 'scaleX(0)';
      } else if (idx === CINEMA_SCENES.length - 1 || this.cinemaReduced) {
        fill.style.transform = 'scaleX(1)';
      } else {
        const sc = CINEMA_SCENES[idx];
        const span = Math.max(1, sc.endMs - sc.startMs);
        const ratio = Math.max(0, Math.min(1, (this.cinemaElapsedMs - sc.startMs) / span));
        fill.style.transform = `scaleX(${ratio.toFixed(4)})`;
      }
    });
  }

  _jumpToCinemaScene(idx) {
    const clamped = Math.max(0, Math.min(CINEMA_SCENES.length - 1, idx));
    this.cinemaElapsedMs = CINEMA_SCENES[clamped].startMs;
    this.cinemaLastTick = performance.now();
    this._applyCinemaScene(clamped);
    if (!this.cinemaReduced && !this.cinemaPaused && clamped < CINEMA_SCENES.length - 1 && !this.cinemaRaf) {
      this._startCinemaLoop();
    }
  }

  _toggleCinemaPause() {
    if (this.cinemaReduced || !this.coldOpenActive) return;
    this.cinemaPaused = !this.cinemaPaused;
    if (this.cinemaPauseBtn) {
      this.cinemaPauseBtn.textContent = this.cinemaPaused ? 'Resume' : 'Pause';
      this.cinemaPauseBtn.setAttribute('aria-pressed', String(this.cinemaPaused));
    }
    if (!this.cinemaPaused && this.cinemaSceneIdx < CINEMA_SCENES.length - 1) {
      this.cinemaLastTick = performance.now();
      this._startCinemaLoop();
    }
  }

  _startCinemaLoop() {
    if (this.cinemaRaf) cancelAnimationFrame(this.cinemaRaf);
    const tick = (now) => {
      if (!this.coldOpenActive || this.cinemaPaused || this.cinemaReduced) {
        this.cinemaRaf = null;
        return;
      }
      this.cinemaFrameCount += 1;
      const dt = Math.min(100, Math.max(0, now - this.cinemaLastTick));
      this.cinemaLastTick = now;
      this.cinemaElapsedMs += dt;

      let nextIdx = CINEMA_SCENES.length - 1;
      for (let i = 0; i < CINEMA_SCENES.length - 1; i++) {
        if (this.cinemaElapsedMs < CINEMA_SCENES[i].endMs) {
          nextIdx = i;
          break;
        }
      }

      if (nextIdx !== this.cinemaSceneIdx) {
        this._applyCinemaScene(nextIdx);
      } else {
        this._syncCinemaProgressBars();
      }

      if (nextIdx >= CINEMA_SCENES.length - 1) {
        this.cinemaRaf = null;
        return;
      }
      this.cinemaRaf = requestAnimationFrame(tick);
    };
    this.cinemaRaf = requestAnimationFrame(tick);
  }

  startColdOpen() {
    if (!this.data || !this.cinemaEl) {
      this.onColdOpenFinished('skip');
      return;
    }
    if (this.cinemaFadeTimer) {
      clearTimeout(this.cinemaFadeTimer);
      this.cinemaFadeTimer = null;
    }
    this.hideActCard();
    this._ensureCinemaMounted();
    this._populateCinemaCopy();
    this._refreshCinemaHmiRows();

    this.coldOpenActive = true;
    this.onColdOpenVisibilityChange(true);
    this.cinemaPaused = false;
    this.cinemaReduced = isReducedMotion();
    this.cinemaElapsedMs = 0;
    this.cinemaLastTick = performance.now();
    this.cinemaFrameCount = 0;
    this.cinemaSceneIdx = -1;

    if (this.cinemaPauseBtn) {
      this.cinemaPauseBtn.textContent = 'Pause';
      this.cinemaPauseBtn.setAttribute('aria-pressed', 'false');
      this.cinemaPauseBtn.classList.toggle('is-hidden', this.cinemaReduced);
    }

    const labShell = document.getElementById('lab-shell');
    if (labShell) labShell.inert = true;
    this.cinemaEl.classList.remove('is-hidden', 'is-fading-out');
    this.setSceneView('city');
    this._applyCinemaScene(0);

    if (!this.cinemaReduced) {
      this._startCinemaLoop();
    }
    if (this.cinemaSkipBtn) this.cinemaSkipBtn.focus();
  }

  isOverlayActive() {
    return Boolean(this.coldOpenActive || (this.actCardEl && !this.actCardEl.classList.contains('is-hidden')));
  }

  finishColdOpen(silent = false, action = 'skip') {
    const labShell = document.getElementById('lab-shell');
    if (labShell) labShell.inert = false;
    if (!this.coldOpenActive) return;
    this.coldOpenActive = false;
    this.onColdOpenVisibilityChange(false);
    this.cinemaPaused = false;
    if (this.cinemaRaf) {
      cancelAnimationFrame(this.cinemaRaf);
      this.cinemaRaf = null;
    }

    const completeHide = () => {
      this.cinemaFadeTimer = null;
      if (this.cinemaEl) {
        this.cinemaEl.classList.add('is-hidden');
        this.cinemaEl.classList.remove('is-fading-out');
      }
      if (silent) return;
      if (action === 'tour') this.onCinemaStartTour();
      else if (action === 'explore') this.onCinemaExplore();
      else this.onColdOpenFinished('skip');
    };

    if (silent || isReducedMotion() || !this.cinemaEl) {
      completeHide();
    } else {
      this.cinemaEl.classList.add('is-fading-out');
      this.cinemaFadeTimer = setTimeout(completeHide, 280);
    }
  }

  renderMissionStoryBanner(contractModId, onOpenDispatch) {
    if (!this.missionBannerEl) return;
    const mod = this.data?.modules?.[contractModId];
    if (!mod || !mod.opener) {
      this.missionBannerEl.classList.add('is-hidden');
      this.missionBannerEl.replaceChildren();
      return;
    }

    const act = (this.data.acts || []).find((a) => a.id === mod.act);
    const opener = mod.opener;
    this.missionBannerEl.replaceChildren();

    const left = document.createElement('div');
    left.className = 'mission-story-left';

    const chip = document.createElement('span');
    chip.className = 'monogram-chip';
    chip.textContent = opener.initials || 'OT';

    const copy = document.createElement('div');
    copy.className = 'mission-story-copy';

    const meta = document.createElement('div');
    meta.className = 'mission-story-meta';

    if (act) {
      const actPill = document.createElement('span');
      actPill.className = 'mission-act-pill';
      actPill.textContent = `Act ${act.id} · ${act.title.replace(/^\d+\.\s*/, '')}`;
      meta.appendChild(actPill);
    }

    const who = document.createElement('strong');
    who.className = 'mission-speaker-name';
    who.textContent = opener.speaker || '';
    meta.appendChild(who);

    if (opener.role) {
      const role = document.createElement('span');
      role.className = 'mission-speaker-role';
      role.textContent = opener.role;
      meta.appendChild(role);
    }

    const quote = document.createElement('p');
    quote.className = 'mission-story-quote';
    quote.textContent = `"${opener.line}"`;

    copy.append(meta, quote);
    left.append(chip, copy);

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'btn-secondary';
    openBtn.id = 'btn-mission-open-dispatch';
    openBtn.textContent = 'Open Dispatch ->';
    openBtn.addEventListener('click', () => {
      if (typeof onOpenDispatch === 'function') onOpenDispatch();
    });

    this.missionBannerEl.append(left, openBtn);
    this.missionBannerEl.classList.remove('is-hidden');
  }

  maybeShowActCard(contractModId) {
    if (!this.data || !this.actCardEl || this.coldOpenActive) return;
    const act = (this.data.acts || []).find((a) => Array.isArray(a.modules) && a.modules.includes(contractModId));
    if (!act || this.stored.actsSeen[act.id]) return;

    this.stored.actsSeen[act.id] = true;
    writeStoryStorage(this.storageKey, this.stored);
    this.showActCard(act);
  }

  showActCard(act) {
    if (!this.actCardEl || !act) return;
    if (this.actTimer) clearTimeout(this.actTimer);
    this.actCardEl.replaceChildren();

    const box = document.createElement('div');
    box.className = 'act-card-box';
    const kicker = document.createElement('div');
    kicker.className = 'act-card-kicker';
    kicker.textContent = `Act ${act.id}`;
    const title = document.createElement('h2');
    title.className = 'act-card-title';
    title.textContent = act.title;
    const q = document.createElement('p');
    q.className = 'act-card-question';
    q.textContent = act.question;
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'cinema-btn';
    skip.id = 'btn-act-skip';
    skip.textContent = 'Continue';
    skip.addEventListener('click', () => this.hideActCard());

    box.append(kicker, title, q, skip);
    this.actCardEl.appendChild(box);
    this.actCardEl.classList.remove('is-hidden');

    const dur = Number(act.durationMs) || 3000;
    this.actTimer = setTimeout(() => this.hideActCard(), dur);
  }

  hideActCard() {
    if (this.actTimer) {
      clearTimeout(this.actTimer);
      this.actTimer = null;
    }
    const wasVisible = Boolean(this.actCardEl && !this.actCardEl.classList.contains('is-hidden'));
    if (this.actCardEl) {
      this.actCardEl.classList.add('is-hidden');
      this.actCardEl.replaceChildren();
    }
    if (wasVisible) {
      this.onActCardHidden();
    }
  }

  ensureOpenerInDispatch(contractModId, dispatchEntries) {
    if (!this.data) return null;
    const mod = this.data.modules && this.data.modules[contractModId];
    if (!mod || !mod.opener) return null;
    const opener = mod.opener;
    const exists = dispatchEntries.some((d) => d._storyOpenerId === contractModId);
    if (exists) return null;
    this.stored.openersShown[contractModId] = true;
    writeStoryStorage(this.storageKey, this.stored);
    return {
      _storyOpenerId: contractModId,
      sender: opener.speaker,
      initials: opener.initials,
      role: opener.role,
      pose: opener.pose || 'phone',
      body: opener.line,
      utc: `${new Date().toISOString().slice(11, 19)} UTC`,
      ist: `${new Date(Date.now() + 19800000).toISOString().slice(11, 19)} IST`,
    };
  }

  buildOpenerCardElement(entry, onPin) {
    const card = document.createElement('article');
    card.className = 'dispatch-opener-card';
    const chip = document.createElement('span');
    chip.className = 'monogram-chip';
    chip.textContent = entry.initials || 'OT';

    const copy = document.createElement('div');
    copy.className = 'dispatch-opener-copy';
    const head = document.createElement('div');
    head.className = 'dispatch-meta';
    const who = document.createElement('strong');
    who.textContent = entry.role ? `${entry.sender} · ${entry.role}` : entry.sender;
    const tg = document.createElement('div');
    tg.className = 'dispatch-time-group';
    const tm = document.createElement('time');
    tm.className = 'dispatch-time tabular';
    tm.textContent = entry.ist ? `${entry.utc} (${entry.ist})` : entry.utc;
    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = 'btn-mini';
    pinBtn.textContent = 'Pin';
    pinBtn.addEventListener('click', () => onPin(entry));
    tg.append(tm, pinBtn);
    head.append(who, tg);

    const p = document.createElement('p');
    p.textContent = entry.body;
    copy.append(head, p);

    const mascot = createMascot({ pose: entry.pose || 'phone', size: 48 });
    card.append(chip, copy, mascot);
    return card;
  }

  renderCloserAndDebrief(contractModId, passed) {
    if (!this.closerEl) return;
    if (!passed || !this.data || !this.data.modules || !this.data.modules[contractModId]) {
      this.closerEl.classList.add('is-hidden');
      this.closerEl.replaceChildren();
      return;
    }
    const mod = this.data.modules[contractModId];
    this.closerEl.replaceChildren();

    const headRow = document.createElement('div');
    headRow.className = 'closer-head-row';
    headRow.appendChild(createMascot({ pose: 'cheer', size: 54 }));
    const closerP = document.createElement('p');
    closerP.className = 'closer-line';
    closerP.textContent = mod.closer || '';
    headRow.appendChild(closerP);
    this.closerEl.appendChild(headRow);

    const deb = document.createElement('div');
    deb.className = 'debrief-block';
    const h3 = document.createElement('h3');
    h3.textContent = mod.debriefHeading || 'What really happened';
    deb.appendChild(h3);

    (mod.debriefLines || []).forEach((line) => {
      const p = document.createElement('p');
      p.textContent = line;
      deb.appendChild(p);
    });

    if (mod.realWorldNote) {
      const rw = document.createElement('div');
      rw.className = 'debrief-realworld';
      rw.textContent = mod.realWorldNote;
      deb.appendChild(rw);
    }

    if (contractModId === 'm10') {
      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '8px';
      const srBtn = document.createElement('button');
      srBtn.type = 'button';
      srBtn.className = 'btn-primary';
      srBtn.id = 'btn-open-shift-report';
      srBtn.textContent = 'View shift report';
      srBtn.addEventListener('click', () => this.openShiftReportFull(true));
      btnRow.appendChild(srBtn);
      deb.appendChild(btnRow);
    }

    this.closerEl.appendChild(deb);
    this.closerEl.classList.remove('is-hidden');
  }

  updateStakesStrip({ districts, dispatchEntries, liveConnected }) {
    if (!this.stakesEl || !this.data || !this.data.stakes) return;
    if (!liveConnected && (!districts || !Object.keys(districts).length)) {
      this.stakesEl.classList.add('is-hidden');
      return;
    }
    const st = this.data.stakes;
    const dMap = districts || {};
    const vals = Object.values(dMap);
    const litCount = vals.filter((v) => v === 'lit').length;
    const darkCount = vals.length ? (6 - litCount) : 3;

    let dieselHours = '8';
    for (const d of dispatchEntries || []) {
      const txt = String(d.body || d.message || '');
      const m = txt.match(/diesel[^0-9]{0,28}(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\b/i)
        || txt.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\s*(?:of\s*)?(?:diesel|fuel|left|remaining)/i);
      if (m) {
        dieselHours = m[1];
        break;
      }
    }

    this.stakesEl.classList.remove('is-hidden', 'is-restored');
    if (litCount >= 6) {
      this.stakesEl.textContent = st.restoredText || 'All districts restored';
      this.stakesEl.classList.add('is-restored');
    } else if (dMap.hospital === 'lit' && dMap.water === 'lit') {
      this.stakesEl.textContent = `${darkCount} districts dark · Hospital & Water restored`;
    } else {
      this.stakesEl.textContent = `${darkCount} districts dark · Hospital on diesel (~${dieselHours} h)`;
    }
    this.stakesEl.title = this.stakesEl.textContent;
  }

  openShiftReportFull(open) {
    const isOpen = Boolean(open) && Boolean(this.shiftReport && this.cases.m10);
    if (isOpen) {
      this.onTabCase();
      document.documentElement.dataset.shiftReport = 'open';
    } else {
      delete document.documentElement.dataset.shiftReport;
    }
    const tog = document.getElementById('btn-toggle-shift-full');
    if (tog) tog.textContent = isOpen ? 'Back to Split view' : 'Full-width view';
    const caseOpenBtn = document.getElementById('btn-case-open-shift');
    if (caseOpenBtn) caseOpenBtn.textContent = isOpen ? 'Back to Case Board' : 'Full-width Shift Report';
  }

  async refreshCaseBoard(justPassedId = null) {
    const resp = await this.apiJson('GET', '/api/ems/case');
    let signedList = null;
    if (resp && resp.ok && resp.data && typeof resp.data.cases === 'object') {
      this.cases = resp.data.cases || {};
      signedList = Array.isArray(resp.data.passed_modules)
        ? resp.data.passed_modules
        : Object.keys(this.cases);
      if (resp.data.hints_unlocked && typeof resp.data.hints_unlocked === 'object') {
        this.onHintsHydrated(resp.data.hints_unlocked);
      }
    }
    this.renderCaseBoard(justPassedId);
    if (signedList !== null) {
      this.onCasesUpdated(signedList);
    }
    if (this.cases.m10) {
      await this.refreshShiftReport();
    } else {
      this.shiftReport = null;
      if (this.shiftHostEl) this.shiftHostEl.replaceChildren();
      document.getElementById('btn-case-open-shift')?.classList.add('is-hidden');
      this.openShiftReportFull(false);
    }
  }

  renderCaseBoard(justPassedId = null) {
    if (!this.caseChainEl || !this.data) return;
    const order = (this.data.caseBoard && this.data.caseBoard.chainOrder) || [];
    const actsById = Object.fromEntries((this.data.acts || []).map((a) => [a.id, a]));
    this.caseChainEl.replaceChildren();

    let passedCount = 0;
    order.forEach((modId, idx) => {
      const mMeta = (this.data.modules && this.data.modules[modId]) || {};
      const act = actsById[mMeta.act] || {};
      const entry = this.cases[modId] || null;
      const isPassed = Boolean(entry);
      if (isPassed) passedCount += 1;

      const card = document.createElement('article');
      card.className = `case-card${isPassed ? ' is-passed' : ''}`;
      if (isPassed && (justPassedId === modId || !this.knownPassedIds.has(modId))) {
        if (justPassedId === modId) card.classList.add('is-clack');
        this.knownPassedIds.add(modId);
      }
      card.dataset.caseMod = modId;

      const head = document.createElement('div');
      head.className = 'case-card-head';
      const num = document.createElement('span');
      num.className = 'case-card-num tabular';
      num.textContent = `M${idx + 1}`;
      const title = document.createElement('span');
      title.className = 'case-card-title';
      title.textContent = (entry && entry.title) || mMeta.cardTitle || modId;
      head.append(title, num);
      card.appendChild(head);

      if (!isPassed) {
        const q = document.createElement('div');
        q.className = 'case-card-q';
        q.textContent = act.question || '';
        card.appendChild(q);
      } else {
        const ul = document.createElement('ul');
        ul.className = 'case-card-fields';
        (entry.fields || []).slice(0, 3).forEach((f) => {
          const li = document.createElement('li');
          const k = document.createElement('span');
          k.className = 'case-field-k';
          k.textContent = String(f.label || '');
          const v = document.createElement('span');
          v.className = 'case-field-v tabular';
          v.textContent = String(f.value || '').slice(0, 64);
          li.append(k, v);
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }

      this.caseChainEl.appendChild(card);
    });

    if (this.caseCountEl) {
      this.caseCountEl.textContent = String(passedCount);
    }
    if (this.navCaseProgressEl) {
      this.navCaseProgressEl.textContent = `${passedCount}/10`;
    }
  }

  async refreshShiftReport() {
    if (!this.shiftHostEl || !this.data) return;
    const resp = await this.apiJson('GET', '/api/ems/shift-report');
    if (!resp || !resp.ok || !resp.data || resp.data.ok === false) {
      this.shiftHostEl.replaceChildren();
      return;
    }
    this.shiftReport = resp.data;
    this.renderShiftReport();
  }

  renderShiftReport() {
    if (!this.shiftHostEl || !this.shiftReport || !this.data) return;
    const sr = this.shiftReport;
    const copy = this.data.shiftReport || {};
    this.shiftHostEl.replaceChildren();

    const card = document.createElement('section');
    card.className = 'shift-report-card';
    card.id = 'shift-report-card';

    const head = document.createElement('div');
    head.className = 'shift-report-head';
    const hWrap = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.textContent = copy.heading || 'Shift report';
    const sub = document.createElement('p');
    sub.className = 'console-sub';
    sub.textContent = copy.subheading || '';
    hWrap.append(h2, sub);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'console-actions';
    const togBtn = document.createElement('button');
    togBtn.type = 'button';
    togBtn.className = 'btn-secondary';
    togBtn.id = 'btn-toggle-shift-full';
    const isFull = document.documentElement.dataset.shiftReport === 'open';
    togBtn.textContent = isFull ? 'Back to Split view' : 'Full-width view';
    togBtn.addEventListener('click', () => {
      this.openShiftReportFull(document.documentElement.dataset.shiftReport !== 'open');
    });
    const printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.className = 'btn-primary';
    printBtn.id = 'btn-print-shift-report';
    printBtn.textContent = copy.printLabel || 'Print or save PDF';
    printBtn.addEventListener('click', () => window.print());
    btnGroup.append(togBtn, printBtn);
    head.append(hWrap, btnGroup);
    card.appendChild(head);
    document.getElementById('btn-case-open-shift')?.classList.remove('is-hidden');

    const stats = document.createElement('div');
    stats.className = 'shift-report-stats';
    const hints = sr.hints_used || {};
    [
      [copy.totalTimeLabel || 'Total time', fmtDuration(sr.total_elapsed_s)],
      [copy.totalScoreLabel || 'Total score', `${sr.total_score ?? 0} / ${sr.max_score ?? 1000}`],
      [copy.hintsLabel || 'Hints used', `L1 ${hints.l1 ?? 0} · L2 ${hints.l2 ?? 0} · L3 ${hints.l3 ?? 0}`],
      ['Completed UTC', String(sr.completed_utc || '').slice(0, 19).replace('T', ' ')],
    ].forEach(([k, v]) => {
      const box = document.createElement('div');
      box.className = 'shift-stat-box';
      const sp = document.createElement('span');
      sp.textContent = k;
      const st = document.createElement('strong');
      st.className = 'tabular';
      st.textContent = v;
      box.append(sp, st);
      stats.appendChild(box);
    });
    card.appendChild(stats);

    const tbl = document.createElement('table');
    tbl.className = 'shift-acts-table';
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    ['Act', 'Time', 'Score'].forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    tbl.appendChild(thead);

    const tbody = document.createElement('tbody');
    (sr.acts || []).forEach((a) => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = `${a.title}`;
      const td2 = document.createElement('td');
      td2.className = 'tabular';
      td2.textContent = fmtDuration(a.elapsed_s);
      const td3 = document.createElement('td');
      td3.className = 'tabular';
      td3.textContent = `${a.score ?? 0} / ${a.max_score ?? 0}`;
      tr.append(td1, td2, td3);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    card.appendChild(tbl);

    const reply = document.createElement('div');
    reply.className = 'shift-rathore-reply';
    const chip = document.createElement('span');
    chip.className = 'monogram-chip';
    chip.textContent = copy.commanderInitials || 'VR';
    const rCopy = document.createElement('div');
    const rWho = document.createElement('strong');
    rWho.textContent = copy.commanderName || 'Commandant Vikram Rathore';
    const rMsg = document.createElement('p');
    rMsg.textContent = copy.commanderReply || '';
    rCopy.append(rWho, rMsg);
    reply.append(chip, rCopy);
    card.appendChild(reply);

    this.shiftHostEl.appendChild(card);
  }
}
