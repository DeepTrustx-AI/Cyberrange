import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, Hourglass, PlayCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { LabArtImage } from '../art/LabArtImage';
import { labArtKind } from '../../utils/labArtKind';
import { STATE_LABEL, assignmentState, dueText, type AssignmentState } from '../../utils/assignmentState';
import { formatWhen, timingOf, type Assignment } from './assignment';

const STATE_STYLE: Record<AssignmentState, { chip: string; icon: ReactNode }> = {
  overdue: { chip: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  'due-soon': { chip: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30', icon: <Hourglass className="h-3.5 w-3.5" /> },
  'in-progress': { chip: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30', icon: <PlayCircle className="h-3.5 w-3.5" /> },
  'not-started': { chip: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700', icon: <Clock className="h-3.5 w-3.5" /> },
  opens: { chip: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30', icon: <CalendarClock className="h-3.5 w-3.5" /> },
  done: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
};

export function StateChip({ state }: { state: AssignmentState }) {
  const style = STATE_STYLE[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${style.chip}`}>
      {style.icon}
      {STATE_LABEL[state]}
    </span>
  );
}

interface AssignmentRowProps {
  item: Assignment;
  now: Date;
  onOpen: (item: Assignment) => void;
  onResults: (item: Assignment) => void;
}

// One assignment: what it is, where it stands, when it is due, and the one
// thing to do next.
export function AssignmentRow({ item, now, onOpen, onResults }: AssignmentRowProps) {
  const timing = timingOf(item);
  const state = assignmentState(timing, now);
  const progress = Math.round(Math.min(100, Math.max(0, timing.progress)));
  const action =
    state === 'opens' ? null : state === 'done' ? 'Review' : progress > 0 ? 'Continue' : 'Start';

  return (
    <li className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:flex-row sm:items-center dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800/60">
          <LabArtImage kind={labArtKind(item.lab_id, '')} className="h-14 w-20 max-w-none" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold text-slate-900 dark:text-white">{item.lab_name}</h3>
            <StateChip state={state} />
            {item.published_grade && (
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold tabular text-white dark:bg-white dark:text-slate-900">
                Graded · {Math.round(item.published_grade.final_percent)}% {item.published_grade.letter}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
            {item.group_name && item.group_name !== 'Individual' ? item.group_name : 'Set for you'}
            {item.assigned_by ? ` · by ${item.assigned_by}` : ''}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar"
                 aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`${progress}% done`}>
              <span className={`block h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-brand-600 dark:bg-brand-500'}`} style={{ width: `${progress}%` }} />
            </div>
            <span className="shrink-0 text-xs tabular text-slate-500 dark:text-slate-400">{progress}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:w-64 sm:shrink-0 sm:justify-end">
        <div className="text-left sm:text-right">
          <p className={`text-sm font-semibold ${state === 'overdue' ? 'text-rose-700 dark:text-rose-300' : state === 'due-soon' ? 'text-amber-800 dark:text-amber-300' : 'text-slate-800 dark:text-slate-100'}`}>
            {dueText(timing, now)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {state === 'opens' ? formatWhen(item.start_datetime) : item.end_datetime ? `Deadline ${formatWhen(item.end_datetime)}` : ''}
          </p>
        </div>
        {action ? (
          <button
            type="button"
            onClick={() => (action === 'Review' ? onResults(item) : onOpen(item))}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {action}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <span className="shrink-0 rounded-full px-4 py-2 text-sm font-medium text-slate-400" aria-disabled="true">Not open yet</span>
        )}
      </div>
      {state === 'overdue' && (
        <p className="w-full text-xs text-slate-500 sm:hidden dark:text-slate-400">
          Past the deadline. You can still open the lab; ask your teacher if it needs reopening.
        </p>
      )}
      {state !== 'opens' && (state !== 'done' || item.published_grade) && (
        <button type="button" onClick={() => onResults(item)} className="hidden text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline sm:block dark:hover:text-white">
          Results
        </button>
      )}
    </li>
  );
}
