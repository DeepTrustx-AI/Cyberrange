import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../context';
import { EmptyState } from '../../components/ui/EmptyState';
import { AssignmentRow } from '../../components/assignments/AssignmentRow';
import { timingOf, type Assignment } from '../../components/assignments/assignment';
import { AssignmentResults } from '../../components/assignments/AssignmentResults';
import { STATE_LABEL, assignmentState, sortByUrgency, type AssignmentState } from '../../utils/assignmentState';
import { assignmentLabPath } from '../../utils/labRoutes';

type Filter = 'all' | AssignmentState;
const FILTERS: Filter[] = ['all', 'due-soon', 'in-progress', 'not-started', 'opens', 'closed', 'done'];

// Everything a teacher has set, most urgent first, each with its deadline and
// the next thing to do.
export const AssignedLabsPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [results, setResults] = useState<Assignment | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await apiFetch('/api/v1/user/assignments');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setNow(new Date());
    } catch {
      setFailed(true);
    }
  }, [apiFetch]);

  useEffect(() => { void load(); }, [load]);
  // Deadlines move on their own, so the states refresh every minute.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sorted = useMemo(() => (items ? sortByUrgency(items.map((item) => ({ ...item, ...timingOf(item) })), now) : []), [items, now]);
  const counts = useMemo(() => {
    const tally: Partial<Record<AssignmentState, number>> = {};
    sorted.forEach((item) => {
      const state = assignmentState(item, now);
      tally[state] = (tally[state] ?? 0) + 1;
    });
    return tally;
  }, [sorted, now]);
  const visible = filter === 'all' ? sorted : sorted.filter((item) => assignmentState(item, now) === filter);
  const closeResults = useCallback(() => setResults(null), []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">My work</h1>
        <p className="mt-2 max-w-lg text-[15px] text-slate-500 dark:text-slate-400">
          Everything your teachers have set, most urgent first.
        </p>
      </header>

      {items && items.length > 0 && (
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter assignments">
          {FILTERS.filter((key) => key === 'all' || counts[key]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${
                filter === key
                  ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white'
                  : 'bg-white text-slate-600 ring-slate-200 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:text-white'
              }`}
            >
              {key === 'all' ? 'All' : STATE_LABEL[key]}
              <span className="ml-1.5 tabular opacity-60">{key === 'all' ? items.length : counts[key]}</span>
            </button>
          ))}
        </nav>
      )}

      {failed ? (
        <EmptyState
          mascot="think"
          title="Your work could not load"
          body="The server did not answer. Your assignments are safe; try again in a moment."
          action={
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          }
        />
      ) : items === null ? (
        <ul className="space-y-3" aria-busy="true" aria-label="Loading your work">
          {[0, 1, 2].map((key) => <li key={key} className="h-24 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800/60" />)}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState
          mascot="wave"
          title="Nothing set yet"
          body="When a teacher sets a lab, it shows up here with its deadline. Meanwhile, any lab in the catalogue is open for practice."
          action={
            <button type="button" onClick={() => navigate('/labs')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
              Browse labs
            </button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <AssignmentRow key={item.id} item={item} now={now} onOpen={(next) => navigate(assignmentLabPath(next.lab_id, next.id))} onResults={setResults} />
          ))}
        </ul>
      )}

      <AssignmentResults item={results} onClose={closeResults} />
    </div>
  );
};

export default AssignedLabsPage;
