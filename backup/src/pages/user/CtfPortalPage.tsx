import { apiFetch as routedApiFetch } from '../../lib/api';
import React, { useEffect, useState } from 'react';
import { UserLayout } from '../../components/user/UserLayout';
import type { CtfEvent } from '../../types/ctf';
import { useNavigate } from 'react-router-dom';
import { LabArtImage } from '../../components/art/LabArtImage';
import {
  Trophy,
  Clock,
  ArrowRight,
  Flag,
  Target,
  AlertCircle
} from 'lucide-react';

export const CtfPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CtfEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await routedApiFetch('/api/v1/ctf', { headers });
      if (!res.ok) throw new Error('Failed to load CTF tournaments.');
      const data = await res.json();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading tournaments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const panel = 'rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800';
  const pillPrimary =
    'inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700';
  const pillSecondary =
    'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <UserLayout>
      <div className="space-y-6">
        <section className="range-wash relative overflow-hidden rounded-[2rem] ring-1 ring-slate-900/5 dark:ring-white/5">
          <div className="relative z-10 max-w-xl p-6 sm:p-10">
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              Capture the flag.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
              Cryptography, web exploitation and network reconnaissance challenges with live scoring and a public
              scoreboard. Ask your admin to get your college enrolled.
            </p>
          </div>
          <div className="pointer-events-none relative -mt-4 flex justify-center pb-6 lg:absolute lg:inset-y-6 lg:right-10 lg:mt-0 lg:items-center lg:pb-0">
            <LabArtImage kind="flag" className="h-52 w-72 lg:h-full lg:max-h-60 lg:w-[22rem]" />
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-slate-900 dark:text-white">
              <Trophy className="h-5 w-5 text-slate-400" /> Tournaments
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-3xl" />)}
              </div>
            ) : events.length === 0 && !error ? (
              <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
                <Clock className="h-7 w-7 text-slate-400" />
                <p className="mt-3 font-display text-lg font-semibold text-slate-900 dark:text-white">No tournaments scheduled</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">New events will show up here as soon as they're announced.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event, index) => {
                  const isLive = event.status === 'active';
                  const isUpcoming = event.status === 'scheduled';
                  const isConcluded = event.status === 'completed';

                  return (
                    <article
                      key={event.id}
                      className={`rise-in flex flex-col gap-5 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg md:flex-row md:items-center md:justify-between ${panel}`}
                      style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          {isLive && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              </span>
                              Live now
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Scheduled</span>
                          )}
                          {isConcluded && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">Finished</span>
                          )}
                          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDateTime(event.start_time ?? '')}
                          </span>
                        </div>
                        <h3 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">{event.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                          {event.description || 'No description yet.'}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isLive && (
                          <button onClick={() => navigate(`/ctf/${event.id}/challenges`)} className={pillPrimary}>
                            Enter arena <ArrowRight className="h-4 w-4" />
                          </button>
                        )}
                        {isConcluded && (
                          <button onClick={() => navigate(`/ctf/${event.id}/scoreboard`)} className={pillSecondary}>
                            <Trophy className="h-4 w-4" /> Scoreboard
                          </button>
                        )}
                        {isUpcoming && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Opens soon
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-slate-900 dark:text-white">
              <Target className="h-5 w-5 text-slate-400" /> Tournaments at a glance
            </h2>

            <div className={`p-6 ${panel}`}>
              <dl className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Live', value: events.filter((e) => e.status === 'active').length },
                  { label: 'Upcoming', value: events.filter((e) => e.status === 'scheduled').length },
                  { label: 'Finished', value: events.filter((e) => e.status === 'completed').length },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-slate-50 p-3.5 text-center dark:bg-slate-800/50">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</dt>
                    <dd className="mt-1 font-display text-2xl font-bold tabular text-slate-900 dark:text-white">{loading ? '–' : stat.value}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-6 text-sm font-medium text-slate-700 dark:text-slate-300">How it works</h3>
              <ol className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                {[
                  'Enter a live event and pick any challenge.',
                  'Find the flag and submit it. Correct flags score points straight away.',
                  'Your rank updates live on the event scoreboard.',
                ].map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold tabular text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <Flag className="h-3.5 w-3.5" /> Events are played individually.
              </p>
            </div>
          </aside>
        </div>
      </div>

    </UserLayout>
  );
};
