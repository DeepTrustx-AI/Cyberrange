export class PtyTerminal {
  constructor(hostEl, statusEl, onStatusChange, onEnter, options = {}) {
    this.hostEl = hostEl;
    this.statusEl = statusEl;
    this.onStatusChange = onStatusChange || (() => {});
    this.onEnter = onEnter || (() => {});
    this.TerminalCtor = options.TerminalCtor || null;
    this.FitAddonCtor = options.FitAddonCtor || null;
    this.term = null;
    this.fitAddon = null;
    this.ws = null;
    this.wsUrl = null;
    this.retryDelayMs = 4000;
    this.retryTimer = null;
    this.connectTimer = null;
    this.disposed = false;
    this.connected = false;
    this._ro = null;
    this._fitScheduled = false;
    this._writeQueue = [];
    this._writeRaf = null;
    this._onWindowResize = () => this.scheduleFit();
    this._onPageUnload = () => this._closeSocketCleanly(true);
  }

  mount() {
    const TermCtor = this.TerminalCtor || (typeof window !== 'undefined' ? window.Terminal : null);
    if (!this.hostEl || typeof TermCtor !== 'function') {
      this._setStatus('disconnected', 'Terminal unavailable');
      return false;
    }

    const term = new TermCtor({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.28,
      scrollback: 2500,
      theme: {
        background: '#0C0E14',
        foreground: '#F2F4F7',
        cursor: '#38BDF8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#262832',
        red: '#EF4444',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#F2A47A',
        magenta: '#EC4899',
        cyan: '#06B6D4',
        white: '#F9FAFB',
        brightBlack: '#4B5563',
        brightRed: '#F87171',
        brightGreen: '#34D399',
        brightYellow: '#FBBF24',
        brightBlue: '#83E8C3',
        brightMagenta: '#F472B6',
        brightCyan: '#22D3EE',
        brightWhite: '#FFFFFF',
      },
    });

    const FitCtor = this.FitAddonCtor || (typeof window !== 'undefined' && window.FitAddon && window.FitAddon.FitAddon);
    if (FitCtor) {
      this.fitAddon = new FitCtor();
      term.loadAddon(this.fitAddon);
    }

    term.open(this.hostEl);
    this.term = term;
    this.fit();

    term.onData((data) => {
      if (typeof data === 'string' && data.includes('\r')) {
        this.onEnter();
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(data);
      }
    });

    term.onResize(({ rows, cols }) => {
      this._sendResize(rows, cols);
    });

    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(() => {
        this.scheduleFit();
      });
      this._ro.observe(this.hostEl);
    }

    window.addEventListener('resize', this._onWindowResize, { passive: true });
    window.addEventListener('beforeunload', this._onPageUnload);
    window.addEventListener('pagehide', this._onPageUnload);
    return true;
  }

  scheduleFit() {
    if (this._fitScheduled || this.disposed) return;
    this._fitScheduled = true;
    requestAnimationFrame(() => {
      this._fitScheduled = false;
      this.fit();
    });
  }

  fit() {
    if (!this.fitAddon || !this.term || !this.hostEl || this.hostEl.offsetParent === null) return;
    try {
      this.fitAddon.fit();
    } catch {
    }
  }

  focus() {
    if (this.term) this.term.focus();
  }

  getSelection() {
    if (!this.term) return '';
    return String(this.term.getSelection() || '').trim();
  }

  _enqueueWrite(chunk) {
    if (!this.term || this.disposed) return;
    this._writeQueue.push(chunk);
    if (this._writeRaf) return;
    this._writeRaf = requestAnimationFrame(() => {
      this._writeRaf = null;
      this._flushWrites();
    });
  }

  _flushWrites() {
    if (!this.term || !this._writeQueue.length) return;
    const queue = this._writeQueue;
    this._writeQueue = [];
    let strBuf = '';
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (typeof item === 'string') {
        strBuf += item;
      } else {
        if (strBuf) {
          this.term.write(strBuf);
          strBuf = '';
        }
        this.term.write(item);
      }
    }
    if (strBuf) this.term.write(strBuf);
  }

  _sendResize(rows, cols) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && rows > 0 && cols > 0) {
      this.ws.send(JSON.stringify({ type: 'resize', rows, cols }));
    }
  }

  _setStatus(kind, text) {
    this.connected = kind === 'connected';
    if (this.statusEl) {
      this.statusEl.textContent = text;
      this.statusEl.dataset.conn = kind;
    }
    this.onStatusChange(kind, text);
  }

  _closeSocketCleanly(isUnload = false) {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const old = this.ws;
    this.ws = null;
    if (!old) return;
    old.onopen = null;
    old.onmessage = null;
    old.onerror = null;
    old.onclose = null;
    if (old.readyState === WebSocket.OPEN) {
      try {
        old.close(1000, isUnload ? 'page unload' : 'closing');
      } catch {
      }
    } else if (old.readyState === WebSocket.CONNECTING) {
      if (isUnload) {
        try {
          old.close(1000, 'page unload');
        } catch {
        }
      } else {
        old.onopen = () => {
          try {
            old.close(1000, 'closing');
          } catch {
          }
        };
      }
    }
  }

  connect(wsUrl) {
    if (this.disposed) return;
    if (wsUrl) this.wsUrl = wsUrl;
    if (!this.wsUrl) {
      this._setStatus('disconnected', 'Not connected');
      return;
    }

    this._closeSocketCleanly(false);
    this._setStatus('connecting', 'Connecting...');

    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (this.disposed || !this.wsUrl) return;
      let sock;
      try {
        sock = new WebSocket(this.wsUrl);
      } catch {
        this._scheduleRetry();
        return;
      }
      sock.binaryType = 'arraybuffer';
      this.ws = sock;

      sock.onopen = () => {
        if (this.ws !== sock || this.disposed) {
          try { sock.close(1000, 'stale'); } catch {}
          return;
        }
        this.retryDelayMs = 4000;
        this._setStatus('connected', 'Connected');
        this.fit();
        if (this.term) {
          this._sendResize(this.term.rows, this.term.cols);
        }
      };

      sock.onmessage = (ev) => {
        if (this.ws !== sock || !this.term || this.disposed) return;
        if (typeof ev.data === 'string') {
          this._enqueueWrite(ev.data);
        } else if (ev.data instanceof ArrayBuffer) {
          this._enqueueWrite(new Uint8Array(ev.data));
        }
      };

      sock.onerror = () => {
        if (this.ws !== sock || this.disposed) return;
        this._setStatus('disconnected', 'Not connected');
      };

      sock.onclose = () => {
        if (this.ws !== sock || this.disposed) return;
        this.ws = null;
        this._setStatus('disconnected', 'Not connected');
        this._scheduleRetry();
      };
    }, 0);
  }

  reconnectNow() {
    this.retryDelayMs = 1000;
    this.connect(this.wsUrl);
  }

  _scheduleRetry() {
    if (this.disposed || this.retryTimer || !this.wsUrl) return;
    const delay = this.retryDelayMs;
    this.retryDelayMs = Math.min(15000, Math.round(this.retryDelayMs * 1.8));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect(this.wsUrl);
    }, delay);
  }

  dispose() {
    this.disposed = true;
    this._closeSocketCleanly(false);
    if (this._writeRaf) {
      cancelAnimationFrame(this._writeRaf);
      this._writeRaf = null;
    }
    this._writeQueue = [];
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    window.removeEventListener('resize', this._onWindowResize);
    window.removeEventListener('beforeunload', this._onPageUnload);
    window.removeEventListener('pagehide', this._onPageUnload);
    if (this.term) {
      try {
        this.term.dispose();
      } catch {
      }
      this.term = null;
    }
    this.fitAddon = null;
  }
}
