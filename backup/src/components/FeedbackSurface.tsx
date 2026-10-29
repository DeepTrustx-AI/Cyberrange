import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { feedbackEvents, type FeedbackTone } from '../lib/feedback';

type Toast = { id: number; message: string; tone: FeedbackTone };
type Confirmation = {
  message: string;
  title?: string;
  confirmLabel?: string;
  destructive?: boolean;
  resolve: (confirmed: boolean) => void;
};

const toneStyles: Record<FeedbackTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/70 dark:text-emerald-50',
  error: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-50',
  info: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/70 dark:text-blue-50',
};

export function FeedbackSurface() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => {
    const nativeAlert = window.alert;
    const onFeedback = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone?: FeedbackTone }>).detail;
      const toast = { id: Date.now() + Math.random(), message: detail.message, tone: detail.tone || 'info' };
      setToasts((current) => [...current.slice(-3), toast]);
      window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 6000);
    };
    const onConfirmation = (event: Event) => setConfirmation((event as CustomEvent<Confirmation>).detail);

    window.alert = (message?: unknown) => {
      window.dispatchEvent(new CustomEvent(feedbackEvents.ALERT_EVENT, {
        detail: { message: String(message ?? ''), tone: 'info' },
      }));
    };
    window.addEventListener(feedbackEvents.ALERT_EVENT, onFeedback);
    window.addEventListener(feedbackEvents.CONFIRM_EVENT, onConfirmation);
    return () => {
      window.alert = nativeAlert;
      window.removeEventListener(feedbackEvents.ALERT_EVENT, onFeedback);
      window.removeEventListener(feedbackEvents.CONFIRM_EVENT, onConfirmation);
    };
  }, []);

  const dismissConfirmation = (confirmed: boolean) => {
    confirmation?.resolve(confirmed);
    setConfirmation(null);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 px-4" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info;
          return <div key={toast.id} role="status" className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${toneStyles[toast.tone]}`}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 break-words text-sm font-medium">{toast.message}</p>
            <button onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
          </div>;
        })}
      </div>
      {confirmation && <div className="fixed inset-0 z-[101] flex items-center justify-center bg-slate-950/55 p-4" role="presentation">
        <div role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
          <h2 id="confirmation-title" className="text-lg font-bold text-slate-900 dark:text-white">{confirmation.title || 'Confirm action'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{confirmation.message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => dismissConfirmation(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={() => dismissConfirmation(true)} className={`rounded-lg px-4 py-2 text-sm font-bold text-white ${confirmation.destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmation.confirmLabel || 'Continue'}</button>
          </div>
        </div>
      </div>}
    </>
  );
}
