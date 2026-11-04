import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { StuckHints } from '../../components/workspace/StuckHints';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  ListChecks,
  Loader2,
  Play,
  Square,
  Target,
  X,
} from 'lucide-react';

import { RealTerminal } from '../../components/RealTerminal';
import { LabArtImage } from '../../components/art/LabArtImage';
import { useAuth } from '../../context';
import { Mascot } from '../../components/mascot/Mascot';
import { AmbientBackground } from '../../components/ui/AmbientBackground';
import {
  ChecksPanel,
  ClearedCelebration,
  GradingPopup,
  type GradingPhase,
  HistoryPanel,
  ResultBanner,
} from '../../components/workspace/WorkspaceParts';
import { ACTIVE_SUBMISSION_STATUSES, TERMINAL_SUBMISSION_STATUSES, gradingStep } from '../../utils/submissions';
import {
  sysadminGradingService,
  type SysadminLabDetail,
  type SysadminLabSummary,
  type SysadminSubmission,
  type SysadminWorkspaceSession,
} from '../../services/sysadminGradingService';

const SUBMISSION_POLL_TIMEOUT_MS = 15 * 60 * 1000;

// Warm graders usually finish quickly, while a scale-from-zero grader can take
// several minutes. Poll aggressively at first, then back off. Positive jitter
// prevents a classroom of simultaneous submissions from polling in lockstep.
function submissionPollDelayMs(elapsedMs: number): number {
  let baseMs: number;

  if (elapsedMs < 10_000) baseMs = 2_000;
  else if (elapsedMs < 45_000) baseMs = 4_000;
  else if (elapsedMs < 120_000) baseMs = 7_000;
  else baseMs = 12_000;

  const jitterMs = Math.floor(
    Math.random() * Math.max(1, Math.floor(baseMs * 0.25)),
  );

  return baseMs + jitterMs;
}

function initialSubmissionPollDelayMs(): number {
  return 500 + Math.floor(Math.random() * 500);
}

const CATALOGS = {
  sysadmin: {
    id: 'linux-sysadmin-lab',
    basePath: '/labs/linux-sysadmin',
    title: 'Linux System Administration',
    subtitle: 'Red Hat-aligned terminal challenges with state-based autograding',
  },
  workshop: {
    id: 'linux-security-workshop',
    basePath: '/labs/linux-security-workshop',
    title: 'Linux Security and Cyber Defense Workshop',
    subtitle: 'Two days · Foundation → Practitioner → Advanced · 12 exercises',
  },
  race: {
    id: 'race-conditions-lab',
    basePath: '/labs/race-conditions-lab',
    title: 'Race Conditions: The Front Desk Case',
    subtitle: 'A week at the Front Desk · 15 modules · your own case folder for every module',
  },
};

const PLAIN_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`)/g;
const ITALIC_PATTERN = (() => {
  try {
    return new RegExp('(\\*\\*[^*]+\\*\\*|(?<![\\w*])\\*[^\\s*][^*]*[^\\s*]\\*(?![\\w*])|`[^`]+`)', 'g');
  } catch {
    return PLAIN_PATTERN;
  }
})();

function renderInline(text: string, italic = false): React.ReactNode[] {
  const parts = text.split(italic ? ITALIC_PATTERN : PLAIN_PATTERN).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (italic && part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900 dark:text-slate-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function joinWrappedLines(lines: string[]): string[] {
  const joined: string[] = [];
  let inFence = false;
  let canJoin = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      joined.push(line);
      canJoin = false;
    } else if (inFence) {
      joined.push(raw);
    } else if (canJoin && line.trim() && !/^(#{1,2} |- |\d+\.\s|\||>)/.test(line)) {
      joined[joined.length - 1] += ` ${line.trim()}`;
    } else {
      joined.push(line);
      canJoin = Boolean(line.trim()) && !/^(#{1,2} |\||>)/.test(line);
    }
  }
  return joined;
}

const QuestionMarkdown: React.FC<{ markdown: string; rich?: boolean }> = ({ markdown, rich = false }) => {
  const split = markdown.split(/\r?\n/);
  const lines = rich ? joinWrappedLines(split) : split;
  const nodes: React.ReactNode[] = [];
  let inCode = false;
  let codeLanguage = '';
  let codeLines: string[] = [];
  let tableRows: string[][] = [];
  let quoteLines: string[] = [];

  const flushQuote = (key: string) => {
    nodes.push(
      <div key={key} className="rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
        {renderInline(quoteLines.join(' '), true)}
      </div>,
    );
    quoteLines = [];
  };

  const flushTable = (key: string) => {
    const [head, ...body] = tableRows;
    nodes.push(
      <div key={key} className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-950/50">
            <tr>
              {head.map((cell, i) => (
                <th key={i} className="px-3 py-2 font-bold text-slate-900 dark:text-white">{renderInline(cell, true)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className="border-t border-slate-200 dark:border-slate-800">
                {row.map((cell, i) => (
                  <td key={i} className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">{renderInline(cell, true)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    tableRows = [];
  };

  const flushCode = (key: string) => {
    nodes.push(
      <pre
        key={key}
        className="my-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-100"
      >
        <code data-language={codeLanguage || undefined}>{codeLines.join('\n')}</code>
      </pre>,
    );
    codeLines = [];
    codeLanguage = '';
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    if (quoteLines.length && !(rich && line.startsWith('>'))) flushQuote(`quote-${index}`);
    const fence = (rich ? line.trimStart() : line).match(/^```(.*)$/);
    if (fence) {
      if (inCode) flushCode(`code-${index}`);
      else codeLanguage = fence[1].trim();
      inCode = !inCode;
      return;
    }
    if (inCode) {
      codeLines.push(rawLine);
      return;
    }
    if (rich && line.startsWith('|')) {
      const cells = line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      if (!cells.every((cell) => /^:?-+:?$/.test(cell))) tableRows.push(cells);
      return;
    }
    if (tableRows.length) flushTable(`table-${index}`);
    if (rich && line.startsWith('>')) {
      const quote = line.replace(/^>\s?/, '').trim();
      if (quote) {
        quoteLines.push(quote);
      } else {
        if (quoteLines.length) flushQuote(`quote-${index}`);
        nodes.push(<div key={index} className="h-1.5" />);
      }
      return;
    }
    if (!line.trim()) {
      nodes.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }
    if (line.startsWith('### ')) {
      nodes.push(
        <h4
            key={index}
            className="mt-4 mb-2 text-sm font-bold text-slate-900 dark:text-white"
          >
          {renderInline(line.slice(4))}
        </h4>,
      );
      return;
    }
    if (line.startsWith('## ')) {
      nodes.push(
        <h3 key={index} className="mt-5 mb-2 text-sm font-bold text-slate-900 dark:text-white">
          {renderInline(line.slice(3), rich)}
        </h3>,
      );
      return;
    }
    if (line.startsWith('# ')) {
      nodes.push(
        <h2 key={index} className="mb-3 text-lg font-bold text-slate-950 dark:text-white">
          {renderInline(line.slice(2), rich)}
        </h2>,
      );
      return;
    }
    const ordered = line.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      nodes.push(
        <div key={index} className="my-1.5 flex gap-2.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
          <span className="min-w-5 font-semibold tabular text-brand-600 dark:text-brand-400">{ordered[1]}.</span>
          <span>{renderInline(ordered[2], rich)}</span>
        </div>,
      );
      return;
    }
    if (line.startsWith('- ')) {
      nodes.push(
        <div key={index} className="my-1.5 flex gap-2.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
          <span>{renderInline(line.slice(2), rich)}</span>
        </div>,
      );
      return;
    }
    nodes.push(
      <p key={index} className="text-sm leading-6 text-slate-700 dark:text-slate-300">
        {renderInline(line, rich)}
      </p>,
    );
  });

  if (inCode && codeLines.length) flushCode('code-final');
  if (quoteLines.length) flushQuote('quote-final');
  if (tableRows.length) flushTable('table-final');
  return <div>{nodes}</div>;
};

type ChallengeState = 'passed' | 'attempted';

// Back-to-back clears in this browser session, for the combo reward.
const COMBO_KEY = 'cyberrange-combo';
type BriefTab = 'brief' | 'checks' | 'history';

const DIFFICULTY_TONE: Record<string, string> = {
  beginner: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  intermediate: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
  advanced: 'bg-orange-50 text-orange-800 dark:bg-orange-500/10 dark:text-orange-200',
};

function minutesLeft(expires: string | null | undefined, now: number) {
  if (!expires) return null;
  const left = Math.round((new Date(expires).getTime() - now) / 60000);
  return Number.isNaN(left) ? null : Math.max(0, left);
}

const SubmitBar: React.FC<{ filename: string; grading: boolean }> = ({ filename, grading }) => {
  const [copied, setCopied] = useState(false);
  const command = `submit ~/${filename}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the command is still on screen */ }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      {!grading ? (
        <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          When you are ready, run
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[13px] text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            title="Copy command"
          >
            {command}
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          in the terminal.
        </span>
      ) : (
        <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
          Grading your work. Progress is beside the brief.
        </span>
      )}
      <span className="hidden text-xs text-slate-400 sm:block">Graded on a separate machine</span>
    </div>
  );
};

export const LinuxSysadminLabPage: React.FC<{ workshop?: boolean; race?: boolean }> = ({ workshop = false, race = false }) => {
  const navigate = useNavigate();
  const catalog = CATALOGS[workshop ? 'workshop' : race ? 'race' : 'sysadmin'];
  const basePath = catalog.basePath;
  const { labId } = useParams<{ labId?: string }>();
  const { apiFetch, token } = useAuth();

  const [labs, setLabs] = useState<SysadminLabSummary[]>([]);
  const [detail, setDetail] = useState<SysadminLabDetail | null>(null);
  const [submissions, setSubmissions] = useState<SysadminSubmission[]>([]);
  const [workspace, setWorkspace] = useState<SysadminWorkspaceSession | null>(null);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [waitingForResult, setWaitingForResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeStates, setChallengeStates] = useState<Record<string, ChallengeState>>({});
  const [tab, setTab] = useState<BriefTab>('brief');
  const [watchFrom, setWatchFrom] = useState(0);
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState<{ result: SysadminSubmission; newBlock: boolean; firstTry: boolean; combo: number } | null>(null);
  const [popup, setPopup] = useState<{ phase: GradingPhase; failing: number } | null>(null);
  const [typicalSeconds, setTypicalSeconds] = useState<number | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pollGeneration = useRef(0);

  const selectedLabId = labId || labs[0]?.lab_id || '';
  const latestSubmission = submissions[0] || null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshSubmissions = useCallback(async () => {
    if (!selectedLabId) return [] as SysadminSubmission[];
    try {
      const rows = await sysadminGradingService.listSubmissions(apiFetch, selectedLabId, 10);
      setSubmissions(rows);
      return rows;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load submission history.');
      return [] as SysadminSubmission[];
    }
  }, [apiFetch, selectedLabId]);

  // Which challenges the student has passed or tried, for the challenge rail.
  const refreshChallengeStates = useCallback(async () => {
    try {
      const rows = await sysadminGradingService.listRecentSubmissions(apiFetch, 50);
      const states: Record<string, ChallengeState> = {};
      rows.forEach((row) => {
        if (row.passed) states[row.lab_id] = 'passed';
        else if (!states[row.lab_id]) states[row.lab_id] = 'attempted';
      });
      setChallengeStates(states);
      // The grading estimate: the middle of this student's recent grading times.
      const durations = rows
        .map((row) => (new Date(row.completed_at ?? row.graded_at ?? '').getTime() - new Date(row.submitted_at).getTime()) / 1000)
        .filter((seconds) => Number.isFinite(seconds) && seconds > 3 && seconds < 900)
        .sort((a, b) => a - b);
      if (durations.length) setTypicalSeconds(Math.round(durations[Math.floor(durations.length / 2)]));
    } catch { /* the rail simply shows no progress marks */ }
  }, [apiFetch]);

  useEffect(() => { void refreshChallengeStates(); }, [refreshChallengeStates]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingLabs(true);
      setError(null);
      try {
        const rows = await sysadminGradingService.listLabs(apiFetch, catalog.id);
        if (cancelled) return;
        setLabs(rows);
        if (!labId && rows.length) {
          navigate(`${basePath}/${encodeURIComponent(rows[0].lab_id)}`, { replace: true });
        } else if (labId && rows.length && !rows.some((row) => row.lab_id === labId)) {
          navigate(`${basePath}/${encodeURIComponent(rows[0].lab_id)}`, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load Linux Sysadmin questions.');
      } finally {
        if (!cancelled) setLoadingLabs(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [apiFetch, labId, navigate, catalog.id, basePath]);

  useEffect(() => {
    if (!selectedLabId || loadingLabs || !labs.some((row) => row.lab_id === selectedLabId)) return;
    let cancelled = false;
    const load = async () => {
      setLoadingDetail(true);
      setError(null);
      try {
        const [question, rows, session] = await Promise.all([
          sysadminGradingService.getLab(apiFetch, selectedLabId),
          sysadminGradingService.listSubmissions(apiFetch, selectedLabId, 10),
          sysadminGradingService.getWorkspace(apiFetch),
        ]);
        if (cancelled) return;
        setDetail(question);
        setSubmissions(rows);
        setWorkspace(session);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load the selected question.');
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };
    // A grading run for the previous question stops here, popup and all.
    pollGeneration.current += 1;
    setWaitingForResult(false);
    setWaitingSince(null);
    setPopup(null);
    setTab('brief');
    setRailOpen(false);
    void load();
    return () => { cancelled = true; };
  }, [apiFetch, selectedLabId, loadingLabs, labs]);

  useEffect(() => () => { pollGeneration.current += 1; }, []);

  const startWorkspace = async () => {
    if (!selectedLabId || workspaceBusy) return;
    setWorkspaceBusy(true);
    setError(null);
    try {
      const session = await sysadminGradingService.startWorkspace(apiFetch, selectedLabId);
      setWorkspace(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start workspace.');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  // Ending or moving a workspace deletes its machine and the files on it, so ask first.
  const [confirm, setConfirm] = useState<'end' | 'switch' | null>(null);
  const requestStart = () => {
    if (workspace && workspace.lab_id !== selectedLabId) setConfirm('switch');
    else void startWorkspace();
  };
  const closeConfirm = useCallback(() => setConfirm(null), []);
  const titleOf = (labId: string | undefined) => labs.find((lab) => lab.lab_id === labId)?.title.replace(/^\d+\.\s*/, '') ?? 'the other challenge';

  const stopWorkspace = async () => {
    if (workspaceBusy) return;
    setWorkspaceBusy(true);
    setError(null);
    try {
      await sysadminGradingService.stopWorkspace(apiFetch);
      setWorkspace(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to stop workspace.');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  // A finished attempt: finish the progress card, show the checks, celebrate a
  // pass, keep the combo going (or reset it), and update the rail.
  const settleResult = useCallback((result: SysadminSubmission | undefined, rows: SysadminSubmission[] = []) => {
    setWaitingForResult(false);
    setWaitingSince(null);
    if (!result || !TERMINAL_SUBMISSION_STATUSES.has(result.status.toUpperCase())) {
      setPopup(null);
      return;
    }
    setTab('checks');
    const failing = result.tests.filter((test) => !test.passed).length;
    let combo = 0;
    try {
      combo = result.passed ? Number(window.sessionStorage.getItem(COMBO_KEY) ?? 0) + 1 : 0;
      window.sessionStorage.setItem(COMBO_KEY, String(combo));
    } catch { /* storage blocked: no combo */ }

    if (result.passed) {
      setPopup({ phase: 'passed', failing: 0 });
      // A first clear adds a block to the student's cube; a repeat pass does not.
      const newBlock = challengeStates[result.lab_id] !== 'passed';
      const firstTry = !rows.some((row) => row.lab_id === result.lab_id && row.submission_id !== result.submission_id);
      window.setTimeout(() => {
        setPopup(null);
        setCelebrate({ result, newBlock, firstTry, combo });
      }, 1300);
    } else {
      setPopup({ phase: result.error ? 'error' : 'failed', failing });
      window.setTimeout(() => setPopup((current) => (current && current.phase !== 'grading' ? null : current)), 9000);
    }
    void refreshChallengeStates();
  }, [refreshChallengeStates, challengeStates]);

  const pollForSubmission = useCallback(() => {
    if (!selectedLabId) return;

    const generation = ++pollGeneration.current;
    const previousId = submissions[0]?.submission_id ?? 0;
    const startedPollingAt = Date.now();

    setWatchFrom(previousId);
    setWaitingSince(startedPollingAt);
    setWaitingForResult(true);
    setPopup({ phase: 'grading', failing: 0 });

    const poll = async () => {
      if (generation !== pollGeneration.current) return;

      const rows = await refreshSubmissions();

      if (generation !== pollGeneration.current) return;

      const newest = rows[0];
      const newAttempt = Boolean(newest && newest.submission_id > previousId);
      const finished = Boolean(newAttempt && newest && TERMINAL_SUBMISSION_STATUSES.has(newest.status.toUpperCase()));
      const elapsedMs = Date.now() - startedPollingAt;

      if (finished || elapsedMs >= SUBMISSION_POLL_TIMEOUT_MS) {
        settleResult(finished ? newest : undefined, rows);
        return;
      }

      window.setTimeout(() => { void poll(); }, submissionPollDelayMs(elapsedMs));
    };

    window.setTimeout(() => { void poll(); }, initialSubmissionPollDelayMs());
  }, [refreshSubmissions, selectedLabId, submissions, settleResult]);

  const handleTerminalCommand = useCallback((command: string) => {
    // Catches `submit file` on its own or chained after other commands (`a; submit file`).
    if (/(?:^|[;&|]\s*)(?:sudo\s+)?submit(?:\s|$)/i.test(command.trim())) pollForSubmission();
  }, [pollForSubmission]);

  // If the page is reloaded or revisited while a job is still queued/running,
  // resume status polling from the authoritative database state.
  useEffect(() => {
    const newest = submissions[0];

    if (!newest || waitingForResult) return;
    if (!ACTIVE_SUBMISSION_STATUSES.has(newest.status.toUpperCase())) return;

    const generation = ++pollGeneration.current;
    const startedPollingAt = Date.now();

    setWatchFrom(newest.submission_id - 1);
    setWaitingSince(new Date(newest.submitted_at).getTime() || startedPollingAt);
    setWaitingForResult(true);
    setPopup({ phase: 'grading', failing: 0 });

    const poll = async () => {
      if (generation !== pollGeneration.current) return;

      const rows = await refreshSubmissions();

      if (generation !== pollGeneration.current) return;

      const current = rows[0];
      const elapsedMs = Date.now() - startedPollingAt;

      if (!current || TERMINAL_SUBMISSION_STATUSES.has(current.status.toUpperCase()) || elapsedMs >= SUBMISSION_POLL_TIMEOUT_MS) {
        settleResult(current, rows);
        return;
      }

      window.setTimeout(() => { void poll(); }, submissionPollDelayMs(elapsedMs));
    };

    window.setTimeout(() => { void poll(); }, submissionPollDelayMs(0));
  }, [refreshSubmissions, submissions, waitingForResult, settleResult]);

  const activeForSelected = Boolean(
    workspace &&
    workspace.lab_id === selectedLabId &&
    workspace.terminal_ready &&
    workspace.status.toUpperCase() === 'RUNNING',
  );

  const selectedIndex = labs.findIndex((lab) => lab.lab_id === selectedLabId);
  const nextLab = selectedIndex >= 0 ? labs[selectedIndex + 1] : undefined;
  const goNext = nextLab
    ? () => {
        setCelebrate(null);
        navigate(`${basePath}/${encodeURIComponent(nextLab.lab_id)}`);
      }
    : null;
  const clearedCount = labs.filter((lab) => challengeStates[lab.lab_id] === 'passed').length;
  const left = minutesLeft(workspace?.expires_at, now);
  const step = gradingStep(latestSubmission, waitingForResult, watchFrom);
  const showBanner = Boolean(
    !waitingForResult &&
    latestSubmission &&
    latestSubmission.lab_id === selectedLabId &&
    TERMINAL_SUBMISSION_STATUSES.has(latestSubmission.status.toUpperCase()),
  );
  const artKind = race ? 'race' : workshop ? 'shield' : 'rack';

  if (loadingLabs && !labs.length) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
        <div className="mx-auto grid max-w-[1700px] gap-5 xl:grid-cols-[272px_minmax(0,1fr)]">
          <div className="skeleton hidden h-[70vh] rounded-3xl xl:block" />
          <div className="space-y-4">
            <div className="skeleton h-14 rounded-2xl" />
            <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.4fr)]">
              <div className="skeleton h-[60vh] rounded-3xl" />
              <div className="skeleton h-[60vh] rounded-3xl" />
            </div>
          </div>
        </div>
        <p className="sr-only">Loading {catalog.title}</p>
      </div>
    );
  }

  const tabs: { id: BriefTab; label: string; count?: string }[] = [
    { id: 'brief', label: 'Brief' },
    {
      id: 'checks',
      label: 'Checks',
      count: latestSubmission && TERMINAL_SUBMISSION_STATUSES.has(latestSubmission.status.toUpperCase())
        ? `${latestSubmission.tests.filter((test) => test.passed).length}/${Math.max(latestSubmission.tests.length, detail?.rubric.length ?? 0)}`
        : String(detail?.rubric.length ?? 0),
    },
    { id: 'history', label: 'Attempts', count: submissions.length ? String(submissions.length) : undefined },
  ];

  return (
    <div className="isolate min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">
      <AmbientBackground quiet />
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-100/85 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-[1700px] items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/my-labs')}
            className="rounded-full bg-white p-2.5 text-slate-500 shadow-xs ring-1 ring-slate-200 transition hover:text-slate-900 dark:bg-slate-900 dark:ring-slate-800 dark:hover:text-white"
            aria-label="Back to My Labs"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setRailOpen((open) => !open)}
            className="rounded-full bg-white p-2.5 text-slate-500 shadow-xs ring-1 ring-slate-200 transition hover:text-slate-900 xl:hidden dark:bg-slate-900 dark:ring-slate-800 dark:hover:text-white"
            aria-label="Show challenges"
            aria-expanded={railOpen}
          >
            <ListChecks className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {catalog.title}
              {selectedIndex >= 0 && <span className="tabular"> · Challenge {selectedIndex + 1} of {labs.length}</span>}
            </p>
            <h1 className="truncate font-display text-lg font-bold tracking-tight">{detail?.title.replace(/^\d+\.\s*/, '') ?? 'Loading…'}</h1>
          </div>

          <div className="hidden items-center gap-2.5 lg:flex" title={`${clearedCount} of ${labs.length} challenges cleared`}>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${labs.length ? (clearedCount / labs.length) * 100 : 0}%` }} />
            </div>
            <span className="text-xs tabular text-slate-500 dark:text-slate-400">{clearedCount}/{labs.length} cleared</span>
          </div>

          <span className="hidden items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs text-slate-600 shadow-xs ring-1 ring-slate-200 md:flex dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
            <span className={`h-2 w-2 rounded-full ${activeForSelected ? 'animate-pulse bg-emerald-500' : workspace ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden="true" />
            {activeForSelected
              ? `Workspace running${left !== null ? ` · ${left} min left` : ''}`
              : workspace
                ? 'Workspace on another challenge'
                : 'No workspace'}
          </span>

          {activeForSelected ? (
            <button
              type="button"
              disabled={workspaceBusy}
              onClick={() => setConfirm('end')}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs ring-1 ring-slate-200 transition hover:text-rose-700 hover:ring-rose-200 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:hover:text-rose-300"
            >
              {workspaceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
              End
            </button>
          ) : (
            <button
              type="button"
              disabled={workspaceBusy || !detail}
              onClick={requestStart}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:text-slate-950"
            >
              {workspaceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {workspaceBusy ? 'Starting…' : workspace ? 'Switch here' : 'Start'}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1700px] grid-cols-1 gap-5 p-4 sm:p-6 xl:grid-cols-[272px_minmax(0,1fr)] xl:items-start">
        <aside className={`${railOpen ? 'block' : 'hidden'} xl:sticky xl:top-[84px] xl:block xl:max-h-[calc(100vh-108px)] xl:overflow-y-auto [scrollbar-gutter:stable]`}>
          <nav className="rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800" aria-label="Challenges">
            <p className="px-3 pb-2 pt-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">Challenges</p>
            <ol className="space-y-0.5">
              {labs.map((lab, index) => {
                const selected = lab.lab_id === selectedLabId;
                const state = challengeStates[lab.lab_id];
                return (
                  <li key={lab.lab_id}>
                    <button
                      type="button"
                      onClick={() => navigate(`${basePath}/${encodeURIComponent(lab.lab_id)}`)}
                      aria-current={selected ? 'step' : undefined}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                        selected ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular ${
                          state === 'passed'
                            ? 'bg-emerald-500 text-white'
                            : selected
                              ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950'
                              : state === 'attempted'
                                ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {state === 'passed' ? <Check className="tick-in h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] ${selected ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                          {lab.title.replace(/^\d+\.\s*/, '')}
                        </span>
                        {workshop && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{lab.module}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>

        <main className="min-w-0 space-y-4">
          {error && (
            <div className="flex items-start justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
              <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>
              <button type="button" className="rounded-full p-0.5 hover:bg-rose-100 dark:hover:bg-rose-500/20" onClick={() => setError(null)} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {workspace && detail && workspace.lab_id !== selectedLabId && (
            <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
              <span>Your workspace is open on <strong className="font-semibold">{workspace.lab_id}</strong>. Starting this challenge closes it and opens a fresh one here.</span>
            </div>
          )}

          {showBanner && latestSubmission && (
            <ResultBanner submission={latestSubmission} onShowChecks={() => setTab('checks')} onNext={latestSubmission.passed && !celebrate ? goNext : null} />
          )}

          {loadingDetail || !detail ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.4fr)]">
              <div className="skeleton h-[60vh] rounded-3xl" />
              <div className="skeleton h-[60vh] rounded-3xl" />
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.4fr)] xl:items-start">
              <section className="relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 xl:sticky xl:top-[84px] xl:h-[calc(100vh-108px)] dark:bg-slate-900 dark:ring-slate-800">
                <div className="border-b border-slate-100 px-5 pt-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">{detail.lab_id}</span>
                    <span className={`rounded-full px-2.5 py-1 font-medium capitalize ${DIFFICULTY_TONE[detail.difficulty.toLowerCase()] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{detail.difficulty}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 tabular text-slate-600 dark:bg-slate-800 dark:text-slate-300">{detail.total_points} points · pass {detail.pass_score}</span>
                  </div>
                  <div className="mt-3 flex gap-1" role="tablist" aria-label="Challenge panels">
                    {tabs.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        onClick={() => setTab(item.id)}
                        className={`-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors ${
                          tab === item.id
                            ? 'border-brand-600 font-semibold text-slate-900 dark:border-brand-400 dark:text-white'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                        {item.count && <span className="ml-1.5 text-xs tabular text-slate-400">{item.count}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 [scrollbar-gutter:stable]" role="tabpanel">
                  {tab === 'brief' && (
                    <>
                      {detail.learning_objectives.length > 0 && (
                        <ul className="mb-5 space-y-1.5">
                          {detail.learning_objectives.map((objective) => (
                            <li key={objective} className="flex gap-2.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              <Target className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                              {objective}
                            </li>
                          ))}
                        </ul>
                      )}
                      <QuestionMarkdown markdown={detail.question_markdown} rich={race} />
                      <StuckHints labId={detail.lab_id} hints={detail.hints ?? []} />
                    </>
                  )}
                  {tab === 'checks' && (
                    <ChecksPanel
                      rubric={detail.rubric}
                      submission={latestSubmission && latestSubmission.lab_id === selectedLabId ? latestSubmission : null}
                      checking={waitingForResult}
                      passScore={detail.pass_score}
                      totalPoints={detail.total_points}
                    />
                  )}
                  {tab === 'history' && <HistoryPanel submissions={submissions} />}
                </div>
                  {popup && (
                    <GradingPopup
                      phase={popup.phase}
                      step={step}
                      since={waitingSince}
                      eta={typicalSeconds}
                      failing={popup.failing}
                      onShowChecks={() => { setTab('checks'); setPopup(null); }}
                      onClose={() => setPopup(null)}
                    />
                  )}

                  {celebrate && (
                    <ClearedCelebration
                      score={celebrate.result.score ?? 0}
                      maxScore={celebrate.result.max_score ?? detail?.total_points ?? 0}
                      newBlock={celebrate.newBlock}
                      firstTry={celebrate.firstTry}
                      combo={celebrate.combo}
                      cleared={clearedCount + (celebrate.newBlock && challengeStates[celebrate.result.lab_id] !== 'passed' ? 1 : 0)}
                      total={labs.length}
                      nextTitle={nextLab ? nextLab.title.replace(/^\d+\.\s*/, '') : null}
                      title={detail?.title.replace(/^\d+\.\s*/, '') ?? ''}
                      onNext={goNext}
                      onClose={() => setCelebrate(null)}
                    />
                  )}
              </section>

              <section className="min-w-0 space-y-3">
                {activeForSelected ? (
                  <RealTerminal
                    key={workspace?.workspace_id}
                    token={token || undefined}
                    labId={selectedLabId}
                    wsPath={`/api/v1/sysadmin-grading/workspaces/terminal?lab_id=${encodeURIComponent(selectedLabId)}`}
                    terminalTitle={detail.title.replace(/^\d+\.\s*/, '')}
                    height="clamp(460px, calc(100vh - 196px), 1000px)"
                    onCommand={handleTerminalCommand}
                    editor={race && detail.submission_filename ? { file: detail.submission_filename } : undefined}
                  />
                ) : (
                  <div className="range-wash flex min-h-[clamp(460px,calc(100vh-196px),1000px)] flex-col items-center justify-center rounded-3xl px-6 text-center ring-1 ring-slate-200/70 dark:ring-slate-800">
                    {workspaceBusy ? (
                      <div className="fade-in mb-4 flex h-48 w-64 flex-col items-center justify-end">
                        <Mascot pose="carry" size={104} />
                        <div className="loader-ground mt-1 flex w-40 overflow-hidden" aria-hidden="true">
                          <div className="loader-ground-track flex shrink-0 gap-1.5">
                            {Array.from({ length: 15 }, (_, i) => (
                              <span key={i} className="h-2.5 w-5 shrink-0 rounded-[4px]" style={{ background: ['#F6C6A6', '#9BE3C8', '#FFE08A', '#B7DCF5', '#F7C9D6'][i % 5] }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <LabArtImage kind={artKind} className="mb-2 h-48 w-64" />
                    )}
                    <h2 className="font-display text-2xl font-bold">{workspaceBusy ? 'Setting up your machine' : 'Ready when you are'}</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {workspaceBusy
                        ? 'A fresh Linux machine is starting just for you. This usually takes a few seconds.'
                        : 'Start a fresh Linux machine for this challenge. It is yours alone, and it is checked by a separate grader when you submit.'}
                    </p>
                    <button
                      type="button"
                      disabled={workspaceBusy}
                      onClick={requestStart}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:text-slate-950"
                    >
                      {workspaceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      {workspaceBusy ? 'Starting your machine…' : 'Start workspace'}
                    </button>
                    <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Clock3 className="h-3.5 w-3.5" /> It closes on its own when its time runs out.
                    </p>
                  </div>
                )}
                <SubmitBar filename={detail.submission_filename} grading={waitingForResult} />
              </section>
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'switch' ? 'Move your workspace here?' : 'End this workspace?'}
        confirmLabel={confirm === 'switch' ? 'Move it here' : 'End workspace'}
        cancelLabel={confirm === 'switch' ? 'Stay on the other one' : 'Keep working'}
        danger
        onCancel={closeConfirm}
        onConfirm={() => {
          const action = confirm;
          setConfirm(null);
          void (action === 'switch' ? startWorkspace() : stopWorkspace());
        }}
      >
        {confirm === 'switch' ? (
          <p>Your machine for <strong>{titleOf(workspace?.lab_id)}</strong> is deleted with every file on it, and a fresh one starts for this challenge.</p>
        ) : (
          <p>The machine and every file on it are deleted.</p>
        )}
        <p>Work you already submitted, and its results, are safe. Copy anything else you want to keep first.</p>
      </ConfirmDialog>
    </div>
  );
};
