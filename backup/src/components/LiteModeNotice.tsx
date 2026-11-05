import { useEffect, useState } from 'react';
import { Feather, X } from 'lucide-react';
import { dismissLiteNotice, liteNoticeDue, setGraphicsChoice } from '../utils/webgl';

// Tells the person, once, that light mode came on by itself and why, and lets them
// switch to full graphics. Their answer is kept for this computer; Settings can
// change it again at any time.
export function LiteModeNotice() {
  const [open, setOpen] = useState(liteNoticeDue);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') keep(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  function keep() {
    dismissLiteNotice();
    setOpen(false);
  }
  const useFull = () => {
    setGraphicsChoice('full');
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="lite-notice-title"
      aria-describedby="lite-notice-body"
      className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:inset-x-auto sm:right-6 sm:bottom-6 dark:bg-slate-900 dark:ring-slate-700"
    >
      <button type="button" onClick={keep} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2">
        <Feather className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <h2 id="lite-notice-title" className="text-sm font-semibold text-slate-900 dark:text-white">Light mode is on</h2>
      </div>
      <p id="lite-notice-body" className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        This computer doesn't seem to have a graphics chip, so we turned off 3D scenes and animations to keep pages fast.
        Everything else works the same. You can change this anytime in Settings, under Appearance.
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={useFull} className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800">
          Use full graphics
        </button>
        <button type="button" onClick={keep} autoFocus className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
          Keep light mode
        </button>
      </div>
    </div>
  );
}
