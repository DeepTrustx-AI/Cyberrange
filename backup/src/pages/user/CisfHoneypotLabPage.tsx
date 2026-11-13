import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Play, RotateCcw, ShieldAlert, Square, SquareTerminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RealTerminal } from '../../components/RealTerminal';
import { useAuth } from '../../context';

type SessionUrls = { terminal: string };
type SessionPayload = { status?: string; urls?: SessionUrls; detail?: string };

function message(payload: SessionPayload | null, fallback: string) {
  return typeof payload?.detail === 'string' ? payload.detail : fallback;
}

export const CisfHoneypotLabPage = () => {
  const navigate = useNavigate();
  const { apiFetch, token } = useAuth();
  const [urls, setUrls] = useState<SessionUrls | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const loadExisting = useCallback(async () => {
    try {
      const response = await apiFetch('/api/v1/cisf-honeypot/sessions/current');
      if (!response.ok) { setSessionStatus(null); return; }
      const payload = await response.json() as SessionPayload;
      setSessionStatus(payload.status ?? null);
      if (payload.urls?.terminal) setUrls(payload.urls);
    } catch {
      setSessionStatus(null);
    }
  }, [apiFetch]);

  useEffect(() => { void loadExisting(); }, [loadExisting]);
  useEffect(() => {
    if (!sessionStatus || urls || ['stopped', 'failed'].includes(sessionStatus)) return;
    const timer = window.setInterval(() => { void loadExisting(); }, 3000);
    return () => window.clearInterval(timer);
  }, [loadExisting, sessionStatus, urls]);

  const start = async () => {
    if (starting || urls || sessionStatus) return;
    setStarting(true); setError('');
    try {
      const response = await apiFetch('/api/v1/cisf-honeypot/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null) as SessionPayload | null;
      if (!response.ok) throw new Error(message(payload, 'Could not start the CISF Honeypot lab.'));
      setSessionStatus(payload?.status ?? 'queued');
      if (payload?.urls?.terminal) setUrls(payload.urls);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the CISF Honeypot lab.');
    } finally { setStarting(false); }
  };

  const stop = async () => {
    if (!urls && !sessionStatus) return;
    setError('');
    try {
      const response = await apiFetch('/api/v1/cisf-honeypot/sessions/current', { method: 'DELETE' });
      if (!response.ok) throw new Error('The session could not be stopped. Please try again.');
      setUrls(null); setSessionStatus(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The session could not be stopped. Please try again.');
    }
  };

  const preparing = Boolean(sessionStatus && !urls);
  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-6 text-slate-900 dark:bg-ember-espresso dark:text-ember-cream sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => navigate('/labs')} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-peach-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-ember-muted dark:hover:bg-ember-surface dark:hover:text-ember-cream"><ArrowLeft className="h-4 w-4" /> All labs</button>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${urls ? 'bg-mint-50 text-mint-700 dark:bg-emerald-950/50 dark:text-mint-300' : 'bg-[var(--paper)] text-slate-600 dark:bg-ember-surface dark:text-ember-muted'}`}><span className={`h-2 w-2 rounded-full ${urls ? 'bg-mint-500' : preparing || starting ? 'bg-amber-400' : 'bg-slate-400 dark:bg-ember-muted'}`} />{urls ? 'Private session running' : preparing || starting ? 'Preparing private session' : 'Ready to start'}</span>
        </header>
        <section className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-sm dark:border-ember-line dark:bg-ember-surface sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl"><div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-peach-100 text-brand-ink dark:bg-ember-button/20 dark:text-apricot"><ShieldAlert className="h-5 w-5" /></div><h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">CISF honeypot investigation lab</h1><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-ember-muted">Work from a private Kali terminal against task-local Cowrie, OpenCanary, and Suricata services. Use only the lab address and dummy credentials provided in your workspace.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void start()} disabled={Boolean(urls) || starting || preparing} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/20 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-600 dark:text-white dark:hover:bg-brand-700"><Play className="h-4 w-4" />{starting || preparing ? 'Starting…' : urls ? 'Lab running' : 'Start lab'}</button><button onClick={() => void stop()} disabled={!urls && !preparing} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-ember-line dark:bg-ember-surface dark:text-ember-cream dark:hover:bg-ember-espresso"><Square className="h-3.5 w-3.5" /> Stop</button></div></div>
          {preparing && <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Your isolated workspace is being prepared. The terminal will appear automatically when its health checks pass.</p>}
          {error && <p role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
        </section>
        {urls ? <section className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[var(--line)] bg-white shadow-sm dark:border-ember-line dark:bg-ember-surface"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper)] px-4 py-3 dark:border-ember-line dark:bg-ember-espresso"><div><p className="text-sm font-semibold">Investigation terminal</p><p className="mt-0.5 text-xs text-slate-600 dark:text-ember-muted">Read <code className="font-mono">~/README-CYBERRANGE.txt</code> before beginning.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-mint-50 px-3 py-1.5 text-xs font-semibold text-mint-700 dark:bg-emerald-950/50 dark:text-mint-300"><SquareTerminal className="h-3.5 w-3.5" /> Authenticated terminal</span></div><div className="p-3 sm:p-4"><RealTerminal labId="cisf-honeypot" token={token ?? undefined} terminalTitle="CISF Honeypot Investigation Terminal" height="calc(100vh - 22rem)" className="min-h-[32rem]" /></div></section> : <section className="flex flex-1 items-center justify-center rounded-[28px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-8 text-center dark:border-ember-line dark:bg-ember-surface"><div className="max-w-md"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-ink shadow-sm dark:bg-ember-espresso dark:text-apricot"><RotateCcw className="h-5 w-5" /></div><h2 className="mt-4 font-display text-xl font-bold">A fresh, isolated investigation workspace</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-ember-muted">Starting a session creates one private task for you. Its honeypot services are available only from your terminal and are removed when you stop the lab.</p>{!preparing && <button type="button" onClick={() => void start()} disabled={starting} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-slate-900/20 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-600 dark:text-white dark:hover:bg-brand-700"><Play className="h-4 w-4" /> Start private lab</button>}</div></section>}
      </div>
    </main>
  );
};
