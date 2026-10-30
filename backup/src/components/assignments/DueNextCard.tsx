import { ArrowRight, Play } from 'lucide-react';
import { LabArtImage } from '../art/LabArtImage';
import { labArtKind } from '../../utils/labArtKind';
import { assignmentState, dueText } from '../../utils/assignmentState';
import { StateChip } from './AssignmentRow';
import { formatWhen, timingOf, type Assignment } from './assignment';

interface DueNextCardProps {
  item: Assignment;
  others: number;
  now: Date;
  onOpen: () => void;
  onAll: () => void;
}

// The dashboard's first card: the most urgent piece of set work.
export function DueNextCard({ item, others, now, onOpen, onAll }: DueNextCardProps) {
  const timing = timingOf(item);
  const state = assignmentState(timing, now);
  const progress = Math.round(Math.min(100, Math.max(0, timing.progress)));

  return (
    <div className="rounded-2xl bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 backdrop-blur-sm dark:bg-slate-900/85 dark:ring-white/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Due next</p>
      <div className="mt-2 flex items-start gap-3">
        <span className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 dark:bg-brand-500/10">
          <LabArtImage kind={labArtKind(item.lab_id, '')} className="h-14 w-20 max-w-none" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-semibold text-slate-900 dark:text-white">{item.lab_name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StateChip state={state} />
            <span className={`text-sm font-medium ${state === 'overdue' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}>
              {dueText(timing, now)}
            </span>
          </div>
          {item.end_datetime && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Deadline {formatWhen(item.end_datetime)}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar"
             aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`${progress}% done`}>
          <span className="block h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="shrink-0 text-xs tabular text-slate-500 dark:text-slate-400">{progress}%</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700"
        >
          <Play className="h-4 w-4 fill-current" />
          {progress > 0 ? 'Continue' : 'Start'}
        </button>
        <button
          onClick={onAll}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {others > 0 ? `${others} more in My work` : 'My work'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
