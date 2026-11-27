import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Play,
  Square,
  XCircle,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mascot } from '../../components/mascot/Mascot';
import { SegmentedBar } from '../../components/ui/SegmentedBar';
import { CisfGridV13Workspace } from '../../components/cisfGrid/CisfGridV13Workspace';
import { CisfGridApiError, createCisfGridApi } from '../../components/cisfGrid/api';
import type {
  SessionInfo,
  TourPrefsState,
} from '../../components/cisfGrid/types';
import { useAuth } from '../../context';

function parseAssignmentId(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export const CisfGridLabPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = parseAssignmentId(searchParams.get('assignment_id'));
  const { apiFetch, token } = useAuth();
  const api = useMemo(() => createCisfGridApi(apiFetch), [apiFetch]);

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  const [pausedNotice, setPausedNotice] = useState('');
  const [passedModules, setPassedModules] = useState<string[]>([]);

  const [tourPrefs, setTourPrefs] = useState<TourPrefsState>({
    cold_open_seen: false,
    tour_seen: false,
    dismissed_tips: [],
  });

  const evalTokenRef = useRef<string>('');
  const evalTokenExpiryRef = useRef<number>(0);

  const isStoppedUnexpectedly = Boolean(session && (session.status === 'failed' || session.stopped_unexpectedly));
  const isRunning = session?.status === 'running' && Boolean(session.urls?.terminal) && !stopping;
  const isStoppingUnexpectedly = isStoppedUnexpectedly && session?.status === 'stopping';
  const isPreparing = Boolean(
    session && !isRunning && !isStoppedUnexpectedly && !['stopped', 'failed'].includes(session.status),
  );

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
    }
  }, [api, applySessionPayload, assignmentId]);

  // Initial load: fetch current session and persisted tour preferences together before rendering workspace.
  useEffect(() => {
    let active = true;
    void (async () => {
      const [, prefs] = await Promise.all([
        refreshSession(),
        api.getTourPrefs().catch(() => null),
      ]);
      if (!active) return;
      if (prefs) setTourPrefs(prefs);
      setLoadingSession(false);
    })();
    return () => {
      active = false;
    };
  }, [api, refreshSession]);

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

  const ensureEvalToken = useCallback(
    async (forceRefresh = false): Promise<string> => {
      if (forceRefresh) {
        evalTokenRef.current = '';
        evalTokenExpiryRef.current = 0;
      }
      const now = Date.now();
      if (evalTokenRef.current && now < evalTokenExpiryRef.current - 60_000) {
        return evalTokenRef.current;
      }
      const fresh = await refreshSession();
      if (fresh?.eval_token) {
        return fresh.eval_token;
      }
      throw new Error('Evaluation token unavailable. Reload your active session.');
    },
    [refreshSession],
  );

  const handleStart = async () => {
    if (starting || isRunning || isPreparing || isStoppingUnexpectedly) return;
    setStarting(true);
    setError('');
    setPausedNotice('');
    try {
      const started = await api.startSession(assignmentId, 'modules');
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

  const handleStop = useCallback(async () => {
    if (stopping || !session) return;
    setStopping(true);
    setError('');
    try {
      await api.stopSession(assignmentId);
      evalTokenRef.current = '';
      evalTokenExpiryRef.current = 0;
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stop session.');
    } finally {
      setStopping(false);
    }
  }, [api, assignmentId, session, stopping]);

  const handleSaveTourPrefs = useCallback(
    (nextPrefs: TourPrefsState) => {
      setTourPrefs(nextPrefs);
      void api.saveTourPrefs(nextPrefs).catch(() => {
        // Non-fatal preference persistence error.
      });
    },
    [api],
  );

  const handleUpstreamLost = useCallback(
    (status: number) => {
      if (status === 409 || status === 502) {
        void refreshSession();
      }
    },
    [refreshSession],
  );

  const clearedCount = passedModules.filter((id) => id !== 'full_op').length;

  // Running state: render the full 1-to-1 V13 Living Stage EMS workspace directly.
  if (!loadingSession && isRunning && session) {
    return (
      <div className="min-h-screen w-full bg-[var(--surface-sunken)] dark:bg-slate-950">
        {(pausedNotice || error) && (
          <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 pt-3 sm:px-6">
            {pausedNotice && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{pausedNotice}</div>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{error}</div>
              </div>
            )}
          </div>
        )}
        <CisfGridV13Workspace
          key={session.session.generation}
          apiFetch={apiFetch}
          token={token ?? null}
          assignmentId={assignmentId}
          mode={session.session.mode}
          initialTourPrefs={tourPrefs}
          ensureEvalToken={ensureEvalToken}
          onSaveTourPrefs={handleSaveTourPrefs}
          onProgressUpdated={setPassedModules}
          onUpstreamLost={handleUpstreamLost}
          onBackToAllLabs={() => navigate('/labs')}
          onEndSession={() => void handleStop()}
        />
      </div>
    );
  }

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

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                isStoppedUnexpectedly
                  ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                  : isPreparing || starting
                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isStoppedUnexpectedly
                    ? 'bg-rose-500'
                    : isPreparing || starting
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                }`}
              />
              {isStoppedUnexpectedly
                ? 'Lab stopped'
                : isPreparing || starting
                  ? 'Provisioning...'
                  : 'Not started'}
            </span>

            {isPreparing && (
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
        ) : (
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
                      onClick={() => void handleStart()}
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
                        Live IEC 60870-5-104 Substation Defense · 10 Modules · 1,000 pts
                      </span>
                      <h2 className="mt-3 font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                        Launch your isolated substation workspace
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Each launch provisions a private multi-container 220/132/33 kV substation with a unique per-session cryptographic seed, Ed25519 key-only responder SSH, live IEC-104 RTUs, Purdue zone firewall enforcement, and a signed pass-only grading checker across all ten guided modules.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--line)] bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Acts 1 to 3 (M1 to M7)
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
                        Live IEC-104 walkdown, IOA reconstruction, historian audit, multi-vantage blinding proof, rogue SBO forensics, host pivot tracing, and binary replay-shim eradication.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--line)] bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Acts 4 to 5 (M8 to M10)
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
                        Zero-downtime Purdue firewall policy, paced cold-load restoration without protection trips, and unseen-attack Zeek IEC-104 detection engineering.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--line)] bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Grading &amp; Handover
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
                        1,000 points across 10 modules with Practice checks, tiered hints (-10% for Level 3), Case Board evidence cards, Shift Report, and completion certificate.
                      </p>
                    </div>
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
        )}
      </div>
    </main>
  );
};
