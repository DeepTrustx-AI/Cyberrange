import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '../../context';
import { getLetterGrade } from '../../utils/grading';
import { formatWhen, type Assignment, type PublishedGrade } from './assignment';

interface AssignmentStats {
  score: number;
  score_possible: number | null;
  score_percent: number | null;
  grade: string | null;
  time_taken: string;
  progress_percent: number;
  published_grade?: PublishedGrade | null;
}

interface AssignmentResultsProps {
  item: Assignment | null;
  onClose: () => void;
}

// The student's own results for one assignment, beside the list.
export function AssignmentResults({ item, onClose }: AssignmentResultsProps) {
  const { apiFetch } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setStats(null);
    setFailed(false);
    closeRef.current?.focus({ preventScroll: true });
    apiFetch(`/api/v1/user/assignments/${item.id}/statistics`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data: AssignmentStats = await res.json();
        if (!cancelled) setStats(data);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [item, apiFetch, onClose]);

  if (!item) return null;
  const percent = stats?.score_percent ?? null;
  const grade = stats?.grade ?? getLetterGrade(percent);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="results-title">
      <button className="fade-in absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <aside className="sheet-in relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-2xl sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-[2rem] dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your results</p>
            <h2 id="results-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">{item.lab_name}</h2>
          </div>
          <button ref={closeRef} onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close results">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!stats && !failed && (
          <div className="mt-10 flex items-center gap-2 text-sm text-slate-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your results
          </div>
        )}
        {failed && (
          <p className="mt-8 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" role="status">
            No results yet. They appear here once you submit work for this lab.
          </p>
        )}
        {stats?.published_grade && (
          <section className="mt-6 rounded-2xl bg-slate-900 p-4 text-white dark:bg-white dark:text-slate-900" aria-label="Your grade">
            <p className="text-xs opacity-70">Your grade{stats.published_grade.published_at ? `, published ${formatWhen(stats.published_grade.published_at)}` : ''}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular">
              {Math.round(stats.published_grade.final_percent)}% <span className="text-xl opacity-80">{stats.published_grade.letter}</span>
            </p>
            {stats.published_grade.feedback && (
              <blockquote className="mt-3 border-l-2 border-white/30 pl-3 text-sm leading-relaxed dark:border-slate-900/20">
                {stats.published_grade.feedback}
              </blockquote>
            )}
          </section>
        )}
        {stats && (
          <>
            <dl className="mt-6 grid grid-cols-3 gap-2">
              {[
                ['Score', stats.score_possible ? `${Math.round(stats.score)}/${Math.round(stats.score_possible)}` : String(Math.round(stats.score))],
                stats.published_grade ? ['Progress', `${Math.round(stats.progress_percent ?? 0)}%`] : ['Grade so far', grade ?? '—'],
                ['Time', stats.time_taken || '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-800/60">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular text-slate-900 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </aside>
    </div>
  );
}
