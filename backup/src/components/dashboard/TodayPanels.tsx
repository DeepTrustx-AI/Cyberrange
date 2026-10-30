import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, Flame, Send, XCircle } from 'lucide-react';
import type { TodayData } from '../../hooks/useToday';
import { categoryMeta } from '../../utils/labMeta';
import { Mascot } from '../mascot/Mascot';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function untilText(date: Date) {
  const hours = Math.round((date.getTime() - Date.now()) / 3_600_000);
  if (hours < 1) return 'due within the hour';
  if (hours < 24) return `due in ${hours} h`;
  const days = Math.round(hours / 24);
  return `due in ${days} day${days === 1 ? '' : 's'}`;
}

function ago(date: Date) {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

const tile = 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800';

// Three small panels under the hero: the next deadline, the streak, and the week.
export function TodayStrip({ today }: { today: TodayData }) {
  const todayIndex = new Date().getDay();
  return (
    <section className="grid gap-4 md:grid-cols-3" aria-label="Today">
      <div className={tile}>
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <CalendarClock className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" /> Next deadline
        </p>
        {!today.loaded ? (
          <div className="skeleton mt-3 h-6 w-3/4" />
        ) : today.deadline ? (
          <>
            <p className="mt-2 truncate font-display text-lg font-semibold text-slate-900 dark:text-white">{today.deadline.labName}</p>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">{untilText(today.deadline.endsAt)}</p>
          </>
        ) : (
          <>
            <p className="mt-2 font-display text-lg font-semibold text-slate-900 dark:text-white">Nothing due</p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">No assignment has a deadline coming up.</p>
          </>
        )}
      </div>

      <div className={tile}>
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Flame className={`h-3.5 w-3.5 text-orange-500 ${today.streak > 0 ? 'flicker' : ''}`} /> Streak
        </p>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-bold tabular text-slate-900 dark:text-white">{today.streak}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">day{today.streak === 1 ? '' : 's'} in a row</span>
        </p>
        <ol className="mt-3 flex gap-1.5" aria-label="Days with a submission this week">
          {today.week.map((active, i) => {
            const weekday = (todayIndex - (6 - i) + 7) % 7;
            return (
              <li key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className={`h-2 w-full rounded-full ${active ? 'bg-orange-400' : 'bg-slate-100 dark:bg-slate-800'}`} />
                <span className={`text-xs ${i === 6 ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>{WEEKDAY[weekday]}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={tile}>
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Send className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" /> This week
        </p>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-bold tabular text-slate-900 dark:text-white">{today.weekSubmissions}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">submission{today.weekSubmissions === 1 ? '' : 's'} graded</span>
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {today.weekSubmissions === 0 ? 'Submit a challenge to get your week going.' : 'Every attempt is checked on a real machine.'}
        </p>
      </div>
    </section>
  );
}

export interface SkillArea {
  category: string;
  done: number;
  total: number;
}

// Module progress per area, from the student's assigned labs.
export function SkillsCard({ areas }: { areas: SkillArea[] }) {
  return (
    <section className={tile}>
      <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">Skills</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Modules cleared in each area</p>
      {areas.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Skills appear once labs are assigned to you.</p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {areas.map((area) => {
            const meta = categoryMeta(area.category);
            const share = area.total ? area.done / area.total : 0;
            return (
              <li key={area.category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <meta.icon className="h-3.5 w-3.5 text-slate-400" />
                    {meta.label}
                  </span>
                  <span className="text-xs tabular text-slate-500 dark:text-slate-400">{area.done}/{area.total}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-emerald-400 transition-[width] duration-700"
                    style={{ width: `${Math.max(share * 100, share > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// What the student actually did: graded attempts, newest first. Sign-ins are left out.
export function ActivityFeed({ today }: { today: TodayData }) {
  return (
    <section className={tile}>
      <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">Recent work</h2>
      {!today.loaded ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-10" />)}
        </div>
      ) : today.activity.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-2xl bg-slate-50 px-4 py-6 text-center dark:bg-slate-800/50">
          <Mascot pose="wave" size={76} interactive />
          <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">No graded work yet</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your submissions and cleared challenges will show up here.</p>
          <Link to="/labs" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
            Find a lab <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <ol className="mt-3 space-y-1">
          {today.activity.map((item) => (
            <li key={item.id}>
              <Link to={item.path} className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {item.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-white">
                    {item.passed ? 'Cleared' : 'Tried'} {item.title}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {item.course} · {ago(item.at)}
                  </span>
                </span>
                <span className={`shrink-0 text-xs font-medium tabular ${item.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {item.score ?? 0}/{item.maxScore ?? 0}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
