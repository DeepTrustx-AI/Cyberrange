import { ArrowRight } from 'lucide-react';
import { LabArtImage } from '../art/LabArtImage';
import { SegmentedBar } from '../ui/SegmentedBar';
import { labArtKind } from '../../utils/labArtKind';

export interface RowLab {
  id: string;
  title: string;
  category: string;
  moduleCount: number;
  solved: number;
  isCompleted: boolean;
}

// Labs the student has started and not finished, newest progress first.
export function ContinueRow({ labs, onResume }: { labs: RowLab[]; onResume: (id: string) => void }) {
  const open = labs.filter((lab) => lab.solved > 0 && !lab.isCompleted);
  if (open.length === 0) return null;

  return (
    <section aria-labelledby="continue-heading">
      <h2 id="continue-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-white">Continue where you left off</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {open.slice(0, 3).map((lab) => (
          <button
            key={lab.id}
            onClick={() => onResume(lab.id)}
            className="group flex items-center gap-4 rounded-3xl bg-white p-3 pr-5 text-left shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900 dark:ring-slate-800"
          >
            <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <LabArtImage kind={labArtKind(lab.id, lab.category)} className="h-14 w-20 max-w-none" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[15px] font-semibold text-slate-900 dark:text-white">{lab.title}</span>
              <span className="mt-2 flex items-center gap-2.5">
                <SegmentedBar done={lab.solved} total={lab.moduleCount} />
                <span className="shrink-0 text-xs tabular text-slate-500 dark:text-slate-400">{lab.solved}/{lab.moduleCount}</span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700 dark:group-hover:text-white" />
          </button>
        ))}
      </div>
    </section>
  );
}
