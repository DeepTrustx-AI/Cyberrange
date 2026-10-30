import { useEffect, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Asks before an action that cannot be undone. The safe choice has focus, and
// Escape or a click outside cancels.
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <button className="fade-in absolute inset-0 bg-slate-950/40" onClick={onCancel} aria-label="Cancel" tabIndex={-1} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 id="confirm-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm}
                  className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-700 dark:bg-white dark:text-slate-900'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
