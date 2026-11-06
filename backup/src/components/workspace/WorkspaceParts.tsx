import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Circle, Flame, X, XCircle, Zap } from 'lucide-react';
import type { SysadminRubricCriterion, SysadminSubmission } from '../../services/sysadminGradingService';
import { CLAY } from '../three/clay';
import { Mascot } from '../mascot/Mascot';
import { ClayRain } from '../ui/ClayRain';
import { SegmentedBar } from '../ui/SegmentedBar';
import { useCountUp } from '../../hooks/useCountUp';
import { ACTIVE_SUBMISSION_STATUSES, TERMINAL_SUBMISSION_STATUSES, formatCriterionId } from '../../utils/submissions';

// Pieces of the Linux lab workspace: the checks list, the attempt history, the
// result banner, the grading progress card and the celebration.

function timeAgo(value?: string | null) {
  if (!value) return '';
  // Sysadmin submission timestamps are UTC values.  Older API responses omit
  // the zone suffix, which JavaScript otherwise interprets as browser-local
  // time (making a new submission appear several hours old in IST).
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const submittedAt = new Date(normalized);
  const seconds = Math.max(0, (Date.now() - submittedAt.getTime()) / 1000);
  if (Number.isNaN(seconds)) return '';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return submittedAt.toLocaleDateString();
}

export function ChecksPanel({
  rubric,
  submission,
  checking,
  passScore,
  totalPoints,
}: {
  rubric: SysadminRubricCriterion[];
  submission: SysadminSubmission | null;
  checking: boolean;
  passScore: number;
  totalPoints: number;
}) {
  const results = useMemo(() => new Map((submission?.tests ?? []).map((test) => [test.id, test])), [submission]);
  const rows = [
    ...rubric.map((criterion) => ({ id: criterion.id, points: criterion.points })),
    ...(submission?.tests ?? []).filter((test) => !rubric.some((c) => c.id === test.id)).map((test) => ({ id: test.id, points: test.max_points })),
  ];
  const finished = submission && TERMINAL_SUBMISSION_STATUSES.has(submission.status.toUpperCase());
  const passedCount = rows.filter((row) => results.get(row.id)?.passed).length;

  return (
    <div>
      <div className="flex items-end justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 dark:bg-slate-800/50">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{finished ? 'Last attempt' : 'To pass'}</p>
          <p className="mt-0.5 font-display text-2xl font-bold tabular text-slate-900 dark:text-white">
            {finished ? submission?.score ?? 0 : passScore}
            <span className="text-base font-semibold text-slate-400">/{totalPoints}</span>
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          {finished ? (
            <span className={`rounded-full px-2.5 py-1 font-semibold ${submission?.passed ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>
              {submission?.passed ? 'Passed' : 'Not yet'}
            </span>
          ) : (
            <span>{rows.length} checks · pass mark {passScore}</span>
          )}
          {finished && <p className="mt-1.5 tabular">{passedCount} of {rows.length} checks pass</p>}
        </div>
      </div>

      {submission?.error && (
        <div className="mt-3 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {submission.error}
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {rows.map((row, index) => {
          const result = results.get(row.id);
          const state = checking ? 'checking' : result ? (result.passed ? 'pass' : 'fail') : 'todo';
          return (
            <li key={row.id} className={`rounded-xl px-3 py-2.5 ${state === 'fail' ? 'bg-rose-50/70 dark:bg-rose-500/5' : ''}`}>
              <div className="flex items-center gap-3">
                {state === 'pass' && <CheckCircle2 key={`p-${submission?.submission_id}`} className="tick-in h-[18px] w-[18px] shrink-0 text-emerald-500" style={{ animationDelay: `${index * 60}ms` }} />}
                {state === 'fail' && <XCircle key={`f-${submission?.submission_id}`} className="tick-in h-[18px] w-[18px] shrink-0 text-rose-500" style={{ animationDelay: `${index * 60}ms` }} />}
                {state === 'checking' && <span className="skeleton h-[18px] w-[18px] shrink-0 rounded-full" />}
                {state === 'todo' && <Circle className="h-[18px] w-[18px] shrink-0 text-slate-300 dark:text-slate-600" />}
                <span className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-100">{formatCriterionId(row.id)}</span>
                <span className={`shrink-0 text-xs font-medium tabular ${state === 'pass' ? 'text-emerald-600 dark:text-emerald-400' : state === 'fail' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                  {result ? `${result.points}/${result.max_points}` : `${row.points} pts`}
                </span>
              </div>
              {result && !result.passed && result.feedback && (
                <p className="ml-[30px] mt-1 text-xs leading-5 text-rose-800/80 dark:text-rose-200/80">{result.feedback}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HistoryPanel({ submissions }: { submissions: SysadminSubmission[] }) {
  if (submissions.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No attempts yet. Your submissions will appear here.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {submissions.map((row) => {
        const status = row.status.toUpperCase();
        const active = ACTIVE_SUBMISSION_STATUSES.has(status);
        return (
          <li key={row.submission_id} className="flex items-center gap-3 py-3">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${active ? 'animate-pulse bg-brand-500' : row.passed ? 'bg-emerald-500' : 'bg-rose-400'}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                {active ? 'Grading…' : row.passed ? 'Passed' : status === 'ERROR' || status === 'TIMED_OUT' ? 'Could not grade' : 'Not yet'}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Attempt #{row.submission_id} · {timeAgo(row.submitted_at)}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular text-slate-700 dark:text-slate-200">
              {row.score ?? '–'}<span className="text-slate-400">/{row.max_score ?? '–'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ResultBanner({
  submission,
  onShowChecks,
  onNext,
}: {
  submission: SysadminSubmission;
  onShowChecks: () => void;
  onNext: (() => void) | null;
}) {
  const failing = submission.tests.filter((test) => !test.passed).length;
  if (submission.passed) {
    return (
      <div className="rise-in flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-500/10">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="flex-1 text-emerald-900 dark:text-emerald-100">
          <strong className="font-semibold">Passed</strong> with {submission.score}/{submission.max_score}. Nicely done.
        </span>
        {onNext && (
          <button onClick={onNext} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
            Next challenge <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="rise-in flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm dark:bg-amber-500/10">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="flex-1 text-amber-950 dark:text-amber-100">
        {submission.error ? (
          'The grader could not finish this attempt. Try submitting again.'
        ) : (
          <>
            <strong className="font-semibold">{submission.score ?? 0}/{submission.max_score}</strong>, {failing} check{failing === 1 ? '' : 's'} still failing.
          </>
        )}
      </span>
      <button onClick={onShowChecks} className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-transparent dark:text-amber-100 dark:ring-amber-500/30">
        See what failed
      </button>
    </div>
  );
}

const CONFETTI = [CLAY.peach, CLAY.mint, CLAY.butter, CLAY.sky, CLAY.blush];

interface CelebrationProps {
  score: number;
  maxScore: number;
  title: string;
  newBlock: boolean;
  firstTry: boolean;
  combo: number;
  cleared: number;
  total: number;
  nextTitle: string | null;
  onNext: (() => void) | null;
  onClose: () => void;
}

// A cleared challenge: the mascot hops on top of the card in a burst of clay
// confetti, the score counts up, and the rewards land one by one.
export function ClearedCelebration({ score, maxScore, title, newBlock, firstTry, combo, cleared, total, nextTitle, onNext, onClose }: CelebrationProps) {
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const burst = useMemo(
    () => Array.from({ length: reduced ? 0 : 22 }, (_, i) => {
      const angle = (i / 22) * Math.PI * 2 + (i % 3) * 0.18;
      const distance = 90 + ((i * 37) % 80);
      return {
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance * 0.75 - 30,
        size: 7 + ((i * 5) % 6),
        color: CONFETTI[(i + 2) % CONFETTI.length],
        spin: ((i * 61) % 300) - 150,
        round: i % 4 === 0,
      };
    }),
    [reduced],
  );
  const shown = useCountUp(score, 900);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // The terminal keeps keyboard focus and swallows keys, so take focus and
  // listen for Escape before it gets there.
  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const rewards = [
    newBlock && { key: 'block', label: '+1 block for your cube', tone: 'bg-[#FFF1E6] text-[#7A3B17] dark:bg-[#F6C6A6]/15 dark:text-[#F6C6A6]', icon: <span className="h-3 w-3 rounded-[4px] bg-gradient-to-br from-[#FFD9C2] to-[#F6B48E] shadow-sm" /> },
    firstTry && { key: 'first', label: 'First try', tone: 'bg-[#FFF6D6] text-[#6B4C00] dark:bg-[#FFE08A]/15 dark:text-[#FFE08A]', icon: <Zap className="h-3.5 w-3.5" /> },
    combo >= 2 && { key: 'combo', label: `Combo ×${combo}`, tone: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200', icon: <Flame className="h-3.5 w-3.5" /> },
  ].filter(Boolean) as { key: string; label: string; tone: string; icon: React.ReactNode }[];

  return (
    <>
      <ClayRain />

      {/* Over the brief column on wide screens, so the terminal stays in view. */}
      <div className="fixed inset-x-4 top-28 z-50 mx-auto max-w-sm xl:absolute xl:inset-x-4 xl:top-44" role="dialog" aria-modal="false" aria-labelledby="cleared-title">
      <div className="celebrate-pop relative w-full rounded-[2rem] bg-white px-7 pb-7 pt-[4.5rem] text-center shadow-2xl ring-1 ring-slate-900/[0.06] dark:bg-slate-900 dark:ring-white/10">
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[58%]" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2">
            {burst.map((piece, i) => (
              <span
                key={i}
                className="burst-piece"
                style={{
                  width: piece.size,
                  height: piece.round ? piece.size : piece.size * 0.62,
                  borderRadius: piece.round ? 999 : 3,
                  background: piece.color,
                  ['--dx' as string]: `${piece.dx}px`,
                  ['--dy' as string]: `${piece.dy}px`,
                  ['--spin' as string]: `${piece.spin}deg`,
                  animationDelay: `${0.12 + (i % 5) * 0.02}s`,
                }}
              />
            ))}
          </div>
          <Mascot pose="cheer" size={118} />
        </div>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <h2 id="cleared-title" className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Cleared!</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-4 font-display text-5xl font-extrabold tabular tracking-tight text-slate-900 dark:text-white">
          {shown}
          <span className="text-2xl font-semibold text-slate-400">/{maxScore}</span>
        </p>

        {rewards.length > 0 && (
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {rewards.map((reward, i) => (
              <li
                key={reward.key}
                className={`reward-pop flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${reward.tone}`}
                style={{ animationDelay: `${0.55 + i * 0.14}s` }}
              >
                {reward.icon}
                {reward.label}
              </li>
            ))}
          </ul>
        )}

        {total > 0 && (
          <div className="mt-6 text-left">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200">{cleared} of {total} cleared</span>
              <span className="tabular text-slate-500 dark:text-slate-400">{Math.max(0, total - cleared)} to go</span>
            </div>
            <SegmentedBar done={cleared} total={total} className="mt-2" />
          </div>
        )}
        {nextTitle && onNext && (
          <p className="mt-4 truncate text-xs text-slate-500 dark:text-slate-400">
            Next: <span className="font-medium text-slate-700 dark:text-slate-200">{nextTitle}</span>
          </p>
        )}

        <div className="mt-6 flex justify-center gap-2">
          <button
            ref={onNext ? undefined : primaryRef}
            onClick={onClose}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Stay here
          </button>
          {onNext && (
            <button ref={primaryRef} onClick={onNext} className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-slate-950">
              Next challenge <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

export type GradingPhase = 'grading' | 'passed' | 'failed' | 'error';

interface GradingPopupProps {
  phase: GradingPhase;
  step: number;
  since: number | null;
  /** Typical grading time for this student, in seconds; null until there is history. */
  eta: number | null;
  failing: number;
  onShowChecks: () => void;
  onClose: () => void;
}

// After `submit`: a card at the foot of the brief (never over the terminal) with
// the grader's real status, an estimate once this student has grading history,
// and a line the mascot walks along. The line eases toward the end and only
// finishes when the result lands.
export function GradingPopup({ phase, step, since, eta, failing, onShowChecks, onClose }: GradingPopupProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== 'grading') return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  const elapsed = since ? Math.max(0, (now - since) / 1000) : 0;
  // Without history there is no estimate to show; the line just eases on slowly.
  let progress = 0.92 * (1 - Math.exp((-2.3 * elapsed) / Math.max(eta ?? 60, 5)));
  if (step >= 1) progress = Math.max(progress, 0.08);
  if (step >= 2) progress = Math.max(progress, 0.25);
  if (phase !== 'grading') progress = 1;
  const left = eta === null ? null : Math.max(0, Math.round(eta - elapsed));

  const title = phase === 'grading' ? 'Grading your work' : phase === 'passed' ? 'Passed!' : phase === 'failed' ? 'Almost there' : 'The grader hit a snag';
  const detail =
    phase === 'grading'
      ? step <= 0 ? 'Sending your work' : step === 1 ? 'Waiting in the queue' : 'Checking your machine'
      : phase === 'passed'
        ? 'Every check passed.'
        : phase === 'failed'
          ? `${failing} check${failing === 1 ? '' : 's'} still failing`
          : 'Give it a moment, then submit again.';
  const estimate = phase === 'grading' && left !== null ? (left > 2 ? `about ${left} s left` : 'any second now') : null;
  const pose = phase === 'grading' ? 'walk' : phase === 'passed' ? 'cheer' : 'think';

  return (
    <div
      role="status"
      aria-live="polite"
      className="sheet-up fixed inset-x-4 bottom-4 z-40 mx-auto max-w-sm rounded-3xl xl:absolute xl:inset-x-3 xl:bottom-3 xl:max-w-none bg-white p-5 shadow-xl ring-1 ring-slate-900/[0.06] dark:bg-slate-900 dark:ring-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {detail}
            {estimate && <> &middot; <span className="tabular">{estimate}</span></>}
          </p>
        </div>
        <button onClick={onClose} className="-mr-1 -mt-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Hide grading progress">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-4 h-[3.4rem]" aria-hidden="true">
        <div className="absolute inset-x-0 bottom-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#F6C6A6] via-[#FFE08A] to-[#9BE3C8] transition-[width] duration-700 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span
          className={`absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-lg text-white shadow-sm transition-colors duration-300 ${
            phase === 'passed' ? 'tick-in bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <div
          className="absolute bottom-3 transition-[left] duration-700 ease-out"
          style={{ left: `min(calc(${progress * 100}% - 22px), calc(100% - 64px))` }}
        >
          <Mascot pose={pose} size={44} />
        </div>
      </div>

      {phase === 'failed' && (
        <button
          onClick={onShowChecks}
          className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          See what failed
        </button>
      )}
    </div>
  );
}
