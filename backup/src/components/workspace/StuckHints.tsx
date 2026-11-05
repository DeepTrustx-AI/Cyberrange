import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';

// The lab's hint questions, one at a time. They point at what to check, never
// at the answer, and cost nothing.
export function StuckHints({ labId, hints }: { labId: string; hints: string[] }) {
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [labId]);
  if (hints.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl bg-amber-50/70 p-4 ring-1 ring-amber-200/70 dark:bg-amber-500/5 dark:ring-amber-500/20" aria-labelledby="stuck-title">
      <h3 id="stuck-title" className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-50">
        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Stuck?
      </h3>
      <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
        Hint questions point at what to check, never at the answer. They are free and do not change your score.
      </p>
      {shown > 0 && (
        <ol className="mt-3 space-y-2" aria-live="polite">
          {hints.slice(0, shown).map((hint, index) => (
            <li key={hint} className="flex gap-2.5 text-sm leading-6 text-amber-950 dark:text-amber-50">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-xs font-semibold tabular text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">{index + 1}</span>
              {hint}
            </li>
          ))}
        </ol>
      )}
      {shown < hints.length && (
        <button
          type="button"
          onClick={() => setShown((count) => count + 1)}
          className="mt-3 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-amber-950 ring-1 ring-amber-200 hover:bg-amber-50 dark:bg-slate-900 dark:text-amber-100 dark:ring-amber-500/30 dark:hover:bg-slate-800"
        >
          {shown === 0 ? 'Show a hint question' : 'Show the next one'}
          <span className="ml-1.5 text-xs tabular text-amber-800/80 dark:text-amber-300/80">{hints.length - shown} left</span>
        </button>
      )}
    </section>
  );
}
