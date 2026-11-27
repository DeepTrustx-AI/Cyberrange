import { IEC_TYPE_NAMES, IEC_COT_NAMES } from './modules.js';

export function escHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatSoeDetail(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw !== 'object') return String(raw);
  if (Array.isArray(raw)) {
    return raw.map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join(', ');
  }
  return Object.entries(raw)
    .map(([k, v]) => `${k}=${typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}`)
    .join(', ');
}

export function formatSoeReplayEvents(events, fallbackTr1Pct = 0) {
  if (!Array.isArray(events) || !events.length) {
    return `TR-1 ${Math.round(fallbackTr1Pct || 0)}%`;
  }
  const joined = events
    .map((ev) => {
      if (typeof ev === 'string') return ev;
      if (!ev || typeof ev !== 'object') return '';
      const d = ev.detail && typeof ev.detail === 'object'
        ? formatSoeDetail(ev.detail)
        : (ev.detail ?? ev.message ?? '');
      const head = `${ev.asset || ''} ${ev.code || ''}`.trim();
      const detailStr = String(d || '').trim();
      return detailStr ? (head ? `${head}: ${detailStr}` : detailStr) : head;
    })
    .filter(Boolean)
    .join('; ');
  return joined || `TR-1 ${Math.round(fallbackTr1Pct || 0)}%`;
}

export function parsePolicyYamlToRules(yamlText) {
  const text = String(yamlText || '');
  const dpMatch = text.match(/default_policy:\s*(allow|deny)/i);
  const defaultPolicy = dpMatch ? dpMatch[1].toLowerCase() : 'deny';
  const rules = {};
  const blocks = text.split(/\n\s*-\s+id:/);
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const s = b.match(/src_zone:\s*(\w+)/);
    const d = b.match(/dst_zone:\s*(\w+)/);
    const pt = b.match(/dst_port:\s*(\d+)/);
    const ac = b.match(/action:\s*(allow|deny)/i);
    if (s && d && pt && ac) {
      const port = parseInt(pt[1], 10);
      if (port >= 1 && port <= 65535) {
        const key = `${s[1]}->${d[1]}:${port}`;
        rules[key] = {
          src: s[1],
          dst: d[1],
          port,
          action: ac[1].toLowerCase(),
        };
      }
    }
  }
  return { defaultPolicy, rules };
}

export function serializePolicyRulesToYaml(defaultPolicy, rulesMap) {
  const dp = defaultPolicy === 'allow' ? 'allow' : 'deny';
  const lines = [`default_policy: ${dp}`, 'rules:'];
  let count = 0;
  const entries = Object.values(rulesMap || {}).sort((a, b) => {
    const ka = `${a.src}->${a.dst}:${String(a.port).padStart(5, '0')}`;
    const kb = `${b.src}->${b.dst}:${String(b.port).padStart(5, '0')}`;
    return ka.localeCompare(kb);
  });
  for (const row of entries) {
    const port = parseInt(String(row.port), 10);
    if ((row.action === 'allow' || row.action === 'deny') && port >= 1 && port <= 65535 && row.src && row.dst) {
      count += 1;
      const rid = `r-${String(row.src).toLowerCase()}-${String(row.dst).toLowerCase()}-${port}`.slice(0, 48);
      lines.push(`  - id: ${rid}`);
      lines.push(`    src_zone: ${row.src}`);
      lines.push(`    dst_zone: ${row.dst}`);
      lines.push('    protocol: tcp');
      lines.push(`    dst_port: ${port}`);
      lines.push(`    action: ${row.action}`);
    }
  }
  if (count === 0) return `default_policy: ${dp}\nrules: []\n`;
  return `${lines.join('\n')}\n`;
}

export class TrendsPanel {
  constructor(canvasMap, readoutEl) {
    this.canvases = canvasMap;
    this.readoutEl = readoutEl;
    this.buffer = [];
    this.maxPoints = 600;
    this.paused = false;
    this.zoomRange = null;
    this.hoverRatio = null;
    this._dragStart = null;
    this._bindInteractions();
  }

  _bindInteractions() {
    Object.values(this.canvases).forEach((cvs) => {
      if (!cvs) return;
      cvs.addEventListener('pointermove', (e) => {
        const r = cvs.getBoundingClientRect();
        this.hoverRatio = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
        this.render();
      });
      cvs.addEventListener('pointerleave', () => {
        if (this._dragStart === null) {
          this.hoverRatio = null;
          this.render();
        }
      });
      cvs.addEventListener('pointerdown', (e) => {
        const r = cvs.getBoundingClientRect();
        this._dragStart = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
        cvs.setPointerCapture(e.pointerId);
      });
      cvs.addEventListener('pointerup', (e) => {
        if (this._dragStart === null) return;
        const r = cvs.getBoundingClientRect();
        const end = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
        const a = Math.min(this._dragStart, end);
        const b = Math.max(this._dragStart, end);
        this._dragStart = null;
        if (b - a > 0.04 && this.buffer.length >= 4) {
          const cur = this.zoomRange || [0, this.buffer.length - 1];
          const span = cur[1] - cur[0];
          const nextStart = Math.max(0, Math.floor(cur[0] + a * span));
          const nextEnd = Math.min(this.buffer.length - 1, Math.ceil(cur[0] + b * span));
          if (nextEnd - nextStart >= 3) this.zoomRange = [nextStart, nextEnd];
        }
        this.render();
      });
      cvs.addEventListener('pointercancel', () => {
        this._dragStart = null;
        this.hoverRatio = null;
        this.render();
      });
    });
  }

  pushSample(sample) {
    if (this.paused) return;
    this.buffer.push(sample);
    if (this.buffer.length > this.maxPoints) {
      this.buffer.shift();
      if (this.zoomRange) {
        const nextStart = this.zoomRange[0] - 1;
        const nextEnd = this.zoomRange[1] - 1;
        if (nextStart < 0 && nextEnd < 3) {
          // Zoomed slice has scrolled completely off the ring buffer; return to latest live window.
          this.zoomRange = null;
        } else {
          this.zoomRange = [Math.max(0, nextStart), Math.max(3, nextEnd)];
        }
      }
    }
    this.render();
  }

  setPaused(val) {
    this.paused = Boolean(val);
    this.render();
  }

  resetZoom() {
    this.zoomRange = null;
    this.render();
  }

  _slice() {
    if (!this.buffer.length) return [];
    if (!this.zoomRange) return this.buffer;
    return this.buffer.slice(this.zoomRange[0], this.zoomRange[1] + 1);
  }

  isVisible() {
    return !document.hidden && Boolean(this.canvases.freq && this.canvases.freq.offsetParent !== null);
  }

  render() {
    if (!this.isVisible()) return;
    const pts = this._slice();
    const dark = document.documentElement.classList.contains('dark');
    const bg = dark ? '#14110f' : '#faf8f5';
    const grid = dark ? 'rgba(244,239,232,0.08)' : 'rgba(30,36,48,0.08)';
    const band = dark ? 'rgba(67,196,154,0.14)' : 'rgba(42,148,118,0.11)';
    const ink = dark ? '#ece7df' : '#1f2532';

    const drawStrip = (cvs, opts) => {
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      const w = cvs.width;
      const h = cvs.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const yOf = (val) => h - 10 - ((val - opts.min) / (opts.max - opts.min)) * (h - 20);

      if (opts.band) {
        const yHi = yOf(opts.band[1]);
        const yLo = yOf(opts.band[0]);
        ctx.fillStyle = band;
        ctx.fillRect(0, yHi, w, Math.max(1, yLo - yHi));
      }

      if (opts.refLines) {
        opts.refLines.forEach((rl) => {
          const y = yOf(rl.v);
          ctx.strokeStyle = rl.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const y = (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (pts.length >= 2) {
        opts.series.forEach((ser) => {
          ctx.strokeStyle = ser.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          let started = false;
          pts.forEach((pt, idx) => {
            const v = pt[ser.key];
            if (v === null || v === undefined || Number.isNaN(v)) {
              started = false;
              return;
            }
            const x = (idx / Math.max(1, pts.length - 1)) * w;
            const y = Math.max(4, Math.min(h - 4, yOf(v)));
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
        });
      }

      if (this.hoverRatio !== null && pts.length) {
        const x = this.hoverRatio * w;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    };

    const maxMw = pts.reduce((acc, p) => Math.max(acc, Number(p.mw) || 0), 0);
    const mwAxisMax = maxMw > 50 ? Math.ceil((maxMw * 1.12) / 5) * 5 : 55;

    drawStrip(this.canvases.freq, {
      min: 49.2, max: 50.2, band: [49.9, 50.05],
      series: [
        { key: 'busHz', color: dark ? '#6ec4b0' : '#2a6f82' },
        { key: 'genHz', color: dark ? '#f2b16d' : '#c67a28' },
      ],
    });
    drawStrip(this.canvases.kv, {
      min: 28.0, max: 35.5, band: [31.35, 34.65],
      series: [{ key: 'busKv', color: dark ? '#82b8de' : '#2f5f8a' }],
    });
    drawStrip(this.canvases.tr, {
      min: 0, max: 130,
      refLines: [
        { v: 95, color: dark ? '#f2b16d' : '#c67a28' },
        { v: 115, color: dark ? '#f06a6a' : '#d63b42' },
      ],
      series: [
        { key: 'tr1Pct', color: dark ? '#e06c3a' : '#b84b26' },
        { key: 'tr2Pct', color: dark ? '#56c79c' : '#228263' },
      ],
    });
    drawStrip(this.canvases.mw, {
      min: 0, max: mwAxisMax,
      refLines: [
        { v: 42, color: dark ? '#f2b16d' : '#c67a28' },
        { v: 46, color: dark ? '#f06a6a' : '#d63b42' },
      ],
      series: [
        { key: 'mw', color: dark ? '#ece7df' : '#262d3d' },
        { key: 'genMw', color: dark ? '#f2b16d' : '#c67a28' },
      ],
    });

    if (this.readoutEl) {
      if (!pts.length) {
        this.readoutEl.textContent = 'Waiting for live station telemetry...';
      } else {
        const idx = this.hoverRatio !== null
          ? Math.min(pts.length - 1, Math.round(this.hoverRatio * (pts.length - 1)))
          : pts.length - 1;
        const p = pts[idx];
        const bHz = p.busHz === null ? '--' : `${p.busHz.toFixed(2)} Hz`;
        const gHz = p.genHz === null ? '--' : `${p.genHz.toFixed(2)} Hz`;
        const loadStr = p.tieClosed && typeof p.genMw === 'number' && typeof p.tieMw === 'number'
          ? `${p.mw.toFixed(1)} MW (Gen ${p.genMw.toFixed(1)} / Tie ${p.tieMw.toFixed(1)})`
          : `${p.mw.toFixed(1)} MW`;
        this.readoutEl.textContent = `${p.utc} | Bus ${bHz} · GEN ${gHz} · ${p.busKv.toFixed(1)} kV · TR-1 ${p.tr1Pct}% · TR-2 ${p.tr2Pct}% · ${loadStr}`;
      }
    }
  }
}

export function renderAlarmsTable(tbodyEl, emptyEl, alarms, handlers) {
  if (!tbodyEl) return;
  tbodyEl.replaceChildren();
  if (!alarms || !alarms.length) {
    if (emptyEl) emptyEl.classList.remove('is-hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('is-hidden');
  alarms.forEach((a) => {
    const tr = document.createElement('tr');
    const prioNum = Number(a.priority) || 3;
    const stateLabel = String(a.state || 'active');
    const safeStateCls = stateLabel.replace(/[^a-z0-9_-]/gi, '');
    tr.className = `alarm-row prio-${prioNum} state-${safeStateCls}`;
    const prio = `P${prioNum}`;
    const canAct = stateLabel === 'active';
    tr.innerHTML = `
      <td><span class="prio-badge prio-${prioNum}">${escHtml(prio)}</span></td>
      <td class="tabular">${escHtml(a.utc || '')}<br/><span class="sub-time">${escHtml(a.ist || '')}</span></td>
      <td><strong>${escHtml(a.point || '')}</strong><div class="sub-desc">${escHtml(a.description || '')}</div></td>
      <td class="tabular">${escHtml(a.value ?? '')}</td>
      <td><span class="alarm-state-pill">${escHtml(stateLabel)}</span></td>
      <td class="alarm-actions">
        <button type="button" class="btn-mini" data-act="ack" ${canAct ? '' : 'disabled'}>Ack</button>
        <button type="button" class="btn-mini" data-act="shelve" ${stateLabel === 'shelved' || stateLabel === 'cleared' ? 'disabled' : ''}>Shelve</button>
        <button type="button" class="btn-mini" data-act="pin">Pin</button>
      </td>
    `;
    tr.querySelector('[data-act="ack"]').addEventListener('click', () => handlers.onAck(a));
    tr.querySelector('[data-act="shelve"]').addEventListener('click', () => handlers.onShelve(a));
    tr.querySelector('[data-act="pin"]').addEventListener('click', () => handlers.onPin(a));
    tbodyEl.appendChild(tr);
  });
}

export function renderSoeTable(tbodyEl, emptyEl, events, onReplay) {
  if (!tbodyEl) return;
  tbodyEl.replaceChildren();
  if (!events || !events.length) {
    if (emptyEl) emptyEl.classList.remove('is-hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('is-hidden');
  [...events].reverse().forEach((ev) => {
    const tr = document.createElement('tr');
    const code = ev.code ? String(ev.code) : '';
    const rawDetail = ev.event ?? ev.message ?? ev.detail;
    const detail = formatSoeDetail(rawDetail);
    const text = code && detail && !detail.includes(code) ? `${code}: ${detail}` : (detail || code);
    const isTrip = /trip|lockout|86|50|51|81u|81o|27/i.test(`${code} ${detail}`);
    const objAsset = rawDetail && typeof rawDetail === 'object' ? (rawDetail.asset || rawDetail.bay_id || '') : '';
    const asset = ev.asset || ev.bay_id || objAsset || ev.source || 'Station';
    tr.innerHTML = `
      <td class="tabular">${escHtml(ev.utc || ev.ts_utc || ev.timestamp_utc || '')}</td>
      <td>${escHtml(asset)}</td>
      <td>${escHtml(text)}</td>
      <td>${isTrip ? '<button type="button" class="btn-mini" data-replay="1">Replay 15 s</button>' : ''}</td>
    `;
    const btn = tr.querySelector('[data-replay]');
    if (btn) btn.addEventListener('click', () => onReplay(ev));
    tbodyEl.appendChild(tr);
  });
}

export function renderIncidentTimeline(axisEl, listEl, pins, findCorrelation, onSelectPin) {
  if (!axisEl || !listEl) return;
  axisEl.replaceChildren();
  listEl.replaceChildren();
  if (!pins.length) {
    axisEl.innerHTML = '<div class="muted-empty">Pin items from Frames, Alarms, Dispatch, Station log, or Terminal selection to build your cross-module UTC/IST incident timeline.</div>';
    return;
  }
  const sorted = [...pins].sort((a, b) => (Number(a.utcSec) || 0) - (Number(b.utcSec) || 0));
  const minS = Number(sorted[0].utcSec) || 0;
  const maxS = Math.max(minS + 10, Number(sorted[sorted.length - 1].utcSec) || minS + 10);

  const track = document.createElement('div');
  track.className = 'timeline-track';
  sorted.forEach((item) => {
    const sec = Number(item.utcSec) || minS;
    const pct = Math.max(4, Math.min(96, ((sec - minS) / (maxS - minS)) * 92 + 4));
    const corr = findCorrelation(item);
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `timeline-pin-dot ${corr ? 'is-correlated' : ''}`;
    dot.style.left = `${pct}%`;
    dot.title = `${item.utc} | ${item.vantage} | ${item.source}: ${item.summary}`;
    dot.setAttribute('aria-label', `${item.utc} ${item.vantage}`);
    dot.addEventListener('click', () => onSelectPin(item));
    track.appendChild(dot);
  });
  axisEl.appendChild(track);

  sorted.forEach((item) => {
    const corr = findCorrelation(item);
    const li = document.createElement('li');
    li.className = `timeline-row ${corr ? 'is-correlated' : ''}`;
    li.innerHTML = `
      <div class="timeline-row-head">
        <strong>${escHtml(item.source)} (${escHtml(item.vantage)})</strong>
        <span class="tabular dispatch-time">${escHtml(item.utc)}${item.ist ? ` · ${escHtml(item.ist)}` : ''}</span>
      </div>
      <div>${escHtml(item.summary)}</div>
      ${corr ? `<span class="corr-note tabular">Within +/-5 s of ${escHtml(corr.partner.vantage)} (${Number(corr.diff) >= 0 ? '+' : ''}${Number(corr.diff) || 0} s)</span>` : ''}
    `;
    listEl.appendChild(li);
  });
}

export function renderFrameAnatomy(listEl, detailEl, frames, filterText, selectedId, handlers) {
  if (!listEl || !detailEl) return;
  const q = String(filterText || '').trim().toLowerCase();
  const filtered = (frames || []).filter((fr) => {
    if (!q) return true;
    if (typeof fr._searchHay !== 'string') {
      fr._searchHay = JSON.stringify(fr).toLowerCase();
    }
    return fr._searchHay.includes(q);
  });

  listEl.replaceChildren();
  if (!filtered.length) {
    const emptyText = q
      ? 'No matching captured IEC-104 frames available for this filter.'
      : 'No captured frames loaded yet. Save a filtered .pcap in ~/workspace/ or view live tap after removing the replay shim.';
    listEl.innerHTML = `<div class="muted-empty">${escHtml(emptyText)}</div>`;
    detailEl.innerHTML = '<div class="muted-empty">Select a frame on the left to inspect APCI, ASDU, IOAs, and CP56Time2a fields.</div>';
    return;
  }

  let active = filtered.find((f) => f.id === selectedId) || filtered[0];
  filtered.slice(0, 120).forEach((fr) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `frame-list-item ${fr.id === active.id ? 'is-selected' : ''}`;
    const typeId = fr.asdu ? fr.asdu.type_id : '-';
    const cot = fr.asdu ? fr.asdu.cot : '-';
    const fmt = fr.apci ? fr.apci.format : 'I';
    btn.innerHTML = `
      <span class="tabular">${escHtml(fr.utc || '')}</span>
      <span class="tabular">${escHtml(fr.src_ip || '')} -&gt; ${escHtml(fr.dst_ip || '')}</span>
      <span class="tabular">${escHtml(fmt)} · T=${escHtml(typeId)} · COT=${escHtml(cot)}</span>
    `;
    btn.addEventListener('click', () => handlers.onSelect(fr.id));
    listEl.appendChild(btn);
  });

  const apci = active.apci || {};
  const asdu = active.asdu || {};
  const ioas = Array.isArray(active.ioas) ? active.ioas : [];
  const typeName = asdu.type_name || IEC_TYPE_NAMES[asdu.type_id] || `Type ${asdu.type_id ?? '-'}`;
  const cotName = asdu.cot_name || IEC_COT_NAMES[asdu.cot] || `COT ${asdu.cot ?? '-'}`;
  const tsharkFilter = active.tshark_filter || buildTsharkFilter(active);

  detailEl.innerHTML = `
    <div class="frame-detail-head">
      <strong class="tabular">${escHtml(active.utc || '')}${active.ist ? ` (${escHtml(active.ist)})` : ''}</strong>
      <div class="frame-detail-actions">
        <button type="button" class="btn-mini" id="btn-frame-copy-filter">Copy as tshark filter</button>
        <button type="button" class="btn-mini" id="btn-frame-pin">Pin to timeline</button>
      </div>
    </div>
    <details open class="anatomy-group">
      <summary>APCI (IEC 60870-5-104)</summary>
      <div class="anatomy-kv tabular">
        <span>Start byte: ${escHtml(apci.start || '0x68')}</span>
        <span>Length: ${escHtml(apci.length ?? '-')}</span>
        <span>Format: ${escHtml(apci.format || 'I-frame')}</span>
        <span>N(S): ${escHtml(apci.ns ?? '-')}</span>
        <span>N(R): ${escHtml(apci.nr ?? '-')}</span>
      </div>
    </details>
    <details open class="anatomy-group">
      <summary>ASDU (${escHtml(typeName)})</summary>
      <div class="anatomy-kv tabular">
        <span>TypeID: ${escHtml(asdu.type_id ?? '-')} (${escHtml(typeName)})</span>
        <span>SQ / Count: ${escHtml(asdu.sq ?? 0)} / ${escHtml(asdu.count ?? ioas.length)}</span>
        <span>COT: ${escHtml(asdu.cot ?? '-')} (${escHtml(cotName)})</span>
        <span>OA: ${escHtml(asdu.oa ?? '-')}</span>
        <span>CA: ${escHtml(asdu.ca ?? '-')}</span>
      </div>
    </details>
    <details open class="anatomy-group">
      <summary>Information Objects (${ioas.length})</summary>
      <div class="anatomy-ioas tabular">
        ${ioas.length ? ioas.map((o) => `
          <div class="ioa-row">
            <strong>IOA ${escHtml(o.ioa)}</strong>
            <span>${escHtml(o.element || 'Element')}: ${escHtml(o.value ?? '-')}</span>
            ${o.cp56_utc ? `<span>CP56Time2a: ${escHtml(o.cp56_utc)}${o.cp56_ist ? ` (${escHtml(o.cp56_ist)})` : ''}</span>` : ''}
          </div>
        `).join('') : '<div class="muted-empty">No information objects in this APDU.</div>'}
      </div>
    </details>
    <div class="tshark-filter-preview tabular"><code>${escHtml(tsharkFilter)}</code></div>
  `;

  detailEl.querySelector('#btn-frame-copy-filter')?.addEventListener('click', () => {
    handlers.onCopyFilter(tsharkFilter);
  });
  detailEl.querySelector('#btn-frame-pin')?.addEventListener('click', () => {
    handlers.onPinFrame(active, typeName);
  });
}

function buildTsharkFilter(fr) {
  const ipRe = /^[0-9a-fA-F.:]+$/;
  const parts = [];
  if (typeof fr.src_ip === 'string' && ipRe.test(fr.src_ip)) parts.push(`ip.src == ${fr.src_ip}`);
  if (typeof fr.dst_ip === 'string' && ipRe.test(fr.dst_ip)) parts.push(`ip.dst == ${fr.dst_ip}`);
  if (fr.asdu && Number.isFinite(Number(fr.asdu.type_id))) parts.push(`iec60870_asdu.typeid == ${Number(fr.asdu.type_id)}`);
  if (fr.asdu && Number.isFinite(Number(fr.asdu.cot))) parts.push(`iec60870_asdu.causetx == ${Number(fr.asdu.cot)}`);
  if (fr.asdu && Number.isFinite(Number(fr.asdu.ca))) parts.push(`iec60870_asdu.addr == ${Number(fr.asdu.ca)}`);
  if (Array.isArray(fr.ioas) && fr.ioas.length === 1 && Number.isFinite(Number(fr.ioas[0].ioa))) {
    parts.push(`iec60870_asdu.ioa == ${Number(fr.ioas[0].ioa)}`);
  }
  return parts.join(' && ') || 'iec60870_104';
}
