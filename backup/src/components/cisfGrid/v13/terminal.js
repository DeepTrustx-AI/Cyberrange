const MAX_WRITE_QUEUE_BYTES = 512 * 1024;
const PING_INTERVAL_MS = 25_000;
const WATCHDOG_INTERVAL_MS = 10_000;
const STALE_RX_TIMEOUT_MS = 60_000;

export class PtyTerminal {
  constructor(hostEl, statusEl, onStatusChange, onEnter, options = {}) {
    this.hostEl = hostEl;
    this.statusEl = statusEl;
    this.onStatusChange = onStatusChange || (() => {});
    this.onEnter = onEnter || (() => {});
    this.TerminalCtor = options.TerminalCtor || null;
    this.FitAddonCtor = options.FitAddonCtor || null;
    this.getWsUrl = typeof options.getWsUrl === 'function' ? options.getWsUrl : null;
    this.term = null;
    this.fitAddon = null;
    this.ws = null;
    this.wsUrl = null;
    this.retryDelayMs = 4000;
    this.retryTimer = null;
    this.connectTimer = null;
    this.pingTimer = null;
    this.watchdogTimer = null;
    this._hiddenDrainTimer = null;
    this.connectSeq = 0;
    this.lastRxAt = 0;
    this.disposed = false;
    this.connected = false;
    this._ro = null;
    this._fitScheduled = false;
    this._writeQueue = [];
    this._writeQueueBytes = 0;
    this._writeRaf = null;
    this._onWindowResize = () => this.scheduleFit();
    this._onPageUnload = () => this._closeSocketCleanly(true);
    this._onOnline = () => this.handleNetworkOnline();
    this._onOffline = () => {
      if (this.disposed) return;
      this._setStatus('disconnected', 'Offline');
    };
    this._onVisibilityChange = () => {
      if (this.disposed) return;
      if (!document.hidden) {
        if (this._writeQueue.length) this._flushWrites();
        this.scheduleFit();
        const stale = this.lastRxAt > 0 && Date.now() - this.lastRxAt > STALE_RX_TIMEOUT_MS;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || stale) {
          this.retryDelayMs = 1000;
          void this.connect();
        } else {
          this._sendPing();
        }
      }
    };
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
    window.addEventListener('online', this._onOnline);
    window.addEventListener('offline', this._onOffline);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    return true;
  }

  handleNetworkOnline() {
    if (this.disposed) return;
    this.retryDelayMs = 1000;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      void this.connect();
    } else {
      this._sendPing();
    }
  }

  scheduleFit() {
    if (this._fitScheduled || this.disposed) return;
    this._fitScheduled = true;
    requestAnimationFrame(() => {
      this._fitScheduled = false;
      if (!this.disposed) this.fit();
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

  _chunkBytes(chunk) {
    if (typeof chunk === 'string') return chunk.length * 2;
    if (chunk instanceof Uint8Array) return chunk.byteLength;
    return 0;
  }

  _enqueueWrite(chunk) {
    if (!this.term || this.disposed) return;
    const sz = this._chunkBytes(chunk);
    this._writeQueue.push(chunk);
    this._writeQueueBytes += sz;
    while (this._writeQueueBytes > MAX_WRITE_QUEUE_BYTES && this._writeQueue.length > 1) {
      const dropped = this._writeQueue.shift();
      this._writeQueueBytes = Math.max(0, this._writeQueueBytes - this._chunkBytes(dropped));
    }
    if (typeof document !== 'undefined' && document.hidden) {
      if (!this._hiddenDrainTimer) {
        this._hiddenDrainTimer = setTimeout(() => {
          this._hiddenDrainTimer = null;
          if (!this.disposed) this._flushWrites();
        }, 100);
      }
      return;
    }
    if (this._writeRaf) return;
    this._writeRaf = requestAnimationFrame(() => {
      this._writeRaf = null;
      if (!this.disposed) this._flushWrites();
    });
  }

  _flushWrites() {
    if (!this.term || !this._writeQueue.length) return;
    const queue = this._writeQueue;
    this._writeQueue = [];
    this._writeQueueBytes = 0;

    let strBuf = '';
    let binParts = [];
    let binBytes = 0;

    const flushStr = () => {
      if (!strBuf) return;
      this.term.write(strBuf);
      strBuf = '';
    };

    const flushBin = () => {
      if (!binParts.length) return;
      if (binParts.length === 1) {
        this.term.write(binParts[0]);
      } else {
        const merged = new Uint8Array(binBytes);
        let offset = 0;
        for (let j = 0; j < binParts.length; j++) {
          merged.set(binParts[j], offset);
          offset += binParts[j].byteLength;
        }
        this.term.write(merged);
      }
      binParts = [];
      binBytes = 0;
    };

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (typeof item === 'string') {
        flushBin();
        strBuf += item;
      } else if (item instanceof Uint8Array) {
        flushStr();
        binParts.push(item);
        binBytes += item.byteLength;
      } else {
        flushStr();
        flushBin();
        this.term.write(item);
      }
    }
    flushStr();
    flushBin();
  }

  _sendResize(rows, cols) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && rows > 0 && cols > 0) {
      this.ws.send(JSON.stringify({ type: 'resize', rows, cols }));
    }
  }

  _sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      } catch {
      }
    }
  }

  _stopKeepalive() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  _startKeepalive(sock) {
    this._stopKeepalive();
    this.lastRxAt = Date.now();
    this.pingTimer = setInterval(() => {
      if (this.disposed || this.ws !== sock || sock.readyState !== WebSocket.OPEN) return;
      this._sendPing();
    }, PING_INTERVAL_MS);
    this.watchdogTimer = setInterval(() => {
      if (this.disposed || this.ws !== sock || sock.readyState !== WebSocket.OPEN) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (this.lastRxAt > 0 && Date.now() - this.lastRxAt > STALE_RX_TIMEOUT_MS) {
        this._setStatus('disconnected', 'Reconnecting...');
        this.retryDelayMs = 1000;
        void this.connect();
      }
    }, WATCHDOG_INTERVAL_MS);
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
    this._stopKeepalive();
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

  async _resolveTargetUrl(wsUrlOrProvider) {
    if (typeof wsUrlOrProvider === 'function') {
      this.getWsUrl = wsUrlOrProvider;
    } else if (typeof wsUrlOrProvider === 'string' && wsUrlOrProvider) {
      this.wsUrl = wsUrlOrProvider;
    }
    if (this.getWsUrl) {
      try {
        const fresh = await this.getWsUrl();
        if (fresh) {
          this.wsUrl = fresh;
          return fresh;
        }
      } catch {
        return null;
      }
    }
    return this.wsUrl;
  }

  async connect(wsUrlOrProvider) {
    if (this.disposed) return;
    if (typeof wsUrlOrProvider === 'function') {
      this.getWsUrl = wsUrlOrProvider;
    } else if (typeof wsUrlOrProvider === 'string' && wsUrlOrProvider) {
      this.wsUrl = wsUrlOrProvider;
    }
    if (!this.getWsUrl && !this.wsUrl) {
      this._setStatus('disconnected', 'Not connected');
      return;
    }

    const seq = ++this.connectSeq;
    this._closeSocketCleanly(false);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._setStatus('disconnected', 'Offline');
      return;
    }
    this._setStatus('connecting', 'Connecting...');

    const targetUrl = await this._resolveTargetUrl();
    if (this.disposed || seq !== this.connectSeq) return;
    if (!targetUrl) {
      this._setStatus('disconnected', 'Not connected');
      this._scheduleRetry();
      return;
    }

    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (this.disposed || seq !== this.connectSeq) return;
      let sock;
      try {
        sock = new WebSocket(targetUrl);
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
        this._startKeepalive(sock);
        this.fit();
        if (this.term) {
          this._sendResize(this.term.rows, this.term.cols);
        }
      };

      sock.onmessage = (ev) => {
        if (this.ws !== sock || !this.term || this.disposed) return;
        this.lastRxAt = Date.now();
        if (typeof ev.data === 'string') {
          if (ev.data.length <= 64 && ev.data.startsWith('{') && ev.data.includes('"pong"')) {
            try {
              const parsed = JSON.parse(ev.data);
              if (parsed && parsed.type === 'pong') return;
            } catch {
            }
          }
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
        this._stopKeepalive();
        this.ws = null;
        this._setStatus('disconnected', 'Not connected');
        this._scheduleRetry();
      };
    }, 0);
  }

  reconnectNow() {
    this.retryDelayMs = 1000;
    void this.connect();
  }

  _scheduleRetry() {
    if (this.disposed || this.retryTimer || (!this.getWsUrl && !this.wsUrl)) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const delay = this.retryDelayMs;
    this.retryDelayMs = Math.min(15000, Math.round(this.retryDelayMs * 1.8));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  dispose() {
    this.disposed = true;
    this.connectSeq += 1;
    this._closeSocketCleanly(false);
    if (this._writeRaf) {
      cancelAnimationFrame(this._writeRaf);
      this._writeRaf = null;
    }
    if (this._hiddenDrainTimer) {
      clearTimeout(this._hiddenDrainTimer);
      this._hiddenDrainTimer = null;
    }
    this._writeQueue = [];
    this._writeQueueBytes = 0;
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    window.removeEventListener('resize', this._onWindowResize);
    window.removeEventListener('beforeunload', this._onPageUnload);
    window.removeEventListener('pagehide', this._onPageUnload);
    window.removeEventListener('online', this._onOnline);
    window.removeEventListener('offline', this._onOffline);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
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
