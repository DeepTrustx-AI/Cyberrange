import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RotateCcw, Save, Send } from 'lucide-react';
import { useAuth } from '../../context';
import { EmptyState } from '../../components/ui/EmptyState';
import { GradebookTable, type Draft } from '../../components/gradebook/GradebookTable';
import { STANDING_LABEL, studentStanding, toCsv, type GradebookAssignment, type GradeRow, type Standing } from '../../components/gradebook/gradebook';
import { formatWhen } from '../../components/assignments/assignment';
import { requestConfirmation } from '../../lib/feedback';

interface Gradebook {
  assignment: { id: number; lab_title: string; group_name: string | null; end_datetime: string | null };
  summary: { student_count: number; published_count: number; average_final_percent: number | null };
  students: GradeRow[];
}

const STANDINGS: Standing[] = ['not-started', 'working', 'stuck', 'done'];
const primary = 'inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200';
const secondary = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800';

// Mark set work: who did what, the teacher's adjustment and feedback, then
// publish so students see their grade.
export const GradebookPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const [assignments, setAssignments] = useState<GradebookAssignment[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [book, setBook] = useState<Gradebook | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [filter, setFilter] = useState<Standing | 'all'>('all');
  const [busy, setBusy] = useState<'' | 'load' | 'save' | 'publish' | 'reopen'>('');
  const [message, setMessage] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/gradebook/assignments')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((items: GradebookAssignment[]) => {
        setAssignments(items);
        if (items.length) setSelected(items[0].assignment_id);
      })
      .catch(() => setAssignments([]));
  }, [apiFetch]);

  // Only the latest lab asked for may fill the page: switching labs quickly could
  // otherwise show one lab's marks under another, and Save would write them there.
  const latest = useRef<number | null>(null);
  const load = useCallback(async (id: number) => {
    latest.current = id;
    setBusy('load');
    setMessage('');
    try {
      const res = await apiFetch(`/api/v1/gradebook/assignments/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (latest.current !== id) return;
      setBook(data);
      setDrafts({});
    } catch {
      if (latest.current === id) setMessage('The gradebook could not load. Try again in a moment.');
    } finally {
      if (latest.current === id) setBusy('');
    }
  }, [apiFetch]);

  useEffect(() => { if (selected !== null) void load(selected); }, [selected, load]);

  const changed = Object.keys(drafts).length;
  const choose = async (id: number) => {
    if (id === selected) return;
    if (changed && !(await requestConfirmation(
      `You have ${changed} unsaved change${changed === 1 ? '' : 's'} in this lab. Switching labs discards them.`,
      { title: 'Discard unsaved changes?', confirmLabel: 'Discard and switch', destructive: true },
    ))) return;
    setSelected(id);
  };
  const published = book ? book.summary.published_count : 0;
  const allPublished = book !== null && book.students.length > 0 && published === book.students.length;
  const counts = useMemo(() => {
    const tally: Record<Standing, number> = { 'not-started': 0, working: 0, stuck: 0, done: 0 };
    book?.students.forEach((row) => { tally[studentStanding(row)] += 1; });
    return tally;
  }, [book]);
  const rows = book ? (filter === 'all' ? book.students : book.students.filter((row) => studentStanding(row) === filter)) : [];

  const act = async (kind: 'save' | 'publish' | 'reopen') => {
    if (selected === null || !book) return;
    setBusy(kind);
    setMessage('');
    try {
      const base = `/api/v1/gradebook/assignments/${selected}`;
      const res = kind === 'save'
        ? await apiFetch(base, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grades: Object.entries(drafts).map(([id, draft]) => ({ student_id: Number(id), manual_adjustment: draft.adjustment, feedback: draft.feedback })) }),
          })
        : await apiFetch(`${base}/${kind}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'The server refused the change.');
      setBook(data.gradebook);
      setDrafts({});
      setMessage(kind === 'save' ? 'Drafts saved. Students do not see them until you publish.' : kind === 'publish' ? 'Grades published. Students can now see their grade and feedback.' : 'Grades reopened as drafts for changes.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy('');
      setConfirmPublish(false);
    }
  };

  const exportCsv = () => {
    if (!book) return;
    const blob = new Blob([toCsv(book.students)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${book.assignment.lab_title} - ${book.assignment.group_name ?? 'class'}.csv`.replace(/[\\/:*?"<>|]/g, '-');
    document.body.appendChild(link);
    link.click();
    // Revoked once the download has started; some browsers cancel it if this runs at once.
    setTimeout(() => { link.remove(); URL.revokeObjectURL(link.href); }, 100);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Gradebook</h1>
        <p className="mt-2 max-w-xl text-[15px] text-slate-500 dark:text-slate-400">
          See who has done what, adjust marks, add feedback, then publish so students see their grade.
        </p>
      </header>

      {assignments === null ? (
        <div className="h-24 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800/60" aria-label="Loading assignments" />
      ) : assignments.length === 0 ? (
        <EmptyState mascot="think" title="Nothing to mark yet" body="Assign a lab to a class first. Its gradebook appears here as soon as it is set." />
      ) : (
        <>
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Assignments">
            {assignments.map((item) => (
              <button
                key={item.assignment_id}
                type="button"
                onClick={() => void choose(item.assignment_id)}
                aria-pressed={selected === item.assignment_id}
                className={`min-w-56 shrink-0 rounded-2xl px-4 py-3 text-left ring-1 transition ${
                  selected === item.assignment_id
                    ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white'
                    : 'bg-white text-slate-800 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800'
                }`}
              >
                <span className="block truncate text-sm font-semibold">{item.lab_title}</span>
                <span className="block text-xs opacity-70">
                  {item.student_count} students{item.end_datetime ? ` · due ${formatWhen(item.end_datetime)}` : ''}
                </span>
              </button>
            ))}
          </nav>

          {book && (
            <section className="space-y-4" aria-busy={busy === 'load'}>
              <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 lg:flex-row lg:items-center lg:justify-between dark:bg-slate-900 dark:ring-slate-800">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Class at a glance">
                  {(['all', ...STANDINGS] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      aria-pressed={filter === key}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${
                        filter === key ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900' : 'text-slate-600 ring-slate-200 hover:text-slate-900 dark:text-slate-300 dark:ring-slate-700'
                      } ${key === 'stuck' && counts.stuck > 0 && filter !== key ? 'ring-amber-300 dark:ring-amber-500/50' : ''}`}
                    >
                      {key === 'all' ? 'Everyone' : STANDING_LABEL[key]}
                      <span className="ml-1.5 tabular opacity-60">{key === 'all' ? book.students.length : counts[key]}</span>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {book.assignment.group_name ?? 'Class'}
                  {book.summary.average_final_percent !== null && <> · average <span className="font-semibold tabular">{Math.round(book.summary.average_final_percent)}%</span></>}
                  {' · '}<span className="tabular">{published}/{book.students.length}</span> published
                </p>
              </div>

              {rows.length ? (
                <GradebookTable
                  rows={rows}
                  drafts={drafts}
                  locked={allPublished || busy !== ''}
                  onChange={(id, patch) => setDrafts((current) => {
                    const row = book.students.find((item) => item.student_id === id);
                    const base = current[id] ?? { adjustment: row?.manual_adjustment ?? 0, feedback: row?.feedback ?? '' };
                    return { ...current, [id]: { ...base, ...patch } };
                  })}
                />
              ) : (
                <p className="rounded-3xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">No students in this group.</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={secondary} disabled={!changed || busy !== ''} onClick={() => void act('save')}>
                  {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save drafts{changed ? ` (${changed})` : ''}
                </button>
                {allPublished ? (
                  <button type="button" className={secondary} disabled={busy !== ''} onClick={() => void act('reopen')}>
                    {busy === 'reopen' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Reopen for changes
                  </button>
                ) : (
                  <button type="button" className={primary} disabled={busy !== '' || changed > 0} onClick={() => setConfirmPublish(true)} title={changed ? 'Save your drafts first' : undefined}>
                    <Send className="h-4 w-4" />
                    Publish grades
                  </button>
                )}
                <button type="button" className={secondary} onClick={exportCsv}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                {message && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
              </div>
            </section>
          )}
        </>
      )}

      {confirmPublish && book && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="publish-title">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h2 id="publish-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">Publish {book.students.length} grades?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Each student in {book.assignment.group_name ?? 'this class'} will see their grade and your feedback for {book.assignment.lab_title}. You can reopen later to change them.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={secondary} onClick={() => setConfirmPublish(false)} autoFocus>Cancel</button>
              <button type="button" className={primary} disabled={busy !== ''} onClick={() => void act('publish')}>
                {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradebookPage;
