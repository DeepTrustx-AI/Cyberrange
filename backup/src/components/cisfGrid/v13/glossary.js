export const GLOSSARY_TERMS = [
  {
    id: 'iec-104',
    term: 'IEC-104',
    fullForm: 'IEC 60870-5-104',
    category: 'protocol',
    plain: 'The network language power substations use over TCP/IP so the control room can read meter values and send open or close commands to circuit breakers.',
  },
  {
    id: 'rtu',
    term: 'RTU',
    fullForm: 'Remote Terminal Unit',
    category: 'grid',
    plain: 'A rugged field computer wired directly to switchyard breakers and meters. It collects live readings and carries out switching orders from the control room.',
  },
  {
    id: 'scada',
    term: 'SCADA',
    fullForm: 'Supervisory Control and Data Acquisition',
    category: 'grid',
    plain: 'The central monitoring and control software system that polls field RTUs every few seconds, raises alarms, and lets operators switch equipment remotely.',
  },
  {
    id: 'hmi',
    term: 'HMI',
    fullForm: 'Human-Machine Interface',
    category: 'grid',
    plain: 'The live screens and single-line diagrams operators watch in the control room. If telemetry is tampered with, the HMI can show a false picture of the field.',
  },
  {
    id: 'ioa',
    term: 'IOA',
    fullForm: 'Information Object Address',
    category: 'protocol',
    plain: 'A unique number inside an IEC-104 message that identifies one exact sensor, meter, or circuit breaker point on a specific RTU.',
  },
  {
    id: 'asdu-ca',
    term: 'ASDU & CA',
    fullForm: 'Application Service Data Unit & Common Address',
    category: 'protocol',
    plain: 'The data payload of an IEC-104 packet (ASDU) and the station or RTU ID number it belongs to (Common Address, or CA).',
  },
  {
    id: 'apci',
    term: 'APCI',
    fullForm: 'Application Protocol Control Information',
    category: 'protocol',
    plain: 'The short 6-byte header at the start of every IEC-104 frame. It carries frame type and send/receive sequence counters (N(S) and N(R)) that reveal dropped or replayed traffic.',
  },
  {
    id: 'cot',
    term: 'COT',
    fullForm: 'Cause of Transmission',
    category: 'protocol',
    plain: 'A small numeric code explaining why an IEC-104 message was sent, such as a spontaneous breaker trip, a periodic reading, an activation command, or a reply to a station poll.',
  },
  {
    id: 'gi',
    term: 'GI (General Interrogation)',
    fullForm: 'Station-Wide Status Poll (C_IC_NA_1)',
    category: 'protocol',
    plain: 'A read-only roll call sent to an RTU asking it to report the current status of every breaker and meter it monitors, without changing any switch position.',
  },
  {
    id: 'startdt-testfr',
    term: 'STARTDT / TESTFR',
    fullForm: 'Start Data Transfer / Test Frame',
    category: 'protocol',
    plain: 'Two lightweight IEC-104 link control messages. STARTDT opens live data flow on a connection, and TESTFR acts as a heartbeat ping to prove the link is still alive.',
  },
  {
    id: 'sbo',
    term: 'SBO (Select-Before-Operate)',
    fullForm: 'Two-Step Breaker Switching Safety Check',
    category: 'grid',
    plain: 'A mandatory two-step safety procedure for switching high-voltage breakers: first Select the target bay to check conditions, then send Execute to actually move the switch.',
  },
  {
    id: 'ansi-25',
    term: 'ANSI 25 (Synchroscope)',
    fullForm: 'Synchronism-Check Relay & Dial',
    category: 'grid',
    plain: 'A protection check and dial that compares frequency, voltage, and phase angle between two power grids so a tie breaker only closes when both sides match safely.',
  },
  {
    id: 'lockout-86',
    term: 'Lockout 86',
    fullForm: 'ANSI 86 Master Trip Lockout Relay',
    category: 'grid',
    plain: 'An emergency safety latch that trips and blocks a transformer or breaker from closing again until an engineer checks the fault and manually resets the relay.',
  },
  {
    id: 'clpu',
    term: 'CLPU (Cold-Load Pickup)',
    fullForm: 'Cold-Load Pickup Inrush Surge',
    category: 'grid',
    plain: 'The temporary surge of extra power drawn when an outage ends and hundreds of motors, chillers, and pumps start all at once. Closing too many feeders together can overload transformers.',
  },
  {
    id: 'iegc-band',
    term: 'IEGC Band',
    fullForm: 'Indian Electricity Grid Code Frequency Band',
    category: 'grid',
    plain: 'The safe steady-state operating range for Indian AC grid frequency (49.90 to 50.05 Hz). Stepping outside this band signals stressed generation or heavy load imbalance.',
  },
  {
    id: 'busbar',
    term: 'Busbar (220/132/33 kV)',
    fullForm: 'High-Voltage Substation Power Rail',
    category: 'grid',
    plain: 'Heavy metal bars inside a substation that receive power at one voltage level and distribute it cleanly to transformers and outgoing city feeders.',
  },
  {
    id: 'feeder-bay',
    term: 'Feeder / Bay',
    fullForm: 'Outgoing Distribution Line & Switchgear Slot',
    category: 'grid',
    plain: 'An individual 33 kV power line (feeder) supplying one city district, together with its circuit breaker, meters, and protection panel (bay) inside the substation.',
  },
  {
    id: 'gen-132-gt1',
    term: 'GEN-132-GT1',
    fullForm: '132 kV Gas Turbine Generator Unit 1',
    category: 'grid',
    plain: 'The local gas turbine keeping the substation energized in island mode while the main 220 kV tie breaker is open. It has a strict continuous and short-term MW ceiling.',
  },
  {
    id: 'cb-220-tie1',
    term: 'CB-220-TIE1',
    fullForm: '220 kV Main Grid Tie Circuit Breaker',
    category: 'grid',
    plain: 'The high-voltage breaker linking Suryanagar Substation to the wider regional 220 kV transmission grid. Closing it requires matching frequency, voltage, and phase via ANSI 25.',
  },
  {
    id: 'purdue-model',
    term: 'Purdue Model (L1 to L4)',
    fullForm: 'Industrial Network Security Zones (Levels 1 to 4)',
    category: 'security',
    plain: 'A layered firewall design separating physical field RTUs (L1), the control room (L3), the buffer DMZ (L3.5), and the corporate office network (L4) so office computers never reach live breakers.',
  },
  {
    id: 'passive-tap-pcap',
    term: 'Passive Tap & PCAP',
    fullForm: 'Read-Only Network Mirror & Packet Capture File',
    category: 'security',
    plain: 'A silent listen-only copy of real wire traffic saved as a .pcap file. Responders inspect PCAPs with tshark or IEC-104 Frames without disturbing active substation polling.',
  },
  {
    id: 'historian',
    term: 'Historian (L3.5 DMZ)',
    fullForm: 'Time-Series Process Data Archive',
    category: 'security',
    plain: 'A read-oriented database sitting in the DMZ buffer zone that stores historical voltage, frequency, and load logs so engineers can check what normal operation looked like.',
  },
  {
    id: 'replay-shim',
    term: 'Telemetry Replay Shim',
    fullForm: 'Malicious Screen-Blinding Proxy',
    category: 'security',
    plain: 'A hidden software layer planted in the control path that feeds old, healthy-looking numbers to operator screens while suppressing real outage alarms.',
  },
  {
    id: 'dispatch-soe',
    term: 'Dispatch & SOE',
    fullForm: 'Field Callout Log & Sequence of Events Recorder',
    category: 'security',
    plain: 'Dispatch holds real-time radio and phone reports from field engineers and city utilities. SOE is a millisecond-accurate black-box recorder showing the exact order relays tripped.',
  },
];

const CATEGORY_LABELS = [
  { id: 'all', label: 'All (24)' },
  { id: 'grid', label: 'Grid & Power' },
  { id: 'protocol', label: 'IEC-104 Protocol' },
  { id: 'security', label: 'Security & Desk' },
];

export class GlossaryController {
  constructor() {
    this.dialogEl = document.getElementById('glossary-dialog');
    this.searchEl = document.getElementById('glossary-search');
    this.catsEl = document.getElementById('glossary-cats');
    this.gridEl = document.getElementById('glossary-grid');
    this.closeBtn = document.getElementById('btn-glossary-close');
    this.category = 'all';
    this.query = '';
    this.highlightId = null;

    this._wire();
  }

  _wire() {
    if (!this.dialogEl) return;
    if (this.catsEl) {
      this.catsEl.replaceChildren();
      CATEGORY_LABELS.forEach((cat) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `subpill-btn${cat.id === 'all' ? ' is-active' : ''}`;
        btn.dataset.glossaryCat = cat.id;
        btn.textContent = cat.label;
        btn.addEventListener('click', () => {
          this.category = cat.id;
          this.highlightId = null;
          this._syncCatButtons();
          this.render();
        });
        this.catsEl.appendChild(btn);
      });
    }
    if (this.searchEl) {
      this.searchEl.addEventListener('input', () => {
        this.query = this.searchEl.value.trim().toLowerCase();
        this.highlightId = null;
        this.render();
      });
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
    this.dialogEl.addEventListener('click', (e) => {
      if (e.target === this.dialogEl) this.close();
    });
    this.render();
  }

  _syncCatButtons() {
    if (!this.catsEl) return;
    this.catsEl.querySelectorAll('[data-glossary-cat]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.glossaryCat === this.category);
    });
  }

  open(termId = null) {
    if (!this.dialogEl) return;
    this.highlightId = termId || null;
    if (termId) {
      this.category = 'all';
      this.query = '';
      if (this.searchEl) this.searchEl.value = '';
      this._syncCatButtons();
    }
    this.render();
    if (typeof this.dialogEl.showModal === 'function') {
      if (!this.dialogEl.open) this.dialogEl.showModal();
    } else {
      this.dialogEl.setAttribute('open', 'open');
    }
    if (termId && this.gridEl) {
      const target = this.gridEl.querySelector(`[data-term-id="${termId}"]`);
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    } else if (this.searchEl) {
      this.searchEl.focus();
    }
  }

  close() {
    if (!this.dialogEl) return;
    if (typeof this.dialogEl.close === 'function' && this.dialogEl.open) {
      this.dialogEl.close();
    } else {
      this.dialogEl.removeAttribute('open');
    }
  }

  render() {
    if (!this.gridEl) return;
    this.gridEl.replaceChildren();
    const q = this.query;
    const list = GLOSSARY_TERMS.filter((item) => {
      if (this.category !== 'all' && item.category !== this.category) return false;
      if (!q) return true;
      return item.term.toLowerCase().includes(q)
        || item.fullForm.toLowerCase().includes(q)
        || item.plain.toLowerCase().includes(q);
    });

    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'muted-empty';
      empty.textContent = 'No matching terms found. Try clearing your search.';
      this.gridEl.appendChild(empty);
      return;
    }

    list.forEach((item) => {
      const card = document.createElement('article');
      card.className = `glossary-card${this.highlightId === item.id ? ' is-highlighted' : ''}`;
      card.dataset.termId = item.id;

      const h3 = document.createElement('h3');
      h3.className = 'glossary-term';
      h3.textContent = item.term;

      const full = document.createElement('div');
      full.className = 'glossary-full';
      full.textContent = item.fullForm;

      const body = document.createElement('p');
      body.className = 'glossary-plain';
      body.textContent = item.plain;

      card.append(h3, full, body);
      this.gridEl.appendChild(card);
    });
  }

  dispose() {
    this.close();
  }
}
