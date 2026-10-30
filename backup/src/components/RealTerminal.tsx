import { apiWebSocketUrl } from '../lib/api';
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { RefreshCw, Terminal as TerminalIcon, Maximize2, Minimize2, CheckCircle2, AlertCircle, FileCode2, Loader2, SquareTerminal } from 'lucide-react';
import {
  isSafeFilename, opensFile, loadCommand, parseLoadOutput, parseSaveOutput, readDraft, saveCommands, writeDraft,
} from './terminalEditor';

const CodeEditorModal = lazy(() => import('./CodeEditorModal'));

type Capture = { mode: 'load' | 'save'; buffer: string; done: (output: string | null) => void; timer: number };

interface RealTerminalProps {
  labId?: string;
  levelNum?: number;
  token?: string;
  height?: string;
  className?: string;
  /** Called every time the user submits a command (presses Enter) */
  onCommand?: (cmd: string) => void | Promise<void>;
  /** Optional WebSocket path override. Auth token is appended automatically. */
  wsPath?: string;
  /** Optional terminal title override. */
  terminalTitle?: string;
  editor?: { file: string };
}

export const RealTerminal: React.FC<RealTerminalProps> = ({
  labId = 'puzzle-lab',
  levelNum = 0,
  token,
  height = '450px',
  className = '',
  onCommand,
  wsPath,
  terminalTitle,
  editor,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // Tracks the cancellation token of the current socket so stale async events are silenced
  const cancelTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  // Accumulates the current typed command line for objective detection
  const commandBufferRef = useRef<string>('');
  // Keep a stable ref to the onCommand callback so the onData closure is never stale
  const onCommandRef = useRef(onCommand);
  // Serialize objective callbacks. A pasted multi-line block can produce several
  // completed commands in a single xterm event; without a queue the parent may
  // still be processing the previous command and silently drop the next one.
  const commandDispatchRef = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);

  const dispatchTrackedCommand = useCallback((command: string) => {
    const cmd = command.trim();
    if (!cmd) return;
    commandDispatchRef.current = commandDispatchRef.current
      .then(async () => { await onCommandRef.current?.(cmd); })
      .catch((error) => { console.warn('[RealTerminal] command tracking failed:', error); });
  }, []);

  const editorFileRef = useRef(editor?.file ?? null);
  useEffect(() => { editorFileRef.current = editor?.file ?? null; }, [editor]);
  const captureRef = useRef<Capture | null>(null);
  const decoderRef = useRef(new TextDecoder());
  const [editorOffer, setEditorOffer] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorSession, setEditorSession] = useState<{ file: string; text: string; note?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fitTerminal = useCallback(() => {
    if (!fitAddonRef.current || !termInstanceRef.current) return;

    fitAddonRef.current.fit();
  }, []);

  const connectWebSocket = () => {
    // Cancel any previous socket's async events
    cancelTokenRef.current.cancelled = true;

    if (socketRef.current) {
      socketRef.current.close();
    }

    // New cancellation token for this socket — captured by the closures below.
    // Renamed to avoid shadowing the `token` prop (the actual auth token string),
    // which was previously never sent to the WebSocket due to the shadowing.
    const cancelToken = { cancelled: false };
    cancelTokenRef.current = cancelToken;

    setConnectionState('connecting');

    const basePath = wsPath || `/api/v1/terminal/ws/${labId}`;
    const [pathOnly, existingQuery = ''] = basePath.split('?', 2);
    const params = new URLSearchParams(existingQuery);
    if (!wsPath) params.set('level', String(levelNum));
    if (token) params.set('token', token);
    const query = params.toString();
    const wsUrl = apiWebSocketUrl(`${pathOnly}${query ? `?${query}` : ''}`);

    console.log('[RealTerminal] Connecting to WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => {
      if (cancelToken.cancelled) return;
      console.log('[RealTerminal] WebSocket Connected');
      setConnectionState('connected');

      if (termInstanceRef.current && fitAddonRef.current) {
        fitAddonRef.current.fit();
        termInstanceRef.current.focus();
        const rows = termInstanceRef.current.rows;
        const cols = termInstanceRef.current.cols;
        socket.send(JSON.stringify({ type: 'resize', rows, cols }));
      }
    };

    socket.onmessage = (event) => {
      if (cancelToken.cancelled) return;
      const capture = captureRef.current;
      if (capture) {
        capture.buffer += typeof event.data === 'string'
          ? event.data
          : decoderRef.current.decode(new Uint8Array(event.data as ArrayBuffer), { stream: true });
        const finished = capture.mode === 'load' ? parseLoadOutput(capture.buffer) !== null : parseSaveOutput(capture.buffer) !== null;
        if (finished) {
          window.clearTimeout(capture.timer);
          captureRef.current = null;
          capture.done(capture.buffer);
        }
        return;
      }
      if (termInstanceRef.current) {
        if (typeof event.data === 'string') {
          termInstanceRef.current.write(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          const buffer = new Uint8Array(event.data);
          termInstanceRef.current.write(buffer);
        }
      }
    };

    socket.onerror = () => {
      if (cancelToken.cancelled) return;
      setConnectionState('error');
    };

    socket.onclose = () => {
      if (cancelToken.cancelled) return;
      setConnectionState('disconnected');
    };
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Fira Code, Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#0B0F17',
        foreground: '#F3F4F6',
        cursor: '#38BDF8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#1F2937',
        red: '#EF4444',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#3B82F6',
        magenta: '#EC4899',
        cyan: '#06B6D4',
        white: '#F9FAFB',
        brightBlack: '#4B5563',
        brightRed: '#F87171',
        brightGreen: '#34D399',
        brightYellow: '#FBBF24',
        brightBlue: '#60A5FA',
        brightMagenta: '#F472B6',
        brightCyan: '#22D3EE',
        brightWhite: '#FFFFFF',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;
    const resizeDisposable = term.onResize(({ rows, cols }) => {
      if (
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(
          JSON.stringify({
            type: 'resize',
            rows,
            cols,
          }),
        );
      }
    });

    // Auto-focus terminal on mount
    term.focus();

    // Forward xterm input to WebSocket; also track command buffer for objective detection
    term.onData((data) => {
      const editorFile = editorFileRef.current;
      if ((data === '\r' || data === '\n') && editorFile && term.buffer.active.type === 'normal'
          && opensFile(commandBufferRef.current, editorFile)) {
        setEditorOffer(true);
        return;
      }
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(data);
      }

      // Track the input stream character-by-character. xterm may deliver a
      // paste (including its trailing Enter) as one multi-character chunk, so
      // comparing the whole event with "\r"/"\n" misses real commands.
      // Strip CSI wrappers such as bracketed-paste and arrow-key sequences from
      // the tracking copy only; the original bytes were already sent to the PTY.
      const trackingData = data.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
      for (const char of trackingData) {
        if (char === '\r' || char === '\n') {
          dispatchTrackedCommand(commandBufferRef.current);
          commandBufferRef.current = '';
        } else if (char === '\x7f' || char === '\b') {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
        } else if (char === '\x15' || char === '\x03') {
          // Ctrl-U / Ctrl-C clear the in-progress shell line.
          commandBufferRef.current = '';
        } else if (char === '\x17') {
          // Ctrl-W removes the previous shell word.
          commandBufferRef.current = commandBufferRef.current.replace(/\S+\s*$/, '');
        } else if (char.charCodeAt(0) >= 32) {
          commandBufferRef.current += char;
        }
      }
    });

    connectWebSocket();

    const handleResize = () => {
      fitTerminal();
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        fitTerminal();
      });
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      // Cancel the current socket's async events before closing
      cancelTokenRef.current.cancelled = true;
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      resizeDisposable.dispose();
      if (socketRef.current) {
        socketRef.current.close();
      }
      term.dispose();
    };
  }, [labId, levelNum, token, wsPath]);

  const sendRaw = (data: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) socketRef.current.send(data);
  };

  const runCaptured = (mode: 'load' | 'save', lines: string[], timeoutMs: number): Promise<string | null> =>
    new Promise((resolve) => {
      if (captureRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }
      const finish = (output: string | null) => {
        termInstanceRef.current?.write(`\r\n\x1b[2m[editor] ${mode === 'load' ? 'opened the file' : 'saved the file'}\x1b[0m\r\n`);
        sendRaw('\r');
        resolve(output);
      };
      const timer = window.setTimeout(() => {
        captureRef.current = null;
        finish(null);
      }, timeoutMs);
      captureRef.current = { mode, buffer: '', done: finish, timer };
      lines.forEach(sendRaw);
    });

  const openEditor = async (file: string) => {
    if (!isSafeFilename(file) || editorBusy) return;
    setEditorBusy(true);
    setSaveMessage(null);
    const output = await runCaptured('load', [loadCommand(file)], 5000);
    const fromWorkspace = output === null ? null : parseLoadOutput(output);
    const draft = readDraft(labId, file);
    let text = fromWorkspace ?? '';
    let note: string | undefined;
    if (fromWorkspace === null) {
      text = draft ?? '';
      note = 'Could not read the file through the terminal (is a program still running there?). Showing your last draft.';
    } else if (!fromWorkspace && draft) {
      text = draft;
      note = 'The file is empty or new in your workspace. Showing your last unsaved draft.';
    }
    setEditorSession({ file, text, note });
    setEditorBusy(false);
  };

  const saveEditor = async (text: string) => {
    if (!editorSession || saving) return;
    writeDraft(labId, editorSession.file, text);
    setSaving(true);
    const output = await runCaptured('save', saveCommands(editorSession.file, text, Math.random().toString(36).slice(2, 10)), 15000);
    const result = output === null ? null : parseSaveOutput(output);
    setSaving(false);
    setSaveMessage(result === 'saved'
      ? `Saved ~/${editorSession.file} at ${new Date().toLocaleTimeString()}. Submit it from any folder with: submit ~/${editorSession.file}`
      : result === 'failed'
        ? 'Could not save: check that the folder exists and the name is right.'
        : 'No reply from the terminal. Is a program still running there? Your draft is kept.');
  };

  const closeEditor = () => {
    setEditorSession(null);
    termInstanceRef.current?.focus();
  };

  const answerOffer = (open: boolean) => {
    setEditorOffer(false);
    if (open && editor) {
      sendRaw('\x15');
      commandBufferRef.current = '';
      void openEditor(editor.file);
      return;
    }
    sendRaw('\r');
    const cmd = commandBufferRef.current.trim();
    commandBufferRef.current = '';
    dispatchTrackedCommand(cmd);
    termInstanceRef.current?.focus();
  };

  useEffect(() => {
    const capture = captureRef;
    return () => {
      if (capture.current) window.clearTimeout(capture.current.timer);
      capture.current = null;
    };
  }, []);

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0B0F17] shadow-xl ${isFullscreen ? 'fixed inset-4 z-50' : ''
        } ${className}`}
    >
      {/* Terminal Header */}
      <div className="h-10 bg-[#111827] px-4 flex items-center justify-between border-b border-slate-800 select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 pl-2">
            <TerminalIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>
              {terminalTitle || (labId === 'lab1-recon'
                ? 'SecureGuard Red Team — Kali Linux Shell'
                : `Puzzle Infrastructure Shell — Level ${levelNum} (student${levelNum})`)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Badge */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
            {connectionState === 'connected' && (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/40">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            )}
            {connectionState === 'connecting' && (
              <span className="flex items-center gap-1 text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-800/40">
                <RefreshCw className="w-3 h-3 animate-spin" /> Connecting PTY...
              </span>
            )}
            {(connectionState === 'disconnected' || connectionState === 'error') && (
              <span className="flex items-center gap-1 text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-800/40">
                <AlertCircle className="w-3 h-3" /> Disconnected
              </span>
            )}
          </div>

          {/* One button in one place switches between the terminal and the editor. */}
          {editor && (
            <button
              type="button"
              onClick={() => { if (editorSession) closeEditor(); else void openEditor(editor.file); }}
              disabled={!editorSession && (editorBusy || connectionState !== 'connected')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
              title={editorSession
                ? 'Back to the terminal (your draft is kept)'
                : `Open ~/${editor.file}, the file this challenge grades, in the code editor`}
            >
              {editorSession ? (
                <><SquareTerminal className="h-3.5 w-3.5" />Back to terminal</>
              ) : (
                <>
                  {editorBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCode2 className="h-3.5 w-3.5" />}
                  Edit <span className="hidden font-mono sm:inline">{editor.file}</span>
                </>
              )}
            </button>
          )}

          {/* Reconnect Button */}
          <button
            onClick={connectWebSocket}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Reconnect Terminal Session"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Fullscreen */}
          <button
            onClick={() => {
              setIsFullscreen((current) => !current);
            }}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Terminal'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {editorOffer && editor && (
        <div
          className="fade-in absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4"
          onKeyDown={(event) => { if (event.key === 'Escape') answerOffer(false); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="editor-offer-title"
               className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5 text-sm text-slate-300 shadow-2xl">
            <h3 id="editor-offer-title" className="font-semibold text-white">
              Open <code className="font-mono">{editor.file}</code> in the code editor?
            </h3>
            <p className="mt-2 leading-6">
              It saves to <code className="font-mono text-slate-100">~/{editor.file}</code>, the file this challenge
              grades, and keeps Python indentation tidy.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => answerOffer(false)}
                      className="rounded-full px-3.5 py-1.5 font-medium text-slate-300 hover:bg-white/5 hover:text-white">
                Stay in the terminal
              </button>
              <button type="button" autoFocus onClick={() => answerOffer(true)}
                      className="rounded-full bg-white px-3.5 py-1.5 font-semibold text-slate-900 hover:bg-slate-200">
                Open in editor
              </button>
            </div>
          </div>
        </div>
      )}

      {editorSession && (
        <Suspense fallback={null}>
          <CodeEditorModal
            filename={editorSession.file}
            initialText={editorSession.text}
            note={editorSession.note}
            saving={saving}
            saveMessage={saveMessage}
            onSave={(text) => { void saveEditor(text); }}
            onChange={(text) => writeDraft(labId, editorSession.file, text)}
            onClose={closeEditor}
          />
        </Suspense>
      )}

      {/* Terminal Viewport */}
      <div
        ref={terminalRef}
        onClick={() => termInstanceRef.current?.focus()}
        style={{ height: isFullscreen ? 'calc(100% - 40px)' : height }}
        className="w-full p-2 bg-[#0B0F17] overflow-hidden cursor-text"
      />
    </div>
  );
};
