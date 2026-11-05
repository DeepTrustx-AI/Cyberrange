interface SegmentedBarProps {
  done: number;
  total: number;
  label?: string;
  className?: string;
  maxSegments?: number;
}

// Progress drawn as one segment per module, so "3 of 5" reads at a glance.
// Filled segments sweep in one after another; a finished bar turns mint and
// gets a small check. Long labs use one continuous bar (default: more than 24
// modules); a compact holder can lower maxSegments without changing real counts.
export function SegmentedBar({ done, total, label, className = '', maxSegments = 24 }: SegmentedBarProps) {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.min(Math.max(0, done), safeTotal);
  const complete = safeTotal > 0 && safeDone === safeTotal;
  const fill = complete ? 'bg-emerald-500' : 'bg-brand-600 dark:bg-brand-500';
  const empty = 'bg-slate-200 dark:bg-slate-800';

  return (
    <div
      className={`flex h-1.5 w-full items-center gap-[3px] ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeDone}
      aria-label={label ?? `${safeDone} of ${safeTotal} complete`}
    >
      {safeTotal === 0 ? (
        <span className={`h-full flex-1 rounded-full ${empty}`} />
      ) : safeTotal > maxSegments ? (
        <span className={`relative h-full flex-1 overflow-hidden rounded-full ${empty}`}>
          <span className={`segment-fill absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: `${(safeDone / safeTotal) * 100}%` }} />
        </span>
      ) : (
        Array.from({ length: safeTotal }, (_, i) => (
          <span key={i} className={`h-full flex-1 overflow-hidden rounded-full ${empty}`}>
            {i < safeDone && <span className={`segment-fill block h-full rounded-full ${fill}`} style={{ animationDelay: `${i * 70}ms` }} />}
          </span>
        ))
      )}
      {complete && (
        <span className="tick-in ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" style={{ animationDelay: `${Math.min(safeTotal, 24) * 70}ms` }} aria-hidden="true">
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5" /></svg>
        </span>
      )}
    </div>
  );
}
