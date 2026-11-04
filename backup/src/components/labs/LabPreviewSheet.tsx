import { useEffect, useRef, type ReactNode } from 'react';
import { Check, Clock, Layers, X } from 'lucide-react';
import { LabCardMedia } from '../art/LabCardMedia';

export interface PreviewLab {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  difficulty: string;
  summary: string;
  durationHours: number;
  moduleTitles: string[];
  moduleMinutes: number[];
  solved: number;
  isCompleted: boolean;
}

interface LabPreviewSheetProps {
  lab: PreviewLab | null;
  onClose: () => void;
  action: ReactNode;
}

// Strips the numbering the backend puts in front of module titles, since the
// list numbers them itself.
function cleanTitle(title: string) {
  return title.replace(/^(module\s+\d+:\s*|\d+\.\s*|level\s+\d+\s*->\s*level\s+\d+:\s*)/i, '');
}

// What a lab is before you launch it: the live scene, what you will do, every
// module in order with the ones you have cleared ticked off.
export function LabPreviewSheet({ lab, onClose, action }: LabPreviewSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!lab) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [lab, onClose]);

  if (!lab) return null;
  const total = lab.moduleTitles.length;
  const done = lab.isCompleted ? total : Math.min(lab.solved, total);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="lab-preview-title">
      <button className="fade-in absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <aside className="sheet-in relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-[2rem] dark:bg-slate-900">
        <div className="group relative">
          <LabCardMedia labId={lab.id} category={lab.category} difficulty={lab.difficulty} size="hero" />
          <button
            ref={closeRef}
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/85 p-2 text-slate-600 shadow-xs backdrop-blur-sm hover:text-slate-900 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:text-white"
            aria-label="Close lab preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5 sm:px-8">
          <h2 id="lab-preview-title" className="font-display text-2xl font-bold text-slate-900 dark:text-white">{lab.title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{lab.summary}</p>

          <dl className="mt-5 grid grid-cols-3 gap-2">
            {[
              ['Area', lab.categoryLabel],
              ['Modules', String(total)],
              ['Time', lab.durationHours > 0 ? `${lab.durationHours} h` : 'Self-paced'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-800/60">
                <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className={`mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white ${label === 'Area' ? 'capitalize' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>

          {total > 0 && (
            <section className="mt-7">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">What you will do</h3>
                <span className="text-xs tabular text-slate-500 dark:text-slate-400">{done} of {total} cleared</span>
              </div>
              <ol className="mt-3 space-y-1">
                {lab.moduleTitles.map((title, index) => {
                  const cleared = index < done;
                  const next = index === done && !lab.isCompleted;
                  return (
                    <li
                      key={`${index}-${title}`}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${next ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30' : ''}`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular ${
                          cleared
                            ? 'bg-emerald-500 text-white'
                            : next
                              ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {cleared ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className={cleared ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'}>{cleanTitle(title)}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-3 text-xs">
                        {next && <span className="font-medium text-brand-700 dark:text-brand-300">Up next</span>}
                        {lab.moduleMinutes[index] > 0 && (
                          <span className="tabular text-slate-400 dark:text-slate-500">{lab.moduleMinutes[index]} min</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 sm:px-8 dark:border-slate-800">
          <span className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />{total} modules</span>
            {lab.durationHours > 0 && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{lab.durationHours} h</span>}
          </span>
          <div className="flex items-center gap-2">{action}</div>
        </footer>
      </aside>
    </div>
  );
}
