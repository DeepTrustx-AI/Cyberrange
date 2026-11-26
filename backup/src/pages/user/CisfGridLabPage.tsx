import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileCode2,
  FileText,
  HelpCircle,
  Lightbulb,
  Loader2,
  PhoneCall,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
  Square,
  SquareTerminal,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RealTerminal } from '../../components/RealTerminal';
import { Mascot } from '../../components/mascot/Mascot';
import { SegmentedBar } from '../../components/ui/SegmentedBar';
import { CisfGridCodeEditor } from '../../components/cisfGrid/CisfGridCodeEditor';
import { CisfGridStage } from '../../components/cisfGrid/CisfGridStage';
import { CisfGridTour } from '../../components/cisfGrid/CisfGridTour';
import { CisfGridApiError, createCisfGridApi } from '../../components/cisfGrid/api';
import {
  CISF_GRID_ACTS,
  CISF_GRID_MODULES,
  FULL_OP_MODULE,
  type CaseSummary,
  type CheckStatusResponse,
  type CisfGridMode,
  type DispatchEntry,
  type EmsTelemetryState,
  type HintResponse,
  type NotesState,
  type SessionInfo,
  type ShiftReportResponse,
  type TourPrefsState,
} from '../../components/cisfGrid/types';
import { useAuth } from '../../context';

type MissionTab = 'brief' | 'dispatch' | 'checks' | 'case' | 'notes' | 'report';
type RightPaneTab = 'terminal' | 'editor';

function parseAssignmentId(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

export const CisfGridLabPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = parseAssignmentId(searchParams.get('assignment_id'));
  const { apiFetch, token } = useAuth();
  const api = useMemo(() => createCisfGridApi(apiFetch), [apiFetch]);

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [launchMode, setLaunchMode] = useState<CisfGridMode>('modules');
  const [loadingSession, setLoadingSession] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  const [pausedNotice, setPausedNotice] = useState('');

  const [activeModuleId, setActiveModuleId] = useState<string>('m01');
  const [missionTab, setMissionTab] = useState<MissionTab>('brief');
  const [rightTab, setRightTab] = useState<RightPaneTab>('terminal');
  const [editorFile, setEditorFile] = useState<string>('station_inventory.json');

  const [telemetry, setTelemetry] = useState<EmsTelemetryState | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'disconnected'>('disconnected');
  const [wsNonce, setWsNonce] = useState(0);

  const [dispatchFeed, setDispatchFeed] = useState<DispatchEntry[]>([]);
  const [bayBusy, setBayBusy] = useState<string | null>(null);

  const [cases, setCases] = useState<Record<string, CaseSummary>>({});
  const [passedModules, setPassedModules] = useState<string[]>([]);
  const [shiftReport, setShiftReport] = useState<ShiftReportResponse | null>(null);

  const [hintsByMod, setHintsByMod] = useState<Record<string, Record<number, HintResponse>>>({});
  const [confirmL3Open, setConfirmL3Open] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);

  const [practiceResult, setPracticeResult] = useState<CheckStatusResponse | null>(null);
  const [practiceBusy, setPracticeBusy] = useState(false);

  const [verifyState, setVerifyState] = useState<CheckStatusResponse | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  const [notes, setNotes] = useState<NotesState>({ text: '', pins: [], updated_utc: null });
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedMsg, setNotesSavedMsg] = useState('');

  const [tourPrefs, setTourPrefs] = useState<TourPrefsState>({
    cold_open_seen: false,
    tour_seen: false,
    dismissed_tips: [],
  });
  const [tourOpen, setTourOpen] = useState(false);

  const activeCheckRef = useRef<{ checkId: string; moduleId: string } | null>(null);
  const moduleSwitchSeqRef = useRef(0);
  const initialModuleSyncedRef = useRef(false);
  const evalTokenRef = useRef<string>('');
  const evalTokenExpiryRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      activeCheckRef.current = null;
      moduleSwitchSeqRef.current += 1;
    };
  }, []);

  const isStoppedUnexpectedly = Boolean(session && (session.status === 'failed' || session.stopped_unexpectedly));
  const isRunning = session?.status === 'running' && Boolean(session.urls?.terminal) && !stopping;
  const isStoppingUnexpectedly = isStoppedUnexpectedly && session?.status === 'stopping';
  const isPreparing = Boolean(
    session && !isRunning && !isStoppedUnexpectedly && !['stopped', 'failed'].includes(session.status),
  );

  const currentModule = useMemo(() => {
    if (session?.session.mode === 'full_op' || activeModuleId === 'full_op') {
      return FULL_OP_MODULE;
    }
    return CISF_GRID_MODULES.find((m) => m.id === activeModuleId) ?? CISF_GRID_MODULES[0];
  }, [activeModuleId, session?.session.mode]);

  const applySessionPayload = useCallback((payload: SessionInfo | null) => {
    setSession(payload);
    if (!payload) {
      evalTokenRef.current = '';
      evalTokenExpiryRef.current = 0;
      return;
    }
    if (payload.eval_token) {
      evalTokenRef.current = payload.eval_token;
      const exp = payload.eval_token_expires_at ? Date.parse(payload.eval_token_expires_at) : Date.now() + 25 * 60_000;
      evalTokenExpiryRef.current = Number.isNaN(exp) ? Date.now() + 25 * 60_000 : exp;
    }
    if (payload.session.mode === 'full_op') {
      setActiveModuleId('full_op');
      setEditorFile('handover_brief.json');
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<SessionInfo | null> => {
    try {
      const current = await api.getCurrentSession(assignmentId);
      setPausedNotice('');
      setError('');
      applySessionPayload(current);
      return current;
    } catch (err) {
      if (err instanceof CisfGridApiError && err.status === 409) {
        setPausedNotice(err.message);
        return null;
      }
      if (err instanceof CisfGridApiError && err.status === 503) {
        setError(err.message);
        return null;
      }
      setError(err instanceof Error ? err.message : 'Could not check CISF OT Grid session.');
      return null;
    } finally {
      setLoadingSession(false);
    }
  }, [api, applySessionPayload, assignmentId]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Poll while session is queued, provisioning, or finalizing an unexpected stop.
  useEffect(() => {
    if (!isPreparing && !isStoppingUnexpectedly) return;
    const timer = window.setInterval(() => {
      void refreshSession();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isPreparing, isStoppingUnexpectedly, refreshSession]);

  // Periodically check health of a running session so a stopped lab is caught within 30 s.
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      void refreshSession();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [isRunning, refreshSession]);

  // Load persisted tour preferences and notes on mount.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const prefs = await api.getTourPrefs();
        if (!active) return;
        setTourPrefs(prefs);
        if (!prefs.tour_seen) setTourOpen(true);
      } catch {
        // Non-fatal: tour stays optional if preferences fail to load.
      }
      try {
        const loadedNotes = await api.getNotes(assignmentId);
        if (active) setNotes(loadedNotes);
      } catch {
        // Non-fatal before launch or without entitlement.
      }
    })();
    return () => {
      active = false;
    };
  }, [api, assignmentId]);

  const loadCaseAndDispatch = useCallback(async () => {
    if (!isRunning) return;
    try {
      const cb = await api.getCaseBoard(assignmentId);
      setCases(cb.cases ?? {});
      setPassedModules(cb.passed_modules ?? []);
      if ((cb.passed_modules ?? []).includes('m10')) {
        const sr = await api.getShiftReport(assignmentId);
        if (sr) setShiftReport(sr);
      }
    } catch (err) {
      if (err instanceof CisfGridApiError && (err.status === 409 || err.status === 502)) {
        void refreshSession();
      }
    }
    try {
      const entries = await api.getDispatch();
      setDispatchFeed(entries);
    } catch (err) {
      if (err instanceof CisfGridApiError && (err.status === 409 || err.status === 502)) {
        void refreshSession();
      }
    }
  }, [api, assignmentId, isRunning, refreshSession]);

  useEffect(() => {
    if (!isRunning) return;
    void loadCaseAndDispatch();
  }, [isRunning, loadCaseAndDispatch]);

  // Live-only EMS telemetry WebSocket via canonical apiWebSocketUrl.
  useEffect(() => {
    if (!isRunning) {
      setWsStatus('disconnected');
      setTelemetry(null);
      return;
    }

    let cancelled = false;
    let connectTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const closeSocketCleanly = (isUnload = false) => {
      if (connectTimer !== null) {
        window.clearTimeout(connectTimer);
        connectTimer = null;
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const sock = socket;
      socket = null;
      if (!sock) return;
      sock.onopen = null;
      sock.onmessage = null;
      sock.onerror = null;
      sock.onclose = null;
      if (sock.readyState === WebSocket.OPEN) {
        try {
          sock.close(1000, isUnload ? 'page unload' : 'closing');
        } catch {
          // Ignore closing errors.
        }
      } else if (sock.readyState === WebSocket.CONNECTING) {
        if (isUnload) {
          try {
            sock.close(1000, 'page unload');
          } catch {
            // Ignore unload close errors.
          }
        } else {
          sock.onopen = () => {
            try {
              sock.close(1000, 'closing');
            } catch {
              // Ignore detached close errors.
            }
          };
        }
      }
    };

    const connect = () => {
      if (cancelled) return;
      setWsStatus('connecting');
      const wsUrl = api.emsWebSocketUrl(token);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (!cancelled) setWsStatus('live');
      };

      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(String(event.data)) as { type?: string; state?: Partial<EmsTelemetryState> };
          if (msg.type === 'snapshot' && msg.state) {
            setTelemetry(msg.state as EmsTelemetryState);
            if (Array.isArray(msg.state.passed_modules) && msg.state.passed_modules.length > 0) {
              const incoming = msg.state.passed_modules;
              setPassedModules((prev) => Array.from(new Set([...prev, ...incoming])));
            }
            if (!initialModuleSyncedRef.current && typeof msg.state.module_id === 'string') {
              const liveMod = msg.state.module_id;
              const matched = liveMod === 'full_op'
                ? FULL_OP_MODULE
                : CISF_GRID_MODULES.find((m) => m.id === liveMod);
              if (matched) {
                initialModuleSyncedRef.current = true;
                setActiveModuleId(matched.id);
                setEditorFile(matched.artifact);
              }
            }
          } else if (msg.type === 'delta' && msg.state) {
            setTelemetry((prev) => ({ ...(prev ?? {}), ...msg.state }));
            if (Array.isArray(msg.state.passed_modules) && msg.state.passed_modules.length > 0) {
              const incoming = msg.state.passed_modules;
              setPassedModules((prev) => Array.from(new Set([...prev, ...incoming])));
            }
          }
        } catch {
          // Ignore non-JSON heartbeat frames.
        }
      };

      socket.onerror = () => {
        if (!cancelled) setWsStatus('disconnected');
      };

      socket.onclose = () => {
        if (cancelled) return;
        setWsStatus('disconnected');
        reconnectTimer = window.setTimeout(connect, 4000);
      };
    };

    // Defer by a tick so React StrictMode double-mount does not abort a CONNECTING socket.
    connectTimer = window.setTimeout(() => {
      connectTimer = null;
      connect();
    }, 0);

    const handleUnload = () => {
      cancelled = true;
      closeSocketCleanly(true);
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      closeSocketCleanly(false);
    };
  }, [api, isRunning, token, wsNonce]);

  const ensureEvalToken = useCallback(async (): Promise<string> => {
    const now = Date.now();
    if (evalTokenRef.current && now < evalTokenExpiryRef.current - 60_000) {
      return evalTokenRef.current;
    }
    const fresh = await refreshSession();
    if (fresh?.eval_token) {
      return fresh.eval_token;
    }
    throw new Error('Evaluation token unavailable. Reload your active session.');
  }, [refreshSession]);

  const handleStart = async (modeOverride?: CisfGridMode) => {
    if (starting || isRunning || isPreparing || isStoppingUnexpectedly) return;
    const requestedMode = modeOverride ?? launchMode;
    setStarting(true);
    setError('');
    setPausedNotice('');
    setActionNotice('');
    setVerifyState(null);
    setPracticeResult(null);
    setTelemetry(null);
    initialModuleSyncedRef.current = false;
    try {
      const started = await api.startSession(assignmentId, requestedMode);
      applySessionPayload(started);
    } catch (err) {
      if (err instanceof CisfGridApiError && err.status === 409) {
        if (err.message.toLowerCase().includes('paused')) {
          setPausedNotice(err.message);
        } else {
          setError(err.message);
          void refreshSession();
        }
      } else {
        setError(err instanceof Error ? err.message : 'Could not start CISF OT Grid session.');
      }
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (stopping || !session) return;
    setStopping(true);
    setError('');
    try {
      await api.stopSession(assignmentId);
      activeCheckRef.current = null;
      moduleSwitchSeqRef.current += 1;
      initialModuleSyncedRef.current = false;
      evalTokenRef.current = '';
      evalTokenExpiryRef.current = 0;
      setSession(null);
      setTelemetry(null);
      setVerifyState(null);
      setPracticeResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stop session.');
    } finally {
      setStopping(false);
    }
  };

  const handleSelectModule = (modId: string) => {
    if (verifyBusy || resetBusy || modId === activeModuleId) return;
    if (session?.session.mode === 'full_op' && modId !== 'full_op') return;
    const willResetContainer = isRunning && session?.session.mode !== 'full_op' && telemetry?.module_id !== modId;
    if (
      willResetContainer &&
      !window.confirm(
        `Switch active module to ${modId.toUpperCase()}? Live container state will reset to ${modId.toUpperCase()} (saved notes and passed Case Board entries are preserved).`,
      )
    ) {
      return;
    }
    initialModuleSyncedRef.current = true;
    setActiveModuleId(modId);
    const spec = CISF_GRID_MODULES.find((m) => m.id === modId) ?? FULL_OP_MODULE;
    setEditorFile(spec.artifact);
    setPracticeResult(null);
    setActionNotice('');
    setError('');
    if (verifyState?.module_id && verifyState.module_id !== modId) {
      setVerifyState(null);
    }
    if (willResetContainer) {
      const seq = ++moduleSwitchSeqRef.current;
      setResetBusy(true);
      void api
        .resetModule(modId, assignmentId, false)
        .then(() => {
          if (seq !== moduleSwitchSeqRef.current) return;
          setActionNotice(`Active module switched to ${modId.toUpperCase()} (container state synced).`);
          void loadCaseAndDispatch();
        })
        .catch((err) => {
          if (seq !== moduleSwitchSeqRef.current) return;
          setError(err instanceof Error ? err.message : `Could not activate ${modId.toUpperCase()} in container.`);
        })
        .finally(() => {
          if (seq === moduleSwitchSeqRef.current) setResetBusy(false);
        });
    }
  };

  const handlePractice = async () => {
    if (practiceBusy || !isRunning || currentModule.isFullOp) return;
    setPracticeBusy(true);
    setError('');
    setActionNotice('');
    try {
      let evalToken = await ensureEvalToken();
      let res: CheckStatusResponse;
      try {
        res = await api.practiceModule(currentModule.id, assignmentId, evalToken);
      } catch (firstErr) {
        if (firstErr instanceof CisfGridApiError && firstErr.status === 403) {
          evalTokenRef.current = '';
          evalToken = await ensureEvalToken();
          res = await api.practiceModule(currentModule.id, assignmentId, evalToken);
        } else {
          throw firstErr;
        }
      }
      setPracticeResult(res);
      setMissionTab('checks');
    } catch (err) {
      if (err instanceof CisfGridApiError && (err.status === 409 || err.status === 502)) {
        void refreshSession();
      }
      setError(err instanceof Error ? err.message : 'Practice check failed.');
    } finally {
      setPracticeBusy(false);
    }
  };

  const pollCheckUntilDone = useCallback(
    async (checkId: string, moduleId: string) => {
      activeCheckRef.current = { checkId, moduleId };
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        if (activeCheckRef.current?.checkId !== checkId) return;
        try {
          const st = await api.getCheckStatus(checkId, assignmentId);
          if (activeCheckRef.current?.checkId !== checkId) return;
          setVerifyState(st);
          if (st.status !== 'running') {
            setVerifyBusy(false);
            if (st.status === 'passed') {
              void loadCaseAndDispatch();
              setActionNotice(
                st.already_completed
                  ? `Module ${moduleId.toUpperCase()} verified again (score already awarded).`
                  : `Module ${moduleId.toUpperCase()} passed (+${st.awarded_points ?? st.score ?? 0} pts).`,
              );
            }
            return;
          }
        } catch (err) {
          if (activeCheckRef.current?.checkId !== checkId) return;
          setVerifyBusy(false);
          if (err instanceof CisfGridApiError && (err.status === 409 || err.status === 502)) {
            void refreshSession();
          }
          setError(err instanceof Error ? err.message : 'Verification status check failed.');
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (activeCheckRef.current?.checkId === checkId) {
        setVerifyBusy(false);
        setError('Verification check polling timed out. Refresh to inspect the latest state.');
      }
    },
    [api, assignmentId, loadCaseAndDispatch, refreshSession],
  );

  const handleVerify = async () => {
    if (verifyBusy || !isRunning) return;
    setVerifyBusy(true);
    setError('');
    setActionNotice('');
    setMissionTab('checks');
    try {
      let evalToken = await ensureEvalToken();
      let started: { check_id: string; module_id: string; started_at?: string; deadline_at?: string };
      try {
        started = await api.verifyModule(currentModule.id, assignmentId, evalToken);
      } catch (firstErr) {
        // Refresh eval token once on 403 in case token expired across sleep/idle.
        if (firstErr instanceof CisfGridApiError && firstErr.status === 403) {
          evalTokenRef.current = '';
          evalToken = await ensureEvalToken();
          started = await api.verifyModule(currentModule.id, assignmentId, evalToken);
        } else {
          throw firstErr;
        }
      }
      setVerifyState({
        check_id: started.check_id,
        module_id: currentModule.id,
        status: 'running',
        started_at: started.started_at,
        deadline_at: started.deadline_at,
      });
      void pollCheckUntilDone(started.check_id, currentModule.id);
    } catch (err) {
      setVerifyBusy(false);
      if (err instanceof CisfGridApiError && err.status === 409) {
        if (err.message.toLowerCase().includes('paused')) {
          setPausedNotice(err.message);
        } else {
          void refreshSession();
        }
      } else {
        if (err instanceof CisfGridApiError && err.status === 502) {
          void refreshSession();
        }
        setError(err instanceof Error ? err.message : 'Verification could not be started.');
      }
    }
  };

  const handleReset = async (electricalOnly: boolean) => {
    if (resetBusy || !isRunning) return;
    setResetBusy(true);
    setError('');
    setActionNotice('');
    try {
      await api.resetModule(currentModule.id, assignmentId, electricalOnly);
      setActionNotice(
        electricalOnly
          ? 'Electrical state reset completed (notes preserved).'
          : `Clean Start applied for ${currentModule.id.toUpperCase()} (notes preserved).`,
      );
      void loadCaseAndDispatch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setResetBusy(false);
    }
  };

  const handleUnlockHint = async (level: 1 | 2 | 3, confirmed = false) => {
    if (hintBusy || !isRunning || currentModule.isFullOp) return;
    if (level === 3 && !confirmed) {
      setConfirmL3Open(true);
      return;
    }
    setHintBusy(true);
    setConfirmL3Open(false);
    setError('');
    try {
      const hint = await api.unlockHint(currentModule.id, level, assignmentId, confirmed);
      setHintsByMod((prev) => ({
        ...prev,
        [currentModule.id]: {
          ...(prev[currentModule.id] ?? {}),
          [level]: hint,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock hint.');
    } finally {
      setHintBusy(false);
    }
  };

  const handleSaveNotes = async () => {
    if (notesSaving) return;
    setNotesSaving(true);
    setNotesSavedMsg('');
    try {
      const saved = await api.saveNotes({ text: notes.text, pins: notes.pins }, assignmentId);
      setNotes(saved);
      setNotesSavedMsg('Saved to your lab record');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notes.');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleTourClose = async (completed: boolean) => {
    setTourOpen(false);
    const nextPrefs: TourPrefsState = {
      cold_open_seen: true,
      tour_seen: completed || tourPrefs.tour_seen,
      dismissed_tips: tourPrefs.dismissed_tips,
    };
    setTourPrefs(nextPrefs);
    try {
      await api.saveTourPrefs(nextPrefs);
    } catch {
      // Non-fatal preference persistence error.
    }
  };

  const handleBayReadout = async (bayId: string) => {
    if (bayBusy || !isRunning) return;
    setBayBusy(bayId);
    setError('');
    try {
      const entry = await api.requestBayReadout(bayId);
      setDispatchFeed((prev) => [entry, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not request field readout for ${bayId}.`);
    } finally {
      setBayBusy(null);
    }
  };

  const loadWorkspaceContent = useCallback(
    async (name: string) => {
      const res = await api.readWorkspaceFile(name, assignmentId);
      return res.content;
    },
    [api, assignmentId],
  );

  const saveWorkspaceContent = useCallback(
    async (name: string, content: string) => {
      await api.writeWorkspaceFile(name, content, assignmentId);
    },
    [api, assignmentId],
  );

  const clearedCount = passedModules.filter((id) => id !== 'full_op').length;
  const modHints = hintsByMod[currentModule.id] ?? {};

  return (
    <main className="page-in min-h-screen bg-[var(--surface-sunken)] px-4 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[var(--line)] bg-white px-5 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/labs')}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-brand-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              All labs
            </button>
            <div>
              <h1 className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Operation Blackout: Ghost in the Grid
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                CISF OT Substation Defense · SN-220-MAIN Suryanagar
                {assignmentId ? ` · Assignment #${assignmentId}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-36 sm:w-44">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span>Progress</span>
                <span className="tabular">{clearedCount}/10 modules</span>
              </div>
              <SegmentedBar done={clearedCount} total={10} label={`${clearedCount} of 10 modules completed`} />
            </div>

            <button
              type="button"
              onClick={() => setTourOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Guide
            </button>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                isRunning
                  ? 'bg-mint-50 text-mint-700 dark:bg-mint-950/60 dark:text-mint-300'
                  : isStoppedUnexpectedly
                    ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                    : isPreparing || starting
                      ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isRunning
                    ? 'bg-mint-500'
                    : isStoppedUnexpectedly
                      ? 'bg-rose-500'
                      : isPreparing || starting
                        ? 'bg-amber-400'
                        : 'bg-slate-400'
                }`}
              />
              {isRunning
                ? 'Session running'
                : isStoppedUnexpectedly
                  ? 'Lab stopped'
                  : isPreparing || starting
                    ? 'Provisioning...'
                    : 'Not started'}
            </span>

            {(isRunning || isPreparing) && (
              <button
                type="button"
                onClick={() => void handleStop()}
                disabled={stopping}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <Square className="h-3 w-3" />
                {stopping ? 'Stopping...' : 'Stop lab'}
              </button>
            )}
          </div>
        </header>

        {pausedNotice && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{pausedNotice}</div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {loadingSession ? (
          <section className="flex min-h-[24rem] flex-col items-center justify-center gap-4 rounded-[28px] border border-[var(--line)] bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <Mascot pose="carry" size={72} interactive={false} />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Checking your isolated CISF OT Grid session...
            </p>
          </section>
        ) : !isRunning ? (
          <section className="rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="mx-auto max-w-3xl">
              {isPreparing || starting ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Mascot pose="carry" size={72} interactive={false} />
                  <h2 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
                    Preparing your private SN-220-MAIN substation task
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Provisioning isolated IEC-104 RTUs, SCADA EMS, Purdue firewall fence, grading sandbox, and key-authenticated responder shell. This view switches automatically once health probes pass.
                  </p>
                </div>
              ) : isStoppedUnexpectedly ? (
                <div role="status" className="flex flex-col items-center py-8 text-center">
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                  <h2 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
                    Your lab stopped. Start it again; your points are safe.
                  </h2>
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => void handleStart(session?.session.mode ?? launchMode)}
                      disabled={starting || isStoppingUnexpectedly || Boolean(pausedNotice)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
                    >
                      <Play className="h-4 w-4" />
                      {isStoppingUnexpectedly ? 'Finishing stop...' : 'Start lab again'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                        Live IEC 60870-5-104 Substation Defense
                      </span>
                      <h2 className="mt-3 font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                        Launch your isolated substation workspace
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Each launch provisions a private multi-container substation with a unique per-session cryptographic seed, Ed25519 key-only responder SSH, live IEC-104 RTUs, and a signed pass-only grading checker.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setLaunchMode('modules')}
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        launchMode === 'modules'
                          ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/30'
                          : 'border-[var(--line)] bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950'
                      }`}
                    >
                      <div className="text-sm font-bold text-slate-900 dark:text-white">Guided Modules (1000 pts)</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                        Ten progressive modules across five acts with Clean Start, tiered hints, Practice checks, Case Board, and Shift Report.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaunchMode('full_op')}
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        launchMode === 'full_op'
                          ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/30'
                          : 'border-[var(--line)] bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950'
                      }`}
                    >
                      <div className="text-sm font-bold text-slate-900 dark:text-white">Full Operation Mode (100 pts)</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                        Unscripted 6-gate incident response on an independent seed with per-module Clean Start disabled.
                      </p>
                    </button>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleStart()}
                      disabled={starting || Boolean(pausedNotice)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
                    >
                      <Play className="h-4 w-4" />
                      Start private substation lab
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            {/* LEFT MISSION COLUMN: Living Lab Stage, Tour (Decision 6), Modules, Brief, Dispatch, Checks, Case Board, Notes, Shift Report */}
            <div id="cisf-mission-column" className="flex min-w-0 flex-col gap-4">
              <CisfGridTour
                open={tourOpen}
                onFinish={() => void handleTourClose(true)}
                onDismiss={() => void handleTourClose(false)}
              />

              <CisfGridStage
                telemetry={telemetry}
                wsStatus={wsStatus}
                onReconnect={() => setWsNonce((n) => n + 1)}
              />

              {session?.session.mode !== 'full_op' && (
                <section
                  aria-label="Act and module selector"
                  className="rounded-[28px] border border-[var(--line)] bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap gap-2">
                    {CISF_GRID_ACTS.map((act) => (
                      <div key={act.act} className="flex items-center gap-1.5 rounded-2xl border border-[var(--line)] bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-950">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Act {act.act}: {act.title}
                        </span>
                        <div className="flex items-center gap-1">
                          {act.modules.map((mid) => {
                            const selected = activeModuleId === mid;
                            const done = passedModules.includes(mid);
                            return (
                              <button
                                key={mid}
                                type="button"
                                disabled={verifyBusy || resetBusy}
                                onClick={() => handleSelectModule(mid)}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                                  selected
                                    ? 'bg-slate-900 text-white dark:bg-brand-600 dark:text-white'
                                    : done
                                      ? 'bg-mint-50 text-mint-700 hover:bg-mint-100 dark:bg-mint-950/60 dark:text-mint-300'
                                      : 'bg-white text-slate-700 hover:bg-brand-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                                }`}
                              >
                                {done && <CheckCircle2 className="h-3 w-3" />}
                                {mid.toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4 dark:border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 font-mono text-xs font-bold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                        {currentModule.id.toUpperCase()}
                      </span>
                      <span className="tabular text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {currentModule.pts} pts (pass: {currentModule.passPts})
                      </span>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        Artifact: ~/workspace/{currentModule.artifact}
                      </span>
                    </div>
                    <h2 className="mt-1.5 font-display text-xl font-extrabold text-slate-900 dark:text-white">
                      {currentModule.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!currentModule.isFullOp && (
                      <button
                        type="button"
                        onClick={() => void handlePractice()}
                        disabled={practiceBusy || verifyBusy}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        {practiceBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Practice (0 pts)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleVerify()}
                      disabled={verifyBusy || Boolean(pausedNotice)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
                    >
                      {verifyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {verifyBusy ? 'Grading...' : 'Submit for grading'}
                    </button>
                  </div>
                </div>

                <nav className="mt-3 flex flex-wrap gap-1 border-b border-[var(--line)] pb-2 dark:border-slate-800" aria-label="Mission sections">
                  {[
                    { id: 'brief' as const, label: 'Brief', icon: BookOpen },
                    { id: 'dispatch' as const, label: 'Dispatch', icon: PhoneCall },
                    { id: 'checks' as const, label: 'Checks & Controls', icon: ShieldCheck },
                    { id: 'case' as const, label: `Case Board (${clearedCount}/10)`, icon: ClipboardList },
                    { id: 'notes' as const, label: 'Notes', icon: FileText },
                    { id: 'report' as const, label: 'Shift Report', icon: Trophy },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = missionTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMissionTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-brand-100 text-slate-900 dark:bg-brand-900/50 dark:text-brand-100'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>

                {actionNotice && (
                  <div
                    role="status"
                    className="mt-3 rounded-2xl border border-mint-200 bg-mint-50 px-3.5 py-2.5 text-xs font-medium text-mint-800 dark:border-mint-900 dark:bg-mint-950/50 dark:text-mint-200"
                  >
                    {actionNotice}
                  </div>
                )}

                {missionTab === 'brief' && (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{currentModule.scenario}</p>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs leading-5 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                      {currentModule.roe}
                    </div>

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Recommended workflow
                      </h3>
                      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-5 text-slate-700 dark:text-slate-300">
                        {currentModule.steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Grading criteria
                      </h3>
                      <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                        {currentModule.rubric.map((r) => (
                          <li key={r} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600 dark:text-mint-400" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {!currentModule.isFullOp && (
                      <div className="rounded-2xl border border-[var(--line)] bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                            Tiered hints
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {([1, 2, 3] as const).map((lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                disabled={hintBusy}
                                onClick={() => void handleUnlockHint(lvl, false)}
                                className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-brand-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                {lvl === 3 ? 'Level 3 (-10% pts)' : `Level ${lvl} (free)`}
                              </button>
                            ))}
                          </div>
                        </div>
                        {confirmL3Open && (
                          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                            <p className="font-semibold">Confirm Level 3 hint deduction?</p>
                            <p className="mt-1">
                              Unlocking Level 3 deducts 10% of this module&apos;s maximum points upon passing.
                            </p>
                            <div className="mt-2.5 flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleUnlockHint(3, true)}
                                className="rounded-full bg-slate-900 px-3 py-1 font-semibold text-white dark:bg-brand-600"
                              >
                                Confirm unlock
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmL3Open(false)}
                                className="rounded-full border border-[var(--line)] bg-white px-3 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {Object.keys(modHints).length > 0 && (
                          <div className="mt-3 space-y-2">
                            {([1, 2, 3] as const)
                              .filter((lvl) => Boolean(modHints[lvl]))
                              .map((lvl) => (
                                <div
                                  key={lvl}
                                  className="rounded-xl border border-[var(--line)] bg-white p-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                >
                                  <div className="font-semibold text-slate-900 dark:text-white">Hint Level {lvl}</div>
                                  <p className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-5">
                                    {modHints[lvl].hint}
                                  </p>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {missionTab === 'dispatch' && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50/70 p-3.5 dark:border-brand-800 dark:bg-slate-950">
                      <Mascot pose="phone" size={56} interactive={false} className="shrink-0" />
                      <div className="text-xs leading-5 text-slate-700 dark:text-slate-200">
                        <div className="font-bold text-slate-900 dark:text-white">
                          Raghav Menon · Shift Charge Engineer, SN-220-MAIN
                        </div>
                        <p className="mt-1">
                          &ldquo;Trauma Hospital is on backup diesel and Water Works booster pumps stopped, yet our HMI shows all feeders closed. Request a physical switchyard bay check from Devika Nair before trusting any reading.&rdquo;
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--line)] bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Request physical switchyard bay readout (Devika Nair)
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {['BAY-01', 'BAY-02', 'BAY-03', 'BAY-04', 'BAY-05', 'BAY-06'].map((bay) => (
                          <button
                            key={bay}
                            type="button"
                            disabled={bayBusy !== null}
                            onClick={() => void handleBayReadout(bay)}
                            className="rounded-full border border-[var(--line)] bg-white px-3 py-1 font-mono text-xs font-semibold text-slate-700 hover:bg-brand-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            {bayBusy === bay ? 'Checking...' : bay}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {dispatchFeed.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No dispatch callouts recorded yet. Request a bay check or refresh.
                        </p>
                      ) : (
                        dispatchFeed.slice(0, 12).map((entry) => (
                          <article
                            key={entry.id}
                            className="rounded-2xl border border-[var(--line)] bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {entry.sender || entry.from || 'Station Dispatch'}
                              </span>
                              <span className="tabular font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {entry.ist || entry.utc || entry.timestamp_utc || ''}
                              </span>
                            </div>
                            <p className="mt-1 leading-5 text-slate-700 dark:text-slate-300">
                              {entry.message || entry.body}
                            </p>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {missionTab === 'checks' && (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        Need a clean state for <code className="font-mono">{currentModule.id}</code>? Your responder notes are preserved.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!currentModule.isFullOp && (
                          <button
                            type="button"
                            disabled={resetBusy || verifyBusy}
                            onClick={() => void handleReset(false)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Clean Start
                          </button>
                        )}
                        {(currentModule.id === 'm09' || currentModule.isFullOp) && (
                          <button
                            type="button"
                            disabled={resetBusy || verifyBusy}
                            onClick={() => void handleReset(true)}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset electrical state
                          </button>
                        )}
                      </div>
                    </div>

                    {verifyState && (
                      <div className="rounded-2xl border border-[var(--line)] bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center gap-3">
                          <Mascot
                            pose={
                              verifyState.status === 'running'
                                ? 'walk'
                                : verifyState.status === 'passed'
                                  ? 'cheer'
                                  : 'think'
                            }
                            size={56}
                            interactive={false}
                            className="shrink-0"
                          />
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              {verifyState.status === 'running'
                                ? `Checking ${(verifyState.module_id ?? currentModule.id).toUpperCase()}...`
                                : verifyState.status === 'passed'
                                  ? `Passed ${(verifyState.module_id ?? currentModule.id).toUpperCase()} (${verifyState.score ?? 0}/${verifyState.max_score ?? currentModule.pts} pts)`
                                  : `Not yet passed (${verifyState.status})`}
                            </div>
                            {verifyState.check_id && (
                              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                Check ID: {verifyState.check_id}
                              </div>
                            )}
                          </div>
                        </div>

                        {Array.isArray(verifyState.area_feedback) && verifyState.area_feedback.length > 0 && (
                          <ul className="mt-3 space-y-1.5">
                            {verifyState.area_feedback.map((item) => {
                              const ok = item.passed >= item.total && item.total > 0;
                              return (
                                <li
                                  key={item.area}
                                  className="flex items-start gap-2 rounded-xl border border-[var(--line)] bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                                >
                                  {ok ? (
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600 dark:text-mint-400" />
                                  ) : (
                                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                                  )}
                                  <div>
                                    <span className="font-semibold text-slate-900 dark:text-white">{item.area}</span>
                                    <span className="ml-2 text-slate-600 dark:text-slate-300">{item.message}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}

                    {practiceResult && (
                      <div className="rounded-2xl border border-[var(--line)] bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Practice result (0 pts): {practiceResult.passed ? 'Format and checks passed' : 'Needs revision'}
                        </div>
                        <ul className="mt-2 space-y-1 text-xs">
                          {(practiceResult.area_feedback ?? []).map((item) => (
                            <li key={item.area} className="text-slate-700 dark:text-slate-300">
                              <span className="font-semibold">{item.area}:</span> {item.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {missionTab === 'case' && (
                  <div className="mt-4 space-y-3">
                    {Object.keys(cases).length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Verified evidence summaries appear here automatically as you pass each module.
                      </p>
                    ) : (
                      Object.entries(cases).map(([modId, summary]) => (
                        <div
                          key={modId}
                          className="rounded-2xl border border-mint-200 bg-mint-50/40 p-3.5 dark:border-mint-900/60 dark:bg-mint-950/25"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-mint-800 dark:text-mint-300">
                              {modId.toUpperCase()} · {summary.title}
                            </span>
                            <CheckCircle2 className="h-4 w-4 text-mint-600 dark:text-mint-400" />
                          </div>
                          <dl className="mt-2 grid gap-1 text-xs">
                            {(summary.fields ?? []).map((f) => (
                              <div key={f.label} className="flex justify-between gap-3">
                                <dt className="text-slate-500 dark:text-slate-400">{f.label}</dt>
                                <dd className="font-mono font-medium text-slate-900 dark:text-slate-100">{f.value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {missionTab === 'notes' && (
                  <div className="mt-4 space-y-3">
                    <label htmlFor="cisf-responder-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Responder notebook (persisted in CyberRange Postgres across Clean Starts)
                    </label>
                    <textarea
                      id="cisf-responder-notes"
                      rows={8}
                      value={notes.text}
                      onChange={(e) => {
                        setNotes((prev) => ({ ...prev, text: e.target.value }));
                        setNotesSavedMsg('');
                      }}
                      placeholder="Log master OA, RTU Common Addresses, divergence UTC timestamps, rogue IOAs, CRC-32 hex, and restoration headroom..."
                      className="w-full rounded-2xl border border-[var(--line)] bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {notesSavedMsg || (notes.updated_utc ? `Last saved ${notes.updated_utc}` : 'Not saved yet')}
                      </span>
                      <button
                        type="button"
                        disabled={notesSaving}
                        onClick={() => void handleSaveNotes()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {notesSaving ? 'Saving...' : 'Save notes'}
                      </button>
                    </div>
                  </div>
                )}

                {missionTab === 'report' && (
                  <div className="mt-4 space-y-3">
                    {!shiftReport ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Complete Module 10 (Detection engineering and handover) to unlock your signed Shift Report.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-mint-200 bg-mint-50 p-4 dark:border-mint-900 dark:bg-mint-950/40">
                          <div>
                            <div className="text-sm font-bold text-mint-900 dark:text-mint-200">
                              Shift Report verified
                            </div>
                            <div className="text-xs text-mint-800 dark:text-mint-300">
                              Completed {shiftReport.completed_utc} · Elapsed {formatDuration(shiftReport.total_elapsed_s)}
                            </div>
                          </div>
                          <div className="tabular font-display text-2xl font-extrabold text-mint-900 dark:text-mint-100">
                            {shiftReport.total_score}/{shiftReport.max_score}
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {shiftReport.acts.map((a) => (
                            <div
                              key={a.act}
                              className="rounded-2xl border border-[var(--line)] bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                            >
                              <div className="font-bold text-slate-900 dark:text-white">
                                Act {a.act}: {a.title}
                              </div>
                              <div className="tabular mt-1 text-slate-600 dark:text-slate-300">
                                Score: {a.score}/{a.max_score} · Time: {formatDuration(a.elapsed_s)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT TERMINAL / EDITOR COLUMN (#right-pane): NEVER overlaid by mascot or tour bubbles */}
            <section
              id="right-pane"
              aria-label="Responder terminal and workspace editor"
              className="flex min-h-[36rem] flex-col overflow-hidden rounded-[28px] border border-[var(--line)] bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900" role="tablist" aria-label="Workspace tool">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={rightTab === 'terminal'}
                    onClick={() => setRightTab('terminal')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      rightTab === 'terminal'
                        ? 'bg-slate-900 text-white dark:bg-brand-600 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    <SquareTerminal className="h-3.5 w-3.5" />
                    Responder Terminal
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={rightTab === 'editor'}
                    onClick={() => setRightTab('editor')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      rightTab === 'editor'
                        ? 'bg-slate-900 text-white dark:bg-brand-600 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    <FileCode2 className="h-3.5 w-3.5" />
                    Workspace Editor
                  </button>
                </div>

                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Ed25519 key SSH · responder@sn-220-main
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col p-3">
                <div className={rightTab === 'terminal' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
                  <RealTerminal
                    labId="cisf-ot-grid"
                    wsPath="/api/v1/terminal/ws/cisf-ot-grid"
                    token={token ?? undefined}
                    enabled={isRunning}
                    terminalTitle="CISF OT Grid Responder Shell"
                    height="100%"
                    className="min-h-[32rem] flex-1"
                  />
                </div>
                {rightTab === 'editor' && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <CisfGridCodeEditor
                      filename={editorFile}
                      onSelectFile={setEditorFile}
                      loadFile={loadWorkspaceContent}
                      saveFile={saveWorkspaceContent}
                      recommendedFiles={currentModule.artifactFiles}
                    />
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
};
