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
  TerminalSquare,
  BookOpen,
  ExternalLink,
  CircleDot,
  Eye,
  FileText,
  MessageSquareText
} from 'lucide-react';
import { parseApiErrorMessage } from '../../lib/api';

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

interface StudyMaterialItem {
  id: string;
  title: string;
  category: string;
  description: string;
  readTime?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  pdfUrl?: string;
  content?: string[];
}

type WaterStageGuide = {
  journeyLabel: string;
  duration: string;
  brief: string;
  safetyNote: string;
  interpretation: string;
  evidenceQuestion: string;
  answers: readonly string[];
  correctAnswer: number;
  challengeReady: string;
};

type ControlRecord = {
  prediction: string;
  target: string;
  verification: string;
  restoration: string;
};

type OperationalReview = {
  currentState: string;
  evidence: string;
  nextAction: string;
};

const WATER_STAGE_GUIDES: readonly WaterStageGuide[] = [
  {
    journeyLabel: 'Establish visibility', duration: '2 min',
    brief: 'Find the ClearWater PLC, confirm what services answer, and map the control points you can safely observe.',
    safetyNote: 'Read-only investigation. Do not write to the controller in this stage.',
    interpretation: 'Port 502 identifies Modbus TCP. Coils are binary command states: record their meaning before deciding what the plant is doing.',
    evidenceQuestion: 'Which observation identifies a binary control state?',
    answers: ['A coil state such as INTAKE_PUMP_1_CMD = ON', 'A listening service such as 502/tcp'], correctAnswer: 0,
    challengeReady: 'Challenge ready after you capture the service and coil map.'
  },
  {
    journeyLabel: 'Interpret process conditions', duration: '4 min',
    brief: 'Use the existing register dump to translate raw values into engineering meaning and identify what needs attention.',
    safetyNote: 'Interpret scaled telemetry before drawing a conclusion. Observation remains read-only.',
    interpretation: 'A value marked x10 or x100 needs scaling before it represents its physical unit. Compare related readings, not one number in isolation.',
    evidenceQuestion: 'What should you do before interpreting a scaled register value?',
    answers: ['Apply the documented scale and unit', 'Treat the raw integer as the physical value'], correctAnswer: 0,
    challengeReady: 'Challenge ready after you support a finding with two related readings.'
  },
  {
    journeyLabel: 'Triage SCADA alarms', duration: '5 min',
    brief: 'Compare the existing SCADA view with PLC evidence and decide what needs escalation, monitoring, or more evidence.',
    safetyNote: 'Acknowledging an alarm changes its visibility, not the underlying process condition.',
    interpretation: 'Use PLC telemetry to test whether an HMI alarm reflects a process condition, a display issue, or incomplete evidence.',
    evidenceQuestion: 'What does acknowledging an alarm prove?',
    answers: ['Only that its acknowledgement was recorded', 'That the process fault has been repaired'], correctAnswer: 0,
    challengeReady: 'Challenge ready after you classify one alarm with supporting evidence.'
  },
  {
    journeyLabel: 'Control safely', duration: '6 min',
    brief: 'Use the existing controlled defense task to plan, predict, verify, and restore a bounded simulated change.',
    safetyNote: 'Safety gate: state the expected effect and restoration path before making a write-capable action.',
    interpretation: 'A safe intervention includes a target, predicted result, observed verification, and confirmation that the baseline is restored.',
    evidenceQuestion: 'What completes a safe simulated control change?',
    answers: ['Prediction, bounded change, verification, and restoration', 'A successful write command'], correctAnswer: 0,
    challengeReady: 'Challenge ready after the safety record is complete.'
  },
  {
    journeyLabel: 'Operational review', duration: '5 min',
    brief: 'Use the evidence gathered across the current lab to produce a concise, defensible operational handover.',
    safetyNote: 'Separate observed facts from assumptions, and preserve evidence before escalating a suspected unauthorized change.',
    interpretation: 'The capstone is a synthesis task: explain the current state, safety-critical evidence, and the next safe action.',
    evidenceQuestion: 'What makes an operational handover defensible?',
    answers: ['Evidence, assessment, safety impact, and next action', 'A list of commands run during the lab'], correctAnswer: 0,
    challengeReady: 'Challenge ready when your handover connects evidence to a safe next step.'
  }
];

export const ChallengeSession: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, apiFetch } = useAuth();
  // Available Labs navigates with `:labSlug`, while older routes use `:labId`.
  // Normalize both so the session always uses the lab-specific progress API.
  const { labId: routeLabId, labSlug } = useParams<{ labId?: string; labSlug?: string }>();
  const labId = routeLabId || labSlug;

  const isReconLab = labId === 'lab1-recon' || labId === 'recon-lab';
  const isOTWaterLab = labId === 'ot-water-treatment';
  const isRuntimeShieldLab = labId === 'iso-runtime-shield-workshop';

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
    : isRuntimeShieldLab
    ? 'ISO/IEC 42001 Runtime Shield Workshop'
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
  const waterGuide = WATER_STAGE_GUIDES[activeChallengeIdx] || WATER_STAGE_GUIDES[0];
  const [learningChecks, setLearningChecks] = useState<Record<string, number>>({});
  const [handoverNotes, setHandoverNotes] = useState<Record<string, string>>({});
  const [handoverSaved, setHandoverSaved] = useState<Record<string, boolean>>({});
  const [controlRecords, setControlRecords] = useState<Record<string, ControlRecord>>({});
  const [controlRecordSaved, setControlRecordSaved] = useState<Record<string, boolean>>({});
  const [operationalReviews, setOperationalReviews] = useState<Record<string, OperationalReview>>({});
  const [operationalReviewSaved, setOperationalReviewSaved] = useState<Record<string, boolean>>({});
  const [learningSaveError, setLearningSaveError] = useState('');

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
  const [otProvisioning, setOTProvisioning] = useState(false);
  const [otProvisioned, setOTProvisioned] = useState(false);
  const [otProvisionError, setOTProvisionError] = useState<string | null>(null);
  const [otUrls, setOTUrls] = useState<{ scada: string; wireshark: string } | null>(null);
  const [runtimeProvisioning, setRuntimeProvisioning] = useState(false);
  const [runtimeProvisioned, setRuntimeProvisioned] = useState(false);
  const [runtimeProvisionError, setRuntimeProvisionError] = useState<string | null>(null);
  const [runtimeUrls, setRuntimeUrls] = useState<{ workshop: string; editor?: string } | null>(null);
  const runtimeEditorActivityAtRef = useRef(0);

  const signalRuntimeEditorActivity = useCallback(() => {
    const now = Date.now();
    if (now - runtimeEditorActivityAtRef.current < 30_000) return;
    runtimeEditorActivityAtRef.current = now;
    apiFetch('/api/v1/runtime-shield/proxy/ui/activity', { method: 'POST' }).catch(() => {});
  }, [apiFetch]);

  const bindRuntimeEditorActivity = useCallback((frame: HTMLIFrameElement) => {
    try {
      const doc = frame.contentDocument;
      if (!doc || doc.documentElement.dataset.runtimeActivityBound === 'true') return;
      doc.documentElement.dataset.runtimeActivityBound = 'true';
      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        doc.addEventListener(eventName, signalRuntimeEditorActivity, { passive: true });
      });
      frame.contentWindow?.addEventListener('focus', signalRuntimeEditorActivity);
      signalRuntimeEditorActivity();
    } catch {
      // The editor is same-origin in production; file-save activity inside the
      // task remains a second signal if a browser blocks iframe document access.
    }
  }, [signalRuntimeEditorActivity]);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [isRoot, setIsRoot] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const [otStudyMaterials, setOTStudyMaterials] = useState<StudyMaterialItem[]>([]);
  const [otStudyLoading, setOTStudyLoading] = useState(false);
  const [activeStudyMaterialId, setActiveStudyMaterialId] = useState<string | null>(null);

  const startOTWaterLab = useCallback(async () => {
    if (!isOTWaterLab || otProvisioning || otProvisioned) return;
    setOTProvisioning(true);
    setOTProvisionError(null);
    try {
      const response = await apiFetch('/api/v1/ot-water/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // FastAPI still requires a request body for the StartSession model,
        // even though assignment_id is optional.
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parseApiErrorMessage(data, 'Could not start the OT environment.'));
      setOTUrls(data.urls ?? null);
      setOTProvisioned(true);
      setTerminalConnected(true);
    } catch (error) {
      setOTProvisionError(error instanceof Error ? error.message : 'Could not start the OT environment.');
    } finally {
      setOTProvisioning(false);
    }
  }, [apiFetch, isOTWaterLab, otProvisioned, otProvisioning]);

  const stopOTWaterLab = useCallback(() => {
    if (!isOTWaterLab || (!otProvisioned && !terminalConnected)) return;
    setTerminalConnected(false);
    setOTProvisioned(false);
    setOTUrls(null);
    apiFetch('/api/v1/ot-water/sessions/current', { method: 'DELETE' }).catch(() => {});
  }, [apiFetch, isOTWaterLab, otProvisioned, terminalConnected]);

  useEffect(() => {
    if (!isOTWaterLab) return;
    let cancelled = false;
    apiFetch('/api/v1/ot-water/sessions/current')
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setOTUrls(data.urls ?? null);
        setOTProvisioned(true);
        setTerminalConnected(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiFetch, isOTWaterLab]);

  useEffect(() => {
    if (!isOTWaterLab) return;
    let cancelled = false;
    apiFetch('/api/v1/private-lab-content/ot-water-treatment/learning')
      .then(async (response) => {
        if (!response.ok) throw new Error('Your learning evidence could not be loaded.');
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const checks: Record<string, number> = {};
        const notes: Record<string, string> = {};
        const noteSaved: Record<string, boolean> = {};
        const controls: Record<string, ControlRecord> = {};
        const controlSaved: Record<string, boolean> = {};
        const reviews: Record<string, OperationalReview> = {};
        const reviewSaved: Record<string, boolean> = {};
        (data.records || []).forEach((record: { module: string; evidence_check?: number; handover_note?: string; control_record?: ControlRecord; operational_review?: OperationalReview }) => {
          if (record.evidence_check !== undefined) checks[record.module] = record.evidence_check;
          if (record.handover_note) { notes[record.module] = record.handover_note; noteSaved[record.module] = true; }
          if (record.control_record) { controls[record.module] = record.control_record; controlSaved[record.module] = true; }
          if (record.operational_review) { reviews[record.module] = record.operational_review; reviewSaved[record.module] = true; }
        });
        setLearningChecks(checks); setHandoverNotes(notes); setHandoverSaved(noteSaved);
        setControlRecords(controls); setControlRecordSaved(controlSaved);
        setOperationalReviews(reviews); setOperationalReviewSaved(reviewSaved);
      })
      .catch((error) => { if (!cancelled) setLearningSaveError(error instanceof Error ? error.message : 'Your learning evidence could not be loaded.'); });
    return () => { cancelled = true; };
  }, [apiFetch, isOTWaterLab]);

  const startRuntimeShieldLab = useCallback(async () => {
    if (!isRuntimeShieldLab || runtimeProvisioning || runtimeProvisioned) return;
    setRuntimeProvisioning(true); setRuntimeProvisionError(null);
    try {
      const response = await apiFetch('/api/v1/runtime-shield/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parseApiErrorMessage(data, 'Could not start the Runtime Shield workshop.'));
      setRuntimeUrls(data.urls ?? null); setRuntimeProvisioned(true);
    } catch (error) {
      setRuntimeProvisionError(error instanceof Error ? error.message : 'Could not start the Runtime Shield workshop.');
    } finally { setRuntimeProvisioning(false); }
  }, [apiFetch, isRuntimeShieldLab, runtimeProvisioned, runtimeProvisioning]);

  const stopRuntimeShieldLab = useCallback(() => {
    if (!isRuntimeShieldLab || !runtimeProvisioned) return;
    setRuntimeProvisioned(false); setRuntimeUrls(null);
    apiFetch('/api/v1/runtime-shield/sessions/current', { method: 'DELETE' }).catch(() => {});
  }, [apiFetch, isRuntimeShieldLab, runtimeProvisioned]);

  useEffect(() => {
    if (!isRuntimeShieldLab) return;
    let cancelled = false;
    apiFetch('/api/v1/runtime-shield/sessions/current')
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled && data) { setRuntimeUrls(data.urls ?? null); setRuntimeProvisioned(true); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiFetch, isRuntimeShieldLab]);

  useEffect(() => {
    if (!isOTWaterLab) return;
    let cancelled = false;
    setOTStudyLoading(true);
    apiFetch('/api/v1/study-materials')
      .then((response) => response.ok ? response.json() : [])
      .then((items: StudyMaterialItem[]) => {
        if (cancelled) return;
        const relevant = (Array.isArray(items) ? items : []).filter((item) =>
          `${item.title} ${item.category} ${item.description} ${(item.content || []).join(' ')}`
            .toLowerCase()
            .match(/\b(ot|ics|water|plc|modbus|industrial|scada)\b/)
        );
        setOTStudyMaterials(relevant);
        setActiveStudyMaterialId(relevant[0]?.id ?? null);
      })
      .catch(() => { if (!cancelled) setOTStudyMaterials([]); })
      .finally(() => { if (!cancelled) setOTStudyLoading(false); });
    return () => { cancelled = true; };
  }, [apiFetch, isOTWaterLab]);

  useEffect(() => {
    if (isRuntimeShieldLab) { setCurrentModules([]); setContentError(''); setTerminalHistory([]); return; }
    let cancelled = false;
    setCurrentModules([]); setContentError(''); setSessionState('');
    apiFetch('/api/v1/private-lab-content/' + encodeURIComponent(labId || 'lab1-recon'))
      .then(async r => { if (!r.ok) throw new Error('Lab content is unavailable.'); return r.json(); })
      .then(data => { if (!cancelled) { setCurrentModules(data.modules); setTerminalHistory(data.banner); setSessionState(data.session); } })
      .catch(e => { if (!cancelled) setContentError(e.message); });
    return () => { cancelled = true; };
  }, [labId, apiFetch, isRuntimeShieldLab]);

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

  const recordTerminalCommand = async (command: string) => {
    if (!command.trim() || busyRef.current) return;
    busyRef.current = true; setCommandBusy(true);
    try {
      const r = await apiFetch('/api/v1/private-lab-content/' + encodeURIComponent(labId || '') + '/command', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: activeModule.id, command, session: sessionState }),
      });
      if (!r.ok) throw new Error('Command failed. Please reload the session if it expired.');
      const data = await r.json();
      setSessionState(data.session); setIsRoot(data.root); setObjProgress(data.objectives);
      setTerminalHistory(prev => data.clear ? data.lines : [...prev, ...data.lines]);
    } catch (e) { setSubmissionStatus('error'); setSubmissionMessage(e instanceof Error ? e.message : 'Command failed.'); }
    finally { busyRef.current = false; setCommandBusy(false); }
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const command = commandInput;
    setCommandInput('');
    await recordTerminalCommand(command);
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
  const activeStudyMaterial = otStudyMaterials.find((item) => item.id === activeStudyMaterialId) ?? otStudyMaterials[0];
  const completedModules = currentModules.filter((module) => solvedModules.has(module.id)).length;
  const activeCheckAnswer = learningChecks[activeModule.id];
  const hasCorrectLearningCheck = activeCheckAnswer === waterGuide.correctAnswer;
  const handoverNote = handoverNotes[activeModule.id] || '';
  const controlRecord = controlRecords[activeModule.id] || { prediction: '', target: '', verification: '', restoration: '' };
  const operationalReview = operationalReviews[activeModule.id] || { currentState: '', evidence: '', nextAction: '' };

  const persistLearningRecord = async (moduleId: string, updates: Record<string, unknown>) => {
    try {
      const response = await apiFetch(`/api/v1/private-lab-content/ot-water-treatment/learning/${moduleId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Your learning evidence could not be saved.');
      setLearningSaveError('');
      return response.json();
    } catch (error) {
      setLearningSaveError(error instanceof Error ? error.message : 'Your learning evidence could not be saved.');
      throw error;
    }
  };

  const updateLearningCheck = (answer: number) => {
    setLearningChecks((previous) => ({ ...previous, [activeModule.id]: answer }));
    setLearningSaveError('');
    void persistLearningRecord(activeModule.id, { evidence_check: answer }).catch(() => {});
  };
  const saveHandoverNote = async () => {
    if (!handoverNote.trim()) return;
    try { await persistLearningRecord(activeModule.id, { handover_note: handoverNote.trim() }); setHandoverSaved((previous) => ({ ...previous, [activeModule.id]: true })); } catch { /* Recovery is visible in the save error. */ }
  };
  const updateControlRecord = (field: keyof ControlRecord, value: string) => {
    setControlRecords((previous) => ({ ...previous, [activeModule.id]: { ...controlRecord, [field]: value } }));
    setControlRecordSaved((previous) => ({ ...previous, [activeModule.id]: false }));
  };
  const saveControlRecord = async () => {
    if (!Object.values(controlRecord).every((value) => value.trim())) return;
    try { await persistLearningRecord(activeModule.id, { control_record: controlRecord }); setControlRecordSaved((previous) => ({ ...previous, [activeModule.id]: true })); } catch { /* Recovery is visible in the save error. */ }
  };
  const updateOperationalReview = (field: keyof OperationalReview, value: string) => {
    setOperationalReviews((previous) => ({ ...previous, [activeModule.id]: { ...operationalReview, [field]: value } }));
    setOperationalReviewSaved((previous) => ({ ...previous, [activeModule.id]: false }));
  };
  const saveOperationalReview = async () => {
    if (!Object.values(operationalReview).every((value) => value.trim())) return;
    try { await persistLearningRecord(activeModule.id, { operational_review: operationalReview }); setOperationalReviewSaved((previous) => ({ ...previous, [activeModule.id]: true })); } catch { /* Recovery is visible in the save error. */ }
  };

  // Runtime Shield is a self-contained workshop, not a sequence of flag modules.
  // Rendering it before the generic module loading guard prevents an intentional
  // empty module list from being mistaken for a stalled content request.
  if (isRuntimeShieldLab) {
    return (
      <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
        <header className="h-16 flex-shrink-0 border-b border-slate-800 bg-slate-900 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-700/60 bg-emerald-950/50">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-white">ISO/IEC 42001 Runtime Shield Workshop</p>
              <p className="truncate text-xs text-slate-400">Isolated AI security training environment</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
              runtimeProvisioned
                ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
                : runtimeProvisionError
                  ? 'border-rose-900 bg-rose-950/50 text-rose-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${runtimeProvisioned ? 'bg-emerald-400' : runtimeProvisionError ? 'bg-rose-400' : 'bg-slate-500'}`} />
              {runtimeProvisioned ? 'Workshop live' : runtimeProvisionError ? 'Start failed' : runtimeProvisioning ? 'Starting' : 'Ready'}
            </span>
            <button
              onClick={handleReturn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" /> Exit
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 p-4 sm:p-6">
          <section className="mx-auto flex h-full w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/20">
            <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div>
                <h1 className="text-base font-bold text-white">Runtime Shield Console</h1>
                <p className="mt-0.5 text-xs text-slate-400">Launch a private workshop session to inspect and protect the AI runtime.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={startRuntimeShieldLab}
                  disabled={runtimeProvisioned || runtimeProvisioning}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3.5 py-2 text-xs font-extrabold text-emerald-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  {runtimeProvisioning ? 'Starting workshop…' : runtimeProvisioned ? 'Workshop running' : 'Start workshop'}
                </button>
                <button
                  onClick={stopRuntimeShieldLab}
                  disabled={!runtimeProvisioned}
                  className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Stop
                </button>
              </div>
            </div>

            {runtimeProvisioned && runtimeUrls?.workshop ? (
              <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] bg-slate-950">
                <div className="min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800">
                  <div className="h-8 px-3 flex items-center bg-slate-900 border-b border-slate-800 text-[11px] font-bold tracking-wide text-emerald-300">
                    RUNTIME SHIELD
                  </div>
                  <iframe
                    title="ISO/IEC 42001 Runtime Shield Workshop"
                    src={runtimeUrls.workshop}
                    className="min-h-0 flex-1 border-0 bg-white"
                    sandbox="allow-forms allow-modals allow-scripts allow-same-origin"
                  />
                </div>

                <div className="min-h-0 flex flex-col">
                  <div className="h-8 px-3 flex items-center bg-slate-900 border-b border-slate-800 text-[11px] font-bold tracking-wide text-blue-300">
                    VS CODE · LEARNER WORKSPACE
                  </div>

                  {runtimeUrls.editor ? (
                    <iframe
                      title="Runtime Shield VS Code Workspace"
                      src={runtimeUrls.editor}
                      className="min-h-0 flex-1 border-0 bg-[#1e1e1e]"
                      allow="clipboard-read; clipboard-write"
                      onLoad={(event) => bindRuntimeEditorActivity(event.currentTarget)}
                    />
                  ) : (
                    <div className="flex-1 grid place-items-center p-6 text-center text-xs text-slate-400">
                      Restart this workshop session to enable the VS Code learner workspace.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-800/60 bg-emerald-950/40">
                    <ShieldCheck className="h-7 w-7 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">Your workshop is ready to launch</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Start an isolated Runtime Shield session. It may take a few minutes to prepare when the training environment is cold.</p>
                  {runtimeProvisionError && <p role="alert" className="mt-4 rounded-lg border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{runtimeProvisionError}</p>}
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (contentError) return <div role="alert">{contentError}</div>;
  if (!currentModules.length) return <div role="status">Loading lab content…</div>;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`h-screen flex flex-col font-sans text-slate-800 dark:text-slate-100 transition-colors overflow-hidden ${
      isOTWaterLab ? 'bg-[#eef4f2] dark:bg-[#071817]' : 'bg-[#F8FAFC] dark:bg-slate-950'
    }`}>
      {/* Top Nav */}
      <header className={`h-16 border-b px-4 sm:px-6 flex items-center justify-between z-20 flex-shrink-0 ${
        isOTWaterLab
          ? 'bg-[#fbfdfc] dark:bg-[#0b211e] border-[#d9e5e1] dark:border-[#1d3934]'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
      }`}>
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
            {isOTWaterLab ? (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f766e] text-white shadow-sm">
                  <CircleDot className="h-4 w-4" />
                </span>
                <span className="font-semibold text-slate-900 dark:text-white text-sm">Water treatment lab</span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ACTIVE SESSION
                </span>
                <span className="font-bold text-slate-800 dark:text-white text-sm">{labTitle}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`hidden sm:flex items-center gap-2 text-xs font-bold border px-3 py-1.5 rounded-lg ${
            isOTWaterLab ? 'bg-[#f1f7f5] dark:bg-[#102b27] border-[#d9e5e1] dark:border-[#26443e]' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}>
            <span className="text-slate-400 dark:text-slate-500">{isOTWaterLab ? 'Stage' : 'Module'}</span>
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
            onClick={() => { if (window.confirm('Exit this challenge session?')) { stopOTWaterLab(); handleReturn(); } }}
            className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Session</span>
          </button>
        </div>
      </header>

      {/* Main split */}
      <div className={`flex-1 min-h-0 ${isOTWaterLab
        ? 'grid grid-cols-1 xl:grid-cols-[18rem_minmax(0,1fr)_19rem] gap-4 p-4 lg:p-5 overflow-y-auto xl:overflow-hidden'
        : 'p-6 flex flex-col md:flex-row gap-6 overflow-hidden'
      }`}>

        {/* ── Left Panel ── */}
        <div className={`bg-white dark:bg-slate-900 border flex flex-col min-h-0 overflow-y-auto ${isOTWaterLab
          ? 'w-full rounded-xl border-[#d9e5e1] dark:border-[#1d3934] p-5 space-y-5 shadow-[0_10px_30px_rgba(15,118,110,0.06)]'
          : 'w-full md:w-[45%] border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6'
        }`}>

          {/* Module pill selector */}
          {isOTWaterLab && (
            <nav aria-label="OT Water Treatment learning journey" className="space-y-1 border-b border-[#d9e5e1] pb-4 dark:border-[#1d3934]">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Learning journey</p>
              {currentModules.map((module, index) => {
                const locked = index === 3 && (!currentModules[2] || !solvedModules.has(currentModules[2].id));
                const active = index === activeChallengeIdx;
                return <button key={module.id} type="button" disabled={locked} onClick={() => { setActiveChallengeIdx(index); setFlagInput(''); setSubmissionStatus('idle'); }} className={`grid w-full grid-cols-[1.5rem_1fr_auto] items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors ${locked ? 'cursor-not-allowed opacity-45' : active ? 'bg-[#0f766e] text-white' : 'text-slate-700 hover:bg-[#f0f6f4] dark:text-slate-300 dark:hover:bg-[#102b27]'}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${solvedModules.has(module.id) ? 'bg-emerald-400 text-emerald-950' : active ? 'bg-white text-[#0f766e]' : 'border border-current'}`}>{solvedModules.has(module.id) ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}</span>
                  <span className="font-medium">{WATER_STAGE_GUIDES[index]?.journeyLabel}</span>
                  {locked ? <Lock className="h-3.5 w-3.5 text-amber-600" aria-label="Safety gate" /> : <span className="tabular-nums opacity-70">{WATER_STAGE_GUIDES[index]?.duration}</span>}
                </button>;
              })}
            </nav>
          )}
          <div className={`flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 ${isOTWaterLab ? 'hidden' : ''}`}>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {isOTWaterLab ? 'Lab sequence' : 'Network Recon Modules'}
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
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {isOTWaterLab ? `Stage ${activeChallengeIdx + 1}: ${activeModule.title.replace(/^Module \d+: /, '')}` : activeModule.title.replace(/^Module \d+: /, '')}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {activeModule.description}
            </p>
          </div>

          {/* Mission box */}
          <div className={`border rounded-xl p-4 space-y-2 ${isOTWaterLab ? 'bg-[#e9f6f2] border-[#b8e3d8] dark:bg-[#102b27] dark:border-[#1d5d50]' : 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40'}`}>
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#2563EB] dark:text-blue-400 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{isOTWaterLab ? 'Mission brief — start here' : 'Mission'}</span>
            </div>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
              {activeModule.mission}
            </p>
            {isOTWaterLab && <p className="border-t border-[#b8e3d8] pt-2 text-xs leading-relaxed text-[#0b554e] dark:border-[#1d5d50] dark:text-emerald-200"><strong>Next:</strong> Start the operator console, then complete the first objective below. Keep this stage read-only.</p>}
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
        <div className={`bg-[#091513] border border-[#18342f] flex flex-col min-h-[32rem] overflow-hidden ${
          isOTWaterLab ? 'rounded-xl shadow-[0_18px_48px_rgba(7,24,23,0.2)]' : 'flex-1 rounded-2xl border-slate-800 shadow-xl'
        }`}>
          {/* Terminal Header */}
          <div className="h-11 bg-[#0F172A] border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              </div>
              <span className="font-mono text-xs font-bold text-slate-300">
                {isReconLab ? 'SecureGuard Red Team Workstation — Live Container' : isOTWaterLab ? 'Operator console · isolated environment' : isRuntimeShieldLab ? 'Runtime Shield · isolated AI security workshop' : 'Terminal Emulator — Execution Environment'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#00FF9D] bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF9D] animate-pulse" />
                {isReconLab
                  ? (reconProvisioned ? 'CONTAINER LIVE' : reconProvisionError ? 'PROVISION FAILED' : reconProvisioning ? 'PROVISIONING...' : 'NOT STARTED')
                  : isOTWaterLab
                    ? (otProvisioned ? 'OT TASK LIVE' : otProvisionError ? 'PROVISION FAILED' : otProvisioning ? 'PROVISIONING...' : 'NOT STARTED')
                  : isRuntimeShieldLab
                    ? (runtimeProvisioned ? 'WORKSHOP LIVE' : runtimeProvisionError ? 'PROVISION FAILED' : runtimeProvisioning ? 'PROVISIONING...' : 'NOT STARTED')
                  : 'INFRASTRUCTURE ONLINE'}
              </span>
              {isReconLab && (
                <>
                  <button
                    onClick={startReconLab}
                    disabled={reconProvisioning || reconProvisioned}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-950 text-[11px] font-extrabold px-3 py-1 rounded-lg transition-colors"
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
                    onClick={isOTWaterLab ? startOTWaterLab : isRuntimeShieldLab ? startRuntimeShieldLab : () => setTerminalConnected(true)}
                    disabled={isRuntimeShieldLab ? (runtimeProvisioned || runtimeProvisioning) : (terminalConnected || otProvisioning)}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-950 text-[11px] font-extrabold px-3 py-1 rounded-lg transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isRuntimeShieldLab ? (runtimeProvisioning ? 'Starting...' : 'Start Workshop') : (otProvisioning ? 'Starting...' : 'Start Terminal')}</span>
                  </button>
                  <button
                    onClick={isOTWaterLab ? stopOTWaterLab : isRuntimeShieldLab ? stopRuntimeShieldLab : () => setTerminalConnected(false)}
                    disabled={isRuntimeShieldLab ? !runtimeProvisioned : (!terminalConnected || commandBusy)}
                    className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-[11px] font-extrabold px-3 py-1 rounded-lg transition-colors"
                  >
                    <span>Disconnect</span>
                  </button>
                  {!isOTWaterLab && !isRuntimeShieldLab && <button
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
                  </button>}
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
          ) : isRuntimeShieldLab && runtimeProvisioned && runtimeUrls ? (
            <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-2 bg-slate-950">
              <div className="min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800">
                <div className="h-8 px-3 flex items-center bg-slate-900 border-b border-slate-800 text-[11px] font-bold tracking-wide text-emerald-300">RUNTIME SHIELD</div>
                <iframe
                  title="ISO/IEC 42001 Runtime Shield Workshop"
                  src={runtimeUrls.workshop}
                  className="min-h-0 flex-1 border-0 bg-white"
                  sandbox="allow-forms allow-modals allow-scripts allow-same-origin"
                />
              </div>
              <div className="min-h-0 flex flex-col">
                <div className="h-8 px-3 flex items-center bg-slate-900 border-b border-slate-800 text-[11px] font-bold tracking-wide text-blue-300">VS CODE · LEARNER WORKSPACE</div>
                {runtimeUrls.editor ? (
                  <iframe
                    title="Runtime Shield VS Code Workspace"
                    src={runtimeUrls.editor}
                    className="min-h-0 flex-1 border-0 bg-[#1e1e1e]"
                    allow="clipboard-read; clipboard-write"
                    onLoad={(event) => bindRuntimeEditorActivity(event.currentTarget)}
                  />
                ) : (
                  <div className="flex-1 grid place-items-center p-6 text-center text-xs text-slate-400">
                    Restart this workshop session to enable the VS Code learner workspace.
                  </div>
                )}
              </div>
            </div>
          ) : isOTWaterLab && terminalConnected ? (
            <>
              {otUrls && (
                <div className="px-5 py-2.5 bg-[#0d211e] border-b border-[#18342f] flex flex-wrap gap-2 text-xs font-bold">
                  <a className="inline-flex items-center gap-1.5 rounded-md bg-[#12332d] px-2.5 py-1.5 text-emerald-300 hover:bg-[#17443a] focus:outline-none focus:ring-2 focus:ring-emerald-300" href={otUrls.scada} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> SCADA workspace</a>
                  <a className="inline-flex items-center gap-1.5 rounded-md bg-[#12332d] px-2.5 py-1.5 text-emerald-300 hover:bg-[#17443a] focus:outline-none focus:ring-2 focus:ring-emerald-300" href={otUrls.wireshark} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Packet analysis</a>
                </div>
              )}
              <RealTerminal
                labId="ot-water-treatment"
                token={token ?? undefined}
                wsPath="/api/v1/ot-water/terminal"
                terminalTitle="AquaShield OT Security Workstation"
                height="100%"
                className="min-h-0 flex-1 rounded-none border-x-0 border-b-0 shadow-none"
                onCommand={recordTerminalCommand}
              />
            </>
          ) : terminalConnected ? (
            <>
              {/* Simulated terminal output for legacy non-OT labs. */}
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
              <p className="max-w-sm text-slate-400 font-mono text-sm">
                {isRuntimeShieldLab
                  ? <>Start the isolated Runtime Shield workshop. The AI security console will open here when its private session is ready.</>
                  : isOTWaterLab
                  ? <>Start a private water-treatment environment. Your SCADA and packet-analysis tools will appear here when it is ready.</>
                  : <>Click <span className="text-[#00FF9D] font-bold">"Start Terminal"</span> to connect to your execution workstation environment.</>}
              </p>
              {isOTWaterLab && otProvisionError && <p className="text-rose-400 font-mono text-xs">{otProvisionError}</p>}
              {isRuntimeShieldLab && runtimeProvisionError && <p className="text-rose-400 font-mono text-xs">{runtimeProvisionError}</p>}
            </div>
          )}
        </div>

        {isOTWaterLab && (
          <aside className="min-h-0 overflow-y-auto rounded-xl border border-[#d9e5e1] bg-[#fbfdfc] p-5 text-slate-800 shadow-[0_10px_30px_rgba(15,118,110,0.06)] dark:border-[#1d3934] dark:bg-[#0b211e] dark:text-slate-100 xl:order-none">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dcefe9] text-[#0f766e] dark:bg-[#12332d] dark:text-emerald-300">
                <BookOpen className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Stage support</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Use this after reading the mission brief on the left.</p>
              </div>
            </div>

            <section className="mt-6 border-y border-[#d9e5e1] py-4 dark:border-[#1d3934]">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Lab progress</span>
                <span className="font-semibold tabular-nums text-[#0f766e] dark:text-emerald-300">{completedModules}/{currentModules.length} stages</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dce8e4] dark:bg-[#17342f]" aria-label={`${completedModules} of ${currentModules.length} stages complete`}>
                <div className="h-full rounded-full bg-[#0f766e] transition-[width] duration-200" style={{ width: `${currentModules.length ? (completedModules / currentModules.length) * 100 : 0}%` }} />
              </div>
            </section>

            <section className="mt-6 border-y border-[#d9e5e1] py-5 dark:border-[#1d3934]">
              {learningSaveError && <p role="alert" className="mb-3 text-xs font-medium text-rose-700 dark:text-rose-300">{learningSaveError} Retry the learning record; console work is unaffected.</p>}
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">When the console is live</h3>
              <p className="mt-1 text-xs font-medium text-[#0f766e] dark:text-emerald-300">Observe first. Use this guidance to interpret what you find.</p>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{waterGuide.brief}</p>
              <p className="mt-3 border-y border-amber-300/70 py-2 text-xs leading-5 text-amber-900 dark:border-amber-700 dark:text-amber-200">{waterGuide.safetyNote}</p>
              <div className="mt-3 flex gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0f766e]" />{waterGuide.interpretation}</div>
              <fieldset className="mt-4"><legend className="text-xs font-semibold text-slate-700 dark:text-slate-200">Evidence check</legend><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{waterGuide.evidenceQuestion}</p><div className="mt-2 space-y-2">{waterGuide.answers.map((answer, index) => <label key={answer} className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><input type="radio" name={`evidence-${activeModule.id}`} checked={activeCheckAnswer === index} onChange={() => updateLearningCheck(index)} className="mt-1 accent-emerald-600" />{answer}</label>)}</div>{activeCheckAnswer !== undefined && <p className={`mt-2 text-xs font-medium ${hasCorrectLearningCheck ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{hasCorrectLearningCheck ? waterGuide.challengeReady : 'Revisit the interpretation note, then try again.'}</p>}</fieldset>
              <label className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-200">Operational finding<textarea value={handoverNote} onChange={(event) => { setHandoverNotes((previous) => ({ ...previous, [activeModule.id]: event.target.value })); setHandoverSaved((previous) => ({ ...previous, [activeModule.id]: false })); }} placeholder="Observed state, safety relevance, next safe action" className="mt-2 min-h-20 w-full rounded-md border border-[#b8cbc5] bg-white px-2 py-1.5 text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f766e] dark:border-[#26443e] dark:bg-[#071817] dark:text-slate-100" /></label><button type="button" disabled={!handoverNote.trim()} onClick={saveHandoverNote} className="mt-2 rounded-md bg-[#24303A] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{handoverSaved[activeModule.id] ? 'Handover saved' : 'Save handover'}</button>
              {activeChallengeIdx === 3 && <div className="mt-4 space-y-2"><h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Safety record</h4>{(['prediction', 'target', 'verification', 'restoration'] as (keyof ControlRecord)[]).map((field) => <input key={field} value={controlRecord[field]} onChange={(event) => updateControlRecord(field, event.target.value)} placeholder={field} className="w-full rounded-md border border-[#b8cbc5] bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-[#26443e] dark:bg-[#071817] dark:text-slate-100" />)}<button type="button" disabled={!Object.values(controlRecord).every((value) => value.trim())} onClick={saveControlRecord} className="rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-amber-950 disabled:opacity-40">{controlRecordSaved[activeModule.id] ? 'Safety record saved' : 'Save safety record'}</button></div>}
              {activeChallengeIdx === 4 && <div className="mt-4 space-y-2"><h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Operational review</h4>{(['currentState', 'evidence', 'nextAction'] as (keyof OperationalReview)[]).map((field) => <textarea key={field} value={operationalReview[field]} onChange={(event) => updateOperationalReview(field, event.target.value)} placeholder={field} className="min-h-16 w-full rounded-md border border-[#b8cbc5] bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f766e] dark:border-[#26443e] dark:bg-[#071817] dark:text-slate-100" />)}<button type="button" disabled={!Object.values(operationalReview).every((value) => value.trim())} onClick={saveOperationalReview} className="rounded-md bg-[#0f766e] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{operationalReviewSaved[activeModule.id] ? 'Operational review saved' : 'Save review'}</button></div>}
            </section>

            <section className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Assigned reading</h3>
                {otStudyLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label="Loading study material" />}
              </div>
              {otStudyMaterials.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {otStudyMaterials.slice(0, 4).map((material) => {
                    const active = material.id === activeStudyMaterial?.id;
                    return (
                      <button
                        key={material.id}
                        type="button"
                        onClick={() => setActiveStudyMaterialId(material.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f766e] ${active
                          ? 'bg-[#dcefe9] text-[#0b554e] dark:bg-[#12332d] dark:text-emerald-200'
                          : 'text-slate-600 hover:bg-[#f0f6f4] dark:text-slate-300 dark:hover:bg-[#102b27]'}`}
                      >
                        <span className="block truncate font-medium">{material.title}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{material.readTime || material.category}</span>
                      </button>
                    );
                  })}
                </div>
              ) : !otStudyLoading && (
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">No OT-specific notes have been assigned yet. The current mission and objectives remain your runbook.</p>
              )}

              {activeStudyMaterial && (
                <div className="mt-3 border-t border-[#d9e5e1] pt-3 dark:border-[#1d3934]">
                  <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{activeStudyMaterial.description}</p>
                  {!!activeStudyMaterial.content?.length && (
                    <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {activeStudyMaterial.content.slice(0, 3).map((point, index) => <li key={index} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#0f766e]" />{point}</li>)}
                    </ul>
                  )}
                  {activeStudyMaterial.pdfUrl && (
                    <button type="button" onClick={() => navigate(`/study-material/view/${activeStudyMaterial.id}`)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f766e] hover:text-[#0a5b54] focus:outline-none focus:ring-2 focus:ring-[#0f766e] dark:text-emerald-300">
                      Open full reference <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </section>
          </aside>
        )}
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
