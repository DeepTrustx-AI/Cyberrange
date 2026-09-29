import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context';
import { RealTerminal } from '../../components/RealTerminal';
import {
  Clock,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Lock,
  LogOut,
  Play,
  TerminalSquare
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Objective {
  label: string;
}

interface ReconModule {
  id: string;
  title: string;
  points: number;
  /** Description shown in left panel */
  description: string;
  /** Mission paragraph */
  mission: string;
  objectives: Objective[];
  hints: string[];
  /** Populated from backend after completing the module */
  correctFlag?: string;
}

export const ChallengeSession: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, apiFetch } = useAuth();
  // Available Labs navigates with `:labSlug`, while older routes use `:labId`.
  // Normalize both so the session always uses the lab-specific progress API.
  const { labId: routeLabId, labSlug } = useParams<{ labId?: string; labSlug?: string }>();
  const labId = routeLabId || labSlug;

  const isReconLab = labId === 'lab1-recon' || labId === 'recon-lab';

  const [currentModules, setCurrentModules] = useState<ReconModule[]>([]);
  const [contentError, setContentError] = useState('');
  const [sessionState, setSessionState] = useState('');
  const [commandBusy, setCommandBusy] = useState(false);
  const busyRef = useRef(false);
  const labTitle = labId === 'ot-security-lab'
    ? 'OT & ICS Security Simulator Track'
    : labId === 'ot-railroad-north'
    ? 'OT Railroad Signaling & Control Track'
    : labId === 'ot-water-treatment'
    ? 'OT Water Treatment Facility Track'
    : isReconLab
    ? 'Network Reconnaissance Track'
    : 'CyberRange Interactive Lab Session';

  const handleReturn = () => {
    navigate(user?.role === 'admin' ? '/admin/labs' : '/labs');
  };

  // ── Session state ────────────────────────────────────────────────────────
  const isOTLabSession = labId === 'ot-water-treatment' || labId === 'ot-railroad-north' || labId === 'ot-security-lab';
  // null while loading; undefined-equivalent "no timer" for free labs (isFreeLab=true)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isFreeLab, setIsFreeLab] = useState(false);
  const unsyncedSecondsRef = useRef(0);
  const [score, setScore] = useState(0);

  // Per-module solve state (from backend)
  const [solvedModules, setSolvedModules] = useState<Set<string>>(new Set());
  // Per-module, per-objective tick state (triggered by terminal commands)
  const [objProgress, setObjProgress] = useState<Record<string, boolean[]>>({});
  const [activeChallengeIdx, setActiveChallengeIdx] = useState(0);
  const activeModule = currentModules[activeChallengeIdx] || currentModules[0] || { id: "", title: "", points: 0, description: "", mission: "", objectives: [], hints: [] };
  const isSolved = solvedModules.has(activeModule.id);

  const [completionModal, setCompletionModal] = useState<{
    show: boolean;
    isLastModule: boolean;
    moduleNum: number;
    moduleTitle: string;
    points: number;
    totalScore: number;
    accuracy: string;
    challengesCompleted: number;
    totalChallenges: number;
    timeTaken: string;
  } | null>(null);

  const handleShareAchievement = async (data: { labTitle: string; totalScore: number; username: string }) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `CyberRange Certificate - ${data.labTitle}`,
          text: `I completed ${data.labTitle} on CyberRange! Score: +${data.totalScore} pts.`,
          url: window.location.href,
        });
        return;
      } catch (err) {
        console.log('Share cancelled:', err);
      }
    }
    alert(`Certificate generated for ${data.labTitle}. Verify at CyberRange official portal.`);
  };

  // Submission state
  const [flagInput, setFlagInput] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [unlockedHints, setUnlockedHints] = useState<Record<string, string[]>>({});

  // Terminal
  const [terminalConnected, setTerminalConnected] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [isRoot, setIsRoot] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setCurrentModules([]); setContentError(''); setSessionState('');
    apiFetch('/api/v1/private-lab-content/' + encodeURIComponent(labId || 'lab1-recon'))
      .then(async r => { if (!r.ok) throw new Error('Lab content is unavailable.'); return r.json(); })
      .then(data => { if (!cancelled) { setCurrentModules(data.modules); setTerminalHistory(data.banner); setSessionState(data.session); } })
      .catch(e => { if (!cancelled) setContentError(e.message); });
    return () => { cancelled = true; };
  }, [labId, apiFetch]);

  // ── Recon lab: student starts containers explicitly via "Start Lab", tear down on exit ──
  const [reconStarted, setReconStarted] = useState(false);
  const [reconProvisioning, setReconProvisioning] = useState(false);
  const [reconProvisioned, setReconProvisioned] = useState(false);
  const [reconProvisionError, setReconProvisionError] = useState<string | null>(null);
  const reconStartedRef = useRef(false);

  const startReconLab = () => {
    if (!isReconLab || reconProvisioning) return;
    setReconStarted(true);
    reconStartedRef.current = true;
    setReconProvisioning(true);
    setReconProvisionError(null);
    apiFetch('/api/v1/recon/provision', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'provisioned') {
          setReconProvisioned(true);
        } else {
          setReconProvisionError(d.detail || 'Could not start lab environment.');
        }
      })
      .catch(() => {
        setReconProvisionError('Server unreachable. Please refresh.');
      })
      .finally(() => setReconProvisioning(false));
  };

  const disconnectReconLab = () => {
    if (!reconProvisioned && !reconStarted) return;
    reconStartedRef.current = false;
    setReconProvisioned(false);
    setReconStarted(false);
    setReconProvisionError(null);
    apiFetch('/api/v1/recon/teardown', { method: 'POST' }).catch(() => {});
  };

  useEffect(() => {
    if (!isReconLab) return;

    // SPA-navigation cleanup (unmount) does NOT run on a tab close/refresh, which
    // previously left provisioned Docker containers running forever on the host
    // and slowly starving it of CPU/RAM. `pagehide` fires in both cases, and a
    // `keepalive` fetch is allowed to outlive the page teardown.
    const teardownOnLeave = () => {
      if (!reconStartedRef.current) return;
      apiFetch('/api/v1/recon/teardown', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', teardownOnLeave);

    return () => {
      window.removeEventListener('pagehide', teardownOnLeave);
      // Best-effort teardown on unmount (navigate away / session end), only if we started one
      if (reconStartedRef.current) {
        apiFetch('/api/v1/recon/teardown', { method: 'POST' }).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReconLab, token]);

  // ── Load progress from backend (Recon & OT labs) ─────────────────────────
  useEffect(() => {
    // Recon lab: use dedicated /recon/progress endpoint
    if (isReconLab) {
      apiFetch('/api/v1/recon/progress')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          const solved = new Set<string>();
          (data.modules || []).forEach((m: any) => {
            if (m.completed) solved.add(m.id);
          });
          setSolvedModules(solved);
          setScore(data.total_score || 0);
          const pre: Record<string, boolean[]> = {};
          currentModules.forEach((mod) => {
            if (solved.has(mod.id)) pre[mod.id] = mod.objectives.map(() => true);
          });
          setObjProgress(pre);
          const firstUnsolvedIdx = currentModules.findIndex((m) => !solved.has(m.id));
          if (firstUnsolvedIdx !== -1) {
            setActiveChallengeIdx(firstUnsolvedIdx);
          }
        })
        .catch(() => { /* offline — degrade silently */ });
      return;
    }

    // OT labs: use reporting/progress endpoint
    if (isOTLabSession) {
      apiFetch(`/api/v1/reporting/progress?lab_id=${labId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          const solved = new Set<string>();
          // data.completed_modules is array of module_ids like 'ot-water-treatment_module1'
          (data.completed_modules || []).forEach((mid: string) => {
            // extract the short id (module1, module2, etc.)
            const shortId = mid.replace(`${labId}_`, '');
            solved.add(shortId);
          });
          setSolvedModules(solved);
          setScore(data.total_score || 0);
          const pre: Record<string, boolean[]> = {};
          currentModules.forEach((mod) => {
            if (solved.has(mod.id)) pre[mod.id] = mod.objectives.map(() => true);
          });
          setObjProgress(pre);
          const firstUnsolvedIdx = currentModules.findIndex((m) => !solved.has(m.id));
          if (firstUnsolvedIdx !== -1) {
            setActiveChallengeIdx(firstUnsolvedIdx);
          }
        })
        .catch(() => { /* offline — degrade silently */ });
    }
  }, [isReconLab, isOTLabSession, labId, apiFetch, currentModules]);

  // ── Session clock ────────────────────────────────────────────────────────
  // Free labs show no timer at all. Priced labs bill against the student's
  // purchased hours, persisted server-side: fetch the true remaining balance
  // on mount (so exiting mid-session and returning resumes correctly), tick
  // it down locally for a smooth UI, and periodically flush elapsed seconds
  // back to the server so the balance is never lost.
  useEffect(() => {
    if (!labId) return;
    let cancelled = false;
    apiFetch(`/api/v1/labs/${labId}/session-time`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setIsFreeLab(!!d.is_free);
        if (!d.is_free) setTimeRemaining(d.seconds_remaining ?? 0);
      })
      .catch(() => { /* offline — leave timer hidden rather than show a wrong value */ });
    return () => { cancelled = true; };
  }, [labId, apiFetch]);

  const flushSessionTime = useCallback((useKeepalive: boolean) => {
    if (!labId || isFreeLab || unsyncedSecondsRef.current <= 0) return;
    const elapsed = unsyncedSecondsRef.current;
    unsyncedSecondsRef.current = 0;
    if (useKeepalive) {
      apiFetch(`/api/v1/labs/${labId}/session-tick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify({ elapsed_seconds: elapsed }),
      }).catch(() => {});
    } else {
      apiFetch(`/api/v1/labs/${labId}/session-tick`, {
        method: 'POST',
        body: JSON.stringify({ elapsed_seconds: elapsed }),
      }).catch(() => {});
    }
  }, [labId, isFreeLab, apiFetch, token]);

  useEffect(() => {
    if (isFreeLab || timeRemaining === null) return;
    const t = setInterval(() => {
      setTimeRemaining((p) => (p !== null && p > 0 ? p - 1 : 0));
      unsyncedSecondsRef.current += 1;
    }, 1000);
    // Persist elapsed time to the server every 30s so a crash/tab-kill loses
    // at most 30s of billed time instead of the whole session.
    const sync = setInterval(() => flushSessionTime(false), 30000);
    return () => { clearInterval(t); clearInterval(sync); };
  }, [isFreeLab, timeRemaining === null, flushSessionTime]);

  useEffect(() => {
    const onLeave = () => flushSessionTime(true);
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      flushSessionTime(false);
    };
  }, [flushSessionTime]);

  // ── Auto-scroll terminal ─────────────────────────────────────────────────
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  // ── Flag submission ──────────────────────────────────────────────────────
  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagInput.trim()) return;

    const submittedFlag = flagInput.trim();
    const currentLabId = labId || 'lab1-recon';

    // For the real-container recon lab, students find flags inside the live
    // terminal — there are no simulated objectives to tick off.
    if (!isReconLab) {
      const currentObjs = objProgress[activeModule.id] || [];
      const allObjectivesCompleted = activeModule.objectives.length > 0 &&
        currentObjs.length === activeModule.objectives.length &&
        currentObjs.every(Boolean);

      if (!allObjectivesCompleted) {
        setSubmissionStatus('error');
        setSubmissionMessage('Complete all required stage objectives in the terminal before submitting the flag!');
        setTimeout(() => setSubmissionStatus('idle'), 3000);
        return;
      }
    }

    try {
      let isCorrect = false;
      let earnedPoints = activeModule.points;
      let msg = 'Correct flag submitted!';

      if (isReconLab) {
        const res = await apiFetch('/api/v1/recon/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: activeModule.id, flag: submittedFlag }),
        });
        const data = await res.json();
        isCorrect = !!data.correct;
        earnedPoints = data.points || activeModule.points;
        msg = data.message || msg;
        if (data.total_points !== undefined) setScore(data.total_points);

      } else {
        const res = await apiFetch('/api/v1/private-lab-content/' + encodeURIComponent(currentLabId) + '/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: activeModule.id, flag: submittedFlag, session: sessionState }),
        });
        if (!res.ok) throw new Error('Submission failed');
        const data = await res.json();
        isCorrect = data.success === true;
        earnedPoints = data.points_awarded ?? 0;
        msg = data.message || msg;
        if (data.total_score !== undefined) setScore(data.total_score);
        if (isCorrect) {
          localStorage.removeItem('lab_progress_' + currentLabId);
          localStorage.removeItem('dashboard_cache'); localStorage.removeItem('leaderboard_cache');
        }
      }

      if (isCorrect) {
        setSubmissionStatus('success');
        setSubmissionMessage(`+${earnedPoints} pts — ${msg}`);
        setSolvedModules((prev) => new Set([...prev, activeModule.id]));

        setObjProgress((prev) => ({
          ...prev,
          [activeModule.id]: activeModule.objectives.map(() => true),
        }));

        const isFinalModule = (solvedModules.size + 1) >= currentModules.length;
        if (isFinalModule && isReconLab) {
          // Auto-teardown container task in background on lab completion
          apiFetch('/api/v1/recon/teardown', { method: 'POST' }).catch(() => {});
        }
        setCompletionModal({
          show: true,
          isLastModule: isFinalModule,
          moduleNum: activeChallengeIdx + 1,
          moduleTitle: activeModule.title,
          points: earnedPoints,
          totalScore: score + earnedPoints,
          accuracy: '100%',
          challengesCompleted: activeModule.objectives.length,
          totalChallenges: activeModule.objectives.length,
          timeTaken: '00:02:15',
        });

        setTimeout(() => { setSubmissionStatus('idle'); setFlagInput(''); }, 3000);
      } else {
        setSubmissionStatus('error');
        setSubmissionMessage('Incorrect flag. Try again.');
        setTimeout(() => setSubmissionStatus('idle'), 1800);
      }
    } catch {
      setSubmissionStatus('error');
      setSubmissionMessage('Could not reach server. Check your connection.');
      setTimeout(() => setSubmissionStatus('idle'), 2000);
    }
  };

  // ── Hint unlock ──────────────────────────────────────────────────────────
  const handleUnlockHint = async (hintIdx: number) => {
    if (!window.confirm('Unlock this hint? A 20-point penalty applies when the module is completed.')) return;

    const modId = activeModule.id;
    try {
      const res = await apiFetch(isReconLab ? '/api/v1/recon/hint' : '/api/v1/private-lab-content/' + encodeURIComponent(labId || '') + '/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: modId, hint_index: hintIdx + 1, session: sessionState }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.session) setSessionState(data.session);
        setUnlockedHints((prev) => {
          const existing = prev[modId] || [];
          if (existing[hintIdx]) return prev;
          const next = [...existing];
          next[hintIdx] = data.hint;
          return { ...prev, [modId]: next };
        });
        if (!data.already_unlocked && data.total_points !== undefined) {
          setScore(data.total_points);
        }
      }
    } catch {
      setSubmissionMessage('Hint unavailable. Please retry.');
    }
  };

  // ── Module nav (with locking) ────────────────────────────────────────────
  const canNavigateTo = (idx: number) => {
    if (idx === 0) return true;
    return solvedModules.has(currentModules[idx - 1].id);
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || busyRef.current) return;
    busyRef.current = true; setCommandBusy(true);
    try {
      const r = await apiFetch('/api/v1/private-lab-content/' + encodeURIComponent(labId || '') + '/command', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: activeModule.id, command: commandInput, session: sessionState }),
      });
      if (!r.ok) throw new Error('Command failed. Please reload the session if it expired.');
      const data = await r.json();
      setSessionState(data.session); setIsRoot(data.root); setObjProgress(data.objectives);
      setTerminalHistory(prev => data.clear ? data.lines : [...prev, ...data.lines]);
      setCommandInput('');
    } catch (e) { setSubmissionStatus('error'); setSubmissionMessage(e instanceof Error ? e.message : 'Command failed.'); }
    finally { busyRef.current = false; setCommandBusy(false); }
  };

  // ── Derived helpers ───────────────────────────────────────────────────────
  const getObjDone = (modIdx: number, objIdx: number): boolean => {
    const mod = currentModules[modIdx];
    if (!mod) return false;
    if (solvedModules.has(mod.id)) return true;
    return (objProgress[mod.id]?.[objIdx]) ?? false;
  };

  const completedObjCount = activeModule.objectives.filter((_, i) => getObjDone(activeChallengeIdx, i)).length;
  const currentHints = unlockedHints[activeModule.id] || [];

  if (contentError) return <div role="alert">{contentError}</div>;
  if (!currentModules.length) return <div role="status">Loading lab content…</div>;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 transition-colors overflow-hidden">
      {/* Top Nav */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between z-20 flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          {!isOTLabSession && (
            <button
              onClick={handleReturn}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Tracks</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ACTIVE SESSION
            </span>
            <span className="font-bold text-slate-800 dark:text-white text-sm">{labTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
            <span className="text-slate-400 dark:text-slate-500">Module</span>
            <span className="text-slate-800 dark:text-slate-100">{activeChallengeIdx + 1} of {currentModules.length}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border border-blue-100 dark:border-blue-900 px-3.5 py-1.5 rounded-xl">
            <span className="text-blue-400">Score:</span>
            <span className="text-[#2563EB] dark:text-blue-300 font-black">{score} pts</span>
          </div>
          {!isFreeLab && timeRemaining !== null && (
            <div className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Session: {formatTime(timeRemaining)}</span>
            </div>
          )}
          <button
            onClick={() => { if (window.confirm('Exit this challenge session?')) handleReturn(); }}
            className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Session</span>
          </button>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 p-6 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden">

        {/* ── Left Panel ── */}
        <div className="w-full md:w-[45%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col min-h-0 overflow-y-auto space-y-6">

          {/* Module pill selector */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Network Recon Modules
            </span>
            <div className="flex gap-2">
              {currentModules.map((mod, idx) => {
                const locked = !canNavigateTo(idx);
                const solved = solvedModules.has(mod.id);
                const active = idx === activeChallengeIdx;
                return (
                  <button
                    key={mod.id}
                    onClick={() => {
                      if (locked) return;
                      setActiveChallengeIdx(idx);
                      setFlagInput('');
                      setSubmissionStatus('idle');
                    }}
                    disabled={locked}
                    title={locked ? 'Complete previous module to unlock' : mod.title}
                    className={`w-8 h-8 rounded-xl border text-xs font-black transition-all flex items-center justify-center
                      ${locked
                        ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                        : active
                          ? 'bg-[#2563EB] text-white border-blue-600 shadow-md ring-2 ring-blue-500/20 cursor-pointer'
                          : solved
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#10B981] border-emerald-200 dark:border-emerald-800 cursor-pointer'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 cursor-pointer'
                      }`}
                  >
                    {locked ? (
                      <Lock className="w-3 h-3" />
                    ) : solved ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      idx + 1
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module title */}
          <div className="space-y-2">
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border border-blue-100 dark:border-blue-900 uppercase tracking-wider">
              NETWORK RECON — MODULE {activeChallengeIdx + 1}
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeModule.title.replace(/^Module \d+: /, '')}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {activeModule.description}
            </p>
          </div>

          {/* Mission box */}
          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#2563EB] dark:text-blue-400 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>MISSION</span>
            </div>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
              {activeModule.mission}
            </p>
          </div>

          {/* Objectives with per-objective green tick */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>OBJECTIVES ({activeModule.objectives.length} REQUIRED)</span>
              <span className={completedObjCount === activeModule.objectives.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                {completedObjCount}/{activeModule.objectives.length} COMPLETED
              </span>
            </div>

            <div className="space-y-2">
              {activeModule.objectives.map((obj, i) => {
                const done = getObjDone(activeChallengeIdx, i);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-medium transition-all border ${
                      done
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      done ? 'bg-[#10B981] text-white' : 'border-2 border-slate-300 dark:border-slate-600'
                    }`}>
                      {done && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </span>
                    <span className="leading-snug">{obj.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hints */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>MODULE HINTS ({activeModule.hints.length} MAX)</span>
              <span className="text-amber-600 dark:text-amber-400">-25 pts per hint</span>
            </div>
            <div className="space-y-2">
              {activeModule.hints.map((hint, idx) => {
                const hintText = currentHints[idx];
                const isUnlocked = !!hintText;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border transition-all ${
                      isUnlocked
                        ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3'
                    }`}
                  >
                    {isUnlocked ? (
                      <div>
                        <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                          Hint #{idx + 1}
                        </span>
                        <p>{hintText}</p>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Unlock Hint #{idx + 1}
                        </span>
                        <button
                          onClick={() => handleUnlockHint(idx)}
                          disabled={isSolved}
                          className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-blue-50 text-[#2563EB] border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          Unlock
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flag submission */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              SUBMIT STAGE FLAG
            </label>
            <form onSubmit={handleFlagSubmit} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="FLAG{...}"
                  value={flagInput}
                  onChange={(e) => setFlagInput(e.target.value)}
                  disabled={isSolved}
                  className={`flex-1 px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none transition-all focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-xs font-mono ${
                    isSolved
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 text-emerald-700 dark:text-emerald-300 cursor-not-allowed'
                      : submissionStatus === 'error'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-805'
                        : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'
                  }`}
                />
                <button
                  type="submit"
                  disabled={isSolved || submissionStatus === 'success'}
                  className={`font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 ${
                    isSolved
                      ? 'bg-emerald-100 text-[#10B981] border border-emerald-200 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-indigo-500/20'
                  }`}
                >
                  {isSolved ? (
                    <><CheckCircle2 className="w-4 h-4" /><span>Solved</span></>
                  ) : (
                    <span>Submit</span>
                  )}
                </button>
              </div>

              {submissionStatus === 'success' && (
                <p className="text-xs font-bold text-[#10B981] animate-in fade-in flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{submissionMessage}</span>
                </p>
              )}
              {submissionStatus === 'error' && (
                <p className="text-xs font-bold text-rose-500 animate-in fade-in flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{submissionMessage}</span>
                </p>
              )}
            </form>
          </div>
        </div>

        {/* ── Right Terminal Panel ── */}
        <div className="flex-1 bg-[#0B1020] rounded-2xl border border-slate-800 shadow-xl flex flex-col min-h-0 overflow-hidden">
          {/* Terminal Header */}
          <div className="h-11 bg-[#0F172A] border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              </div>
              <span className="font-mono text-xs font-bold text-slate-300">
                {isReconLab ? 'SecureGuard Red Team Workstation — Live Container' : 'Terminal Emulator — Execution Environment'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#00FF9D] bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF9D] animate-pulse" />
                {isReconLab
                  ? (reconProvisioned ? 'CONTAINER LIVE' : reconProvisionError ? 'PROVISION FAILED' : reconProvisioning ? 'PROVISIONING...' : 'NOT STARTED')
                  : 'INFRASTRUCTURE ONLINE'}
              </span>
              {isReconLab && (
                <>
                  <button
                    onClick={startReconLab}
                    disabled={reconProvisioning || reconProvisioned}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-[11px] font-extrabold px-3 py-1 rounded-lg transition-colors"
                  >
                    {reconProvisioning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{reconProvisioning ? 'Starting...' : 'Start Terminal'}</span>
                  </button>
                  <button
                    onClick={disconnectReconLab}
                    disabled={!reconProvisioned && !reconStarted}
                    className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-[11px] font-extrabold px-3 py-1 rounded-lg transition-colors"
                  >
                    <span>Disconnect</span>
                  </button>
                </>
              )}
              {!isReconLab && (
                <>
                  <button
                    onClick={() => setTerminalConnected(true)}
                    disabled={terminalConnected}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-[11px] font-extrabold px-3 py-1 rounded-lg transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Terminal</span>
                  </button>
                  <button
                    onClick={() => setTerminalConnected(false)}
                    disabled={!terminalConnected || commandBusy}
                    className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-[11px] font-extrabold px-3 py-1 rounded-lg transition-colors"
                  >
                    <span>Disconnect</span>
                  </button>
                  <button
                    disabled={commandBusy}
                    onClick={async () => {
                      if (busyRef.current) return;
                      busyRef.current = true; setCommandBusy(true);
                      try {
                        const r = await apiFetch('/api/v1/private-lab-content/' + encodeURIComponent(labId || ''));
                        if (!r.ok) throw new Error('Unable to reset session.');
                        const data = await r.json();
                        setSessionState(data.session); setObjProgress({}); setIsRoot(false);
                        setTerminalHistory(data.banner);
                      } catch { setSubmissionStatus('error'); setSubmissionMessage('Unable to reset session.'); }
                      finally { busyRef.current = false; setCommandBusy(false); }
                    }}
                    className="hover:text-white p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-400"
                    title="Reset console state"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Terminal body: real xterm for recon, simulated div for OT/others */}
          {isReconLab ? (
            reconProvisionError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
                <p className="text-rose-400 font-mono text-sm font-bold">{reconProvisionError}</p>
                <button
                  onClick={startReconLab}
                  disabled={reconProvisioning}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reconProvisioning ? 'animate-spin' : ''}`} /> Retry Start Lab
                </button>
              </div>
            ) : reconProvisioned ? (
              <RealTerminal
                labId="lab1-recon"
                token={token ?? undefined}
                height="100%"
                className="flex-1"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center">
                  <TerminalSquare className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-slate-400 font-mono text-sm">
                  Click <span className="text-[#00FF9D] font-bold">"Start Terminal"</span> to provision your isolated
                  target and workstation containers.
                </p>
              </div>
            )
          ) : terminalConnected ? (
            <>
              {/* Simulated terminal output (OT labs + fallback) */}
              <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-[#00FF9D] space-y-2 selection:bg-blue-900 selection:text-white">
                {terminalHistory.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">{line}</div>
                ))}
                <div ref={terminalBottomRef} />
              </div>

              {/* Simulated terminal input */}
              <form
                onSubmit={handleCommandSubmit}
                className="h-11 bg-[#0F172A] border-t border-slate-800 flex items-center px-4 flex-shrink-0"
              >
                <span className="font-mono text-xs text-[#00FF9D] font-bold mr-2 flex-shrink-0">
                  {isRoot ? 'root@cyberrange-sandbox:~#' : 'operator@cyberrange-sandbox:~$'}
                </span>
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-[#00FF9D] focus:ring-0 placeholder-slate-600"
                  placeholder='Type "help" for available commands'
                  disabled={commandBusy}
                  autoFocus
                />
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center">
                <TerminalSquare className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-slate-400 font-mono text-sm">
                Click <span className="text-[#00FF9D] font-bold">"Start Terminal"</span> to connect to your execution
                workstation environment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Module / Lab Completion Popup Modal */}
      {completionModal && completionModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-extrabold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                {completionModal.isLastModule ? '🎉 LAB COMPLETED!' : `MODULE ${completionModal.moduleNum} COMPLETED!`}
              </span>
              <h2 className="text-xl font-bold text-white leading-tight">
                {completionModal.moduleTitle}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {completionModal.isLastModule
                  ? `Congratulations! You solved all modules in ${labTitle}!`
                  : `You successfully completed Module ${completionModal.moduleNum}. Next module has been unlocked.`}
              </p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs">
              <div className="text-left space-y-1">
                <div className="text-slate-400 font-semibold">Module Score: <span className="text-emerald-400 font-bold">+{completionModal.points} pts</span></div>
                <div className="text-slate-400 font-semibold">Total Score: <span className="text-blue-400 font-bold">{completionModal.totalScore} pts</span></div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-slate-400 font-semibold">Challenges: <span className="text-white font-bold">{completionModal.challengesCompleted}/{completionModal.totalChallenges}</span></div>
                <div className="text-slate-400 font-semibold">Accuracy: <span className="text-amber-400 font-bold">{completionModal.accuracy}</span></div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-2">
              {!completionModal.isLastModule ? (
                <>
                  <button
                    onClick={() => {
                      setCompletionModal(null);
                      if (activeChallengeIdx < currentModules.length - 1) {
                        setActiveChallengeIdx((prev) => prev + 1);
                      }
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                  >
                    Continue to Next Module
                  </button>
                  <button
                    onClick={() => setCompletionModal(null)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    Review Module
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleShareAchievement({ labTitle, totalScore: completionModal.totalScore, username: user?.name || user?.email || 'Student' })}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" /> Share Achievement & Download Card
                  </button>
                  <button
                    onClick={() => {
                      setCompletionModal(null);
                      navigate('/labs');
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    Return to Available Labs
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
