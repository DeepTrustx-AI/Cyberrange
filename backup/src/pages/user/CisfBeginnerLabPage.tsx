import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3 } from 'lucide-react';
import { useAuth } from '../../context';
import { assignmentId, cisfClient, initialChoices, type CisfLabId, type Choices, type Lesson, type Result } from '../../features/cisfLabs/client';

const panel = 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-7 dark:bg-slate-900 dark:ring-slate-800';
const primary = 'rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

export function CisfBeginnerLabPage({ labId }: { labId: CisfLabId }) {
  const { apiFetch } = useAuth();
  const [params] = useSearchParams();
  const assignment = assignmentId(params.get('assignment_id'));
  // A changed assignment gets a fresh component; neither answers nor results cross contexts.
  return <Practice key={`${labId}:${assignment}`} labId={labId} assignment={assignment} apiFetch={apiFetch} />;
}

function Practice({ labId, assignment, apiFetch }: { labId: CisfLabId; assignment: number | null;
  apiFetch: ReturnType<typeof useAuth>['apiFetch'] }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [choices, setChoices] = useState<Choices>({});
  const [result, setResult] = useState<Result | null>(null);
  const [started, setStarted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const client = useMemo(() => assignment ? cisfClient(apiFetch, labId, assignment) : null, [apiFetch, labId, assignment]);

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError(''); setLesson(null); setResult(null); setSaved(false); setStarted(false);
    if (!client) { setLoading(false); return; }
    void client.workspace(abort.signal).then(value => {
      if (abort.signal.aborted) return;
      setLesson(value); setChoices(initialChoices(value)); setSaved(value.completed);
    }).catch(caught => {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'Cannot load the lesson. Please retry.');
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [client, retry]);

  async function check(submit: boolean) {
    if (!lesson || !client || busy) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const value = await client.grade(lesson, choices, submit);
      setResult(value);
      if (value.completion) setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Cannot check your work. Please retry.');
    } finally { setBusy(false); }
  }

  return <main className="mx-auto w-full max-w-4xl space-y-6 pb-12 text-slate-900 dark:text-slate-100">
    <Link to="/assigned-labs" className="inline-flex items-center gap-2 rounded-full text-sm text-slate-600 focus-visible:outline-2 dark:text-slate-300"><ArrowLeft size={16} />Back to my assignments</Link>
    {!assignment ? <section className={panel}><h1 className="font-display text-2xl font-bold">Open your assigned lab</h1><p className="mt-3">Choose this lab from My assignments so your completion can be saved.</p><Link to="/assigned-labs" className={`${primary} mt-5 inline-block`}>My assignments</Link></section>
      : loading ? <section className={panel} role="status"><p>Loading your beginner lab…</p></section>
      : !lesson ? <section className={panel}><h1 className="font-display text-2xl font-bold">We could not open the lab</h1><p className="mt-3" role="alert">{error}</p><button className={`${secondary} mt-5`} onClick={() => setRetry(value => value + 1)}>Try again</button></section>
      : <>
        <header className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Beginner guided practice</p><span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><Clock3 size={16} />About {lesson.minutes} minutes</span></div>
          <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">{lesson.title}</h1>
          <p className="mt-3 max-w-prose text-base leading-7 text-slate-600 dark:text-slate-300">{lesson.summary}</p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{lesson.safety}</p>
          {saved && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300" role="status"><CheckCircle2 size={18} />Completion saved for this assignment. You can practise again.</p>}
        </header>
        {!started ? <section className={`${panel} space-y-5`}>
          <h2 className="font-display text-xl font-semibold">Start here — no experience needed</h2>
          <p className="leading-7">{lesson.introduction}</p>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60"><p className="font-semibold">A familiar example</p><p className="mt-2 leading-7">{lesson.analogy}</p></div>
          <dl className="grid gap-4 sm:grid-cols-2">{lesson.terms.map(term => <div key={term.word}><dt className="font-semibold">{term.word}</dt><dd className="mt-1 leading-6 text-slate-600 dark:text-slate-300">{term.meaning}</dd></div>)}</dl>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Read the example, change two settings and answer one short question. Use a hint whenever you need it. You can retry without a penalty.</p>
          <button className={primary} onClick={() => setStarted(true)}>Start the three small tasks</button>
        </section> : <>
          <section className={panel} aria-labelledby="scenario-title"><h2 id="scenario-title" className="font-display text-xl font-semibold">Your task</h2><p className="mt-3 leading-7">{lesson.scenario}</p></section>
          <form onSubmit={event => { event.preventDefault(); void check(false); }} className="space-y-5">
            {lesson.tasks.map(task => <fieldset key={task.id} disabled={busy} className={panel}>
              <legend className="sr-only">{task.title}</legend>
              <h2 className="font-display text-xl font-semibold" aria-hidden="true">{task.title}</h2><p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">{task.instruction}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{task.options.map(option => <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 leading-6 ${choices[task.id] === option.id ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'}`}>
                <input type="radio" name={task.id} value={option.id} checked={choices[task.id] === option.id} required
                  className="mt-1 h-4 w-4 shrink-0 accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-4"
                  onChange={() => { setChoices(current => ({ ...current, [task.id]: option.id })); setResult(null); setError(''); }} />
                <span>{option.label}</span></label>)}</div>
              <details className="mt-4 text-sm text-slate-600 dark:text-slate-300"><summary className="w-fit cursor-pointer rounded-md font-semibold focus-visible:outline-2">Show a hint</summary><p className="mt-2 leading-6">{task.hint}</p></details>
            </fieldset>)}
            {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
            <div className="flex flex-wrap items-center gap-3"><button type="submit" className={primary} disabled={busy}>{busy ? 'Checking…' : 'Check my work'}</button><button type="button" className={secondary} disabled={busy} onClick={() => setStarted(false)}>Read the explanation again</button></div>
          </form>
          {result && <section className={panel} aria-labelledby="feedback-title" aria-live="polite">
            <h2 id="feedback-title" className="font-display text-xl font-semibold">{result.passed ? 'Well done — all three checks passed' : 'A little more practice'}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{result.checks_passed} of {result.checks_total} checks passed. {result.message}</p>
            <ul className="mt-5 space-y-4">{result.checks.map(item => <li key={item.id}><p className={`font-semibold ${item.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{item.passed ? 'Passed' : 'Try again'} · {item.title}</p><p className="mt-1 leading-6">{item.feedback}</p></li>)}</ul>
            <h3 className="mt-6 font-semibold">What your sample settings mean</h3><ul className="mt-2 list-disc space-y-2 pl-5 leading-6">{result.observations.map(item => <li key={item.title}>{item.result}</li>)}</ul>
            {result.passed && <><p className="mt-5 leading-7">{lesson.takeaway}</p>
              {!result.completion ? <button type="button" className={`${primary} mt-5`} disabled={busy} onClick={() => { void check(true); }}>Finish and save completion</button>
                : <p role="status" className="mt-5 font-semibold text-emerald-700 dark:text-emerald-300">{result.completion.already_completed ? 'Already completed. No extra points were added.' : `Completion saved. ${result.completion.points_awarded} points awarded.`}</p>}</>}
          </section>}
        </>}
      </>}
  </main>;
}
