import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Play, RotateCcw, ShieldAlert, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';

type SessionUrls = { lab: string };

function message(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string') {
    return payload.detail;
  }
  return fallback;
}

export const VulnShopLabPage = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [urls, setUrls] = useState<SessionUrls | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const loadExisting = useCallback(async () => {
    try {
      const response = await apiFetch('/api/v1/vulnshop/sessions/current');
      if (!response.ok) return;
      const payload = await response.json();
      if (payload?.urls?.lab) setUrls(payload.urls);
    } catch {
      // The empty state explains how to start a fresh isolated target.
    }
  }, [apiFetch]);

  useEffect(() => { void loadExisting(); }, [loadExisting]);

  const start = async () => {
    if (starting || urls) return;
    setStarting(true); setError('');
    try {
      const response = await apiFetch('/api/v1/vulnshop/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.urls?.lab) throw new Error(message(payload, 'Could not start VulnShop.'));
      setUrls(payload.urls);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start VulnShop.');
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    if (!urls) return;
    setError('');
    try {
      await apiFetch('/api/v1/vulnshop/sessions/current', { method: 'DELETE' });
      setUrls(null);
    } catch {
      setError('The session could not be stopped. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-6 text-slate-900 dark:bg-ember-espresso dark:text-ember-cream sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => navigate('/labs')} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-peach-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-ember-muted dark:hover:bg-ember-surface dark:hover:text-ember-cream">
            <ArrowLeft className="h-4 w-4" /> All labs
          </button>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${urls ? 'bg-mint-50 text-mint-700 dark:bg-emerald-950/50 dark:text-mint-300' : 'bg-[var(--paper)] text-slate-600 dark:bg-ember-surface dark:text-ember-muted'}`}>
            <span className={`h-2 w-2 rounded-full ${urls ? 'bg-mint-500' : 'bg-slate-400 dark:bg-ember-muted'}`} />
            {urls ? 'Private session running' : starting ? 'Preparing private session' : 'Ready to start'}
          </span>
        </header>

        <section className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-sm dark:border-ember-line dark:bg-ember-surface sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-peach-100 text-brand-ink dark:bg-ember-button/20 dark:text-apricot">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">VulnShop web exploitation lab</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-ember-muted">Start a fresh, isolated vulnerable storefront. Inside, choose Orientation, Guided Walkthrough, Quest Mode, or API &amp; Scanner Exploration from the lab menu.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void start()} disabled={Boolean(urls) || starting} className="inline-flex items-center gap-2 rounded-full bg-brand-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-ember-button dark:text-ember-espresso dark:hover:bg-ember-button-hover">
                <Play className="h-4 w-4" /> {starting ? 'Starting…' : urls ? 'Lab running' : 'Start lab'}
              </button>
              <button onClick={() => void stop()} disabled={!urls} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-ember-line dark:bg-ember-surface dark:text-ember-cream dark:hover:bg-ember-espresso">
                <Square className="h-3.5 w-3.5" /> Stop
              </button>
            </div>
          </div>
          {error && <p role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
        </section>

        {urls ? (
          <section className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[var(--line)] bg-white shadow-sm dark:border-ember-line dark:bg-ember-surface">
            <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 dark:border-ember-line dark:bg-ember-espresso">
              <p className="text-sm font-semibold">VulnShop launch menu</p>
              <a href={urls.lab} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-brand-ink hover:bg-peach-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-apricot dark:hover:bg-ember-surface"><ExternalLink className="h-3.5 w-3.5" /> Open separately</a>
            </div>
            <iframe title="VulnShop lab" src={urls.lab} className="h-[calc(100vh-17rem)] min-h-[36rem] w-full border-0 bg-white" sandbox="allow-forms allow-modals allow-scripts allow-same-origin" />
          </section>
        ) : (
          <section className="flex flex-1 items-center justify-center rounded-[28px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-8 text-center dark:border-ember-line dark:bg-ember-surface">
            <div className="max-w-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-ink shadow-sm dark:bg-ember-espresso dark:text-apricot"><RotateCcw className="h-5 w-5" /></div>
              <h2 className="mt-4 font-display text-xl font-bold">A clean target every session</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-ember-muted">Each session creates a private VulnShop target and resets its challenge state. Start the lab when you are ready to choose a learning path.</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
