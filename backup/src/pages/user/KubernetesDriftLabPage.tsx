import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';

type Stage = 'briefing' | 'investigate' | 'review';
type Finding = {
  id: string; severity: string; title: string; path: string;
  explanation: string; recommendation: string; investigative_hint?: string;
};
type Requirement = { id: string; title: string; met: boolean };
type Question = { id: string; question: string; options: { id: string; text: string }[] };
type Lesson = {
  course: { safety: string; duration_minutes: number; subtitle: string };
  scenario: string;
  objectives: string[];
  concepts: { title: string; body: string }[];
  tasks: { id: string; title: string; instruction: string; hint: string }[];
  questions: Question[];
};
type Quiz = {
  correct_count: number; total_questions: number; message: string;
  results: { question_id: string; correct: boolean; correct_option_id: string; explanation: string }[];
};
type Assessment = {
  findings: Finding[]; finding_count: number; requirements: Requirement[];
  passed: boolean; message: string;
  completion?: { already_completed: boolean; points_awarded: number } | null;
};
const API = '/api/v1/kubernetes-drift-lab';
const LIVE_FILE = 'live-snapshot.yaml';

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

function shuffleQuestions(questions: Question[]): Question[] {
  return questions.map((question) => {
    const options = [...question.options];
    for (let index = options.length - 1; index > 0; index--) {
      const pick = Math.floor(Math.random() * (index + 1));
      [options[index], options[pick]] = [options[pick], options[index]];
    }
    return { ...question, options };
  });
}

export const KubernetesDriftLabPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [stage, setStage] = useState<Stage>('briefing');
  const [desired, setDesired] = useState('');
  const [live, setLive] = useState('');
  const [starter, setStarter] = useState('');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [expandedHints, setExpandedHints] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [completed, setCompleted] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/workspace`);
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'Unable to load this lab. An active assignment is required.'));
      if (payload.desired?.filename !== 'desired-deployment.yaml' ||
          payload.files?.length !== 1 || payload.files[0]?.filename !== LIVE_FILE || !payload.learning) {
        throw new Error('The workspace is missing a valid desired or observed snapshot.');
      }
      setDesired(payload.desired.content);
      setLive(payload.files[0].content);
      setStarter(payload.files[0].content);
      setLesson({ ...payload.learning, questions: shuffleQuestions(payload.learning.questions) });
      setAssessment(null);
      setQuiz(null);
      setCompleted(false);
      setNotice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the lab.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void load(); }, [load]);

  const scan = async (submit: boolean) => {
    if (working || loading || !live.trim()) return;
    setWorking(true);
    setError('');
    setNotice('');
    setAssessment(null);
    try {
      const response = await apiFetch(`${API}/${submit ? 'submit' : 'scan'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ filename: LIVE_FILE, content: live }] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'Snapshot assessment failed.'));
      const result = payload as Assessment;
      setAssessment(result);
      if (submit && result.passed) {
        setCompleted(true);
        setNotice(`Reconciliation completed. ${result.completion?.points_awarded ?? 0} points awarded${result.completion?.already_completed ? ' (previously completed)' : ''}.`);
      } else {
        setNotice(submit ? result.message : result.finding_count === 0
          ? 'No drift detected in this snapshot. Review the integrity checks, then submit.'
          : `${result.finding_count} difference${result.finding_count === 1 ? '' : 's'} detected. Examine the evidence paths and compare against approved state.`);
      }
    } catch (err) {
      setAssessment(null);
      setError(err instanceof Error ? err.message : 'Snapshot assessment failed.');
    } finally {
      setWorking(false);
    }
  };

  const checkKnowledge = async () => {
    if (working || !lesson) return;
    setWorking(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/knowledge-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'Unable to check your answers.'));
      setQuiz(payload as Quiz);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check your answers.');
    } finally {
      setWorking(false);
    }
  };

  const total = assessment?.requirements.length ?? 0;
  const met = useMemo(() => assessment?.requirements.filter((r) => r.met).length ?? 0, [assessment]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-7 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <button onClick={() => navigate('/assigned-labs')} className="mb-3 text-sm text-sky-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">← Back to assigned labs</button>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Kubernetes Configuration Drift Detection</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Compare approved state against an observed snapshot, find discrepancies and restore the intended Deployment.</p>
          </div>
          <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs font-semibold text-emerald-300">OFFLINE SNAPSHOTS · 250 POINTS</span>
        </header>

        {loading ? <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-slate-300">Loading the approved and observed snapshots…</p> : !lesson ? (
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Workspace unavailable</h2>
            <p role="alert" className="mt-3 text-sm text-rose-300">{error || 'Unable to load the lab.'}</p>
            <button onClick={() => void load()} className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500">Retry loading</button>
          </section>
        ) : <>
          <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 px-5 py-4">
            <p className="text-sm text-slate-200"><strong>Safety boundary:</strong> {lesson.course.safety}</p>
            <p className="mt-2 text-xs text-slate-400">Estimated time: {lesson.course.duration_minutes} min · Your edits stay in this page until assessment. No YAML is executed.</p>
          </div>
          <nav aria-label="Lab stages" className="mb-6 grid gap-2 sm:grid-cols-3">
            {([['briefing', '1. Mission briefing'], ['investigate', '2. Compare and reconcile'], ['review', '3. Reflect and review']] as const).map(([id, title]) => (
              <button key={id} onClick={() => setStage(id)} aria-current={stage === id ? 'step' : undefined}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${stage === id ? 'border-sky-400 bg-sky-950 text-white' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}>{title}</button>
            ))}
          </nav>

          {stage === 'briefing' && <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Your mission</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{lesson.scenario}</p>
              <h3 className="mt-7 font-semibold">What you'll practice</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">{lesson.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
              <button onClick={() => setStage('investigate')} className="mt-7 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold hover:bg-sky-500">Begin investigation →</button>
            </section>
            <aside className="space-y-3">
              <h2 className="font-semibold">Concepts to know</h2>
              {lesson.concepts.map((concept) => <section key={concept.title} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="text-sm font-semibold">{concept.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{concept.body}</p>
              </section>)}
            </aside>
          </div>}

          {stage === 'investigate' && <div className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-semibold">Investigation checklist</h2>
              <p className="mt-1 text-sm text-slate-400">Use evidence from both snapshots. Reveal a hint only when needed.</p>
              <ol className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{lesson.tasks.map((task, i) => (
                <li key={task.id} className="rounded-lg border border-slate-700 bg-slate-950 p-4">
                  <div className="flex items-start gap-3"><span className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-xs text-sky-300">{i + 1}</span>
                    <div><h3 className="text-sm font-semibold">{task.title}</h3><p className="mt-2 text-xs leading-5 text-slate-300">{task.instruction}</p>
                      <button onClick={() => setExpandedHints((current) => current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id])}
                        aria-expanded={expandedHints.includes(task.id)} className="mt-3 text-xs font-medium text-sky-300 underline underline-offset-4">{expandedHints.includes(task.id) ? 'Hide hint' : 'Reveal hint'}</button>
                      {expandedHints.includes(task.id) && <p className="mt-2 text-xs leading-5 text-amber-200">{task.hint}</p>}
                    </div>
                  </div>
                </li>
              ))}</ol>
            </section>

            <div className="grid items-start gap-5 lg:grid-cols-2">
              <section className="min-w-0 rounded-xl border border-sky-900 bg-slate-900 p-5">
                <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">Desired state</h2><span className="text-xs font-semibold text-sky-300">READ ONLY</span></div>
                <p className="mb-3 text-xs leading-5 text-slate-400">`desired-deployment.yaml` — approved baseline, supplied by the server.</p>
                <pre aria-label="Approved desired Kubernetes YAML" className="max-h-[550px] min-h-72 overflow-auto whitespace-pre rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs leading-5 text-slate-200">{desired}</pre>
              </section>
              <section className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-5">
                <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">Observed snapshot</h2><span className="text-xs font-semibold text-amber-300">EDITABLE</span></div>
                <label htmlFor="live-drift-yaml" className="mb-3 block text-xs leading-5 text-slate-400">`live-snapshot.yaml` — modify only this simulated live YAML. No real cluster is changed.</label>
                <textarea id="live-drift-yaml" value={live} spellCheck={false} onChange={(event) => {
                  setLive(event.target.value);
                  setAssessment(null); setCompleted(false); setError(''); setNotice(''); setResetArmed(false);
                }} className="h-[550px] w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-base leading-6 text-slate-100 outline-none focus:border-sky-400 md:text-sm" />
              </section>
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="font-semibold">Validate your reconciliation</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">Scan for drift first. A scan gives feedback but never awards points. Submitting a fully reconciled snapshot awards 250 points once per assignment.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button disabled={working || !live.trim()} onClick={() => void scan(false)} className="rounded-lg border border-sky-500 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-950 disabled:cursor-not-allowed disabled:opacity-50">{working ? 'Assessing…' : 'Scan for drift'}</button>
                  <button disabled={working || !live.trim()} onClick={() => void scan(true)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">Submit reconciliation</button>
                  <button disabled={working} onClick={() => {
                    if (!resetArmed) { setResetArmed(true); return; }
                    setLive(starter); setAssessment(null); setCompleted(false); setError(''); setNotice('Starter snapshot restored. Your edits have been replaced.'); setResetArmed(false);
                  }} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">{resetArmed ? 'Confirm restore (discard edits)' : 'Restore starter snapshot'}</button>
                  {resetArmed && <button onClick={() => setResetArmed(false)} className="text-sm text-slate-300 underline underline-offset-4">Cancel</button>}
                </div>
                {error && <p role="alert" className="mt-4 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
                {notice && <p role="status" className="mt-4 rounded-lg bg-slate-950 p-3 text-sm text-slate-200">{notice}</p>}
                {completed && <button onClick={() => setStage('review')} className="mt-4 text-sm font-semibold text-sky-300 underline underline-offset-4">Review what you learned →</button>}
              </section>
              <aside className="space-y-4" aria-live="polite">
                <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <h2 className="font-semibold">Drift findings</h2>
                  {!assessment ? <p className="mt-3 text-sm text-slate-400">Run a scan to see the differences, keyed by configuration path.</p> : assessment.findings.length === 0 ? <p className="mt-3 text-sm text-emerald-300">No drift found in the supplied snapshot.</p> : (
                    <ul className="mt-3 max-h-96 space-y-3 overflow-auto">{assessment.findings.map((finding, index) => <li key={`${finding.id}-${index}`} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                      <span className="text-xs font-bold text-amber-300">{finding.severity}</span>
                      <h3 className="mt-1 break-words text-sm font-semibold">{finding.title}</h3>
                      <p className="mt-1 break-all font-mono text-xs text-sky-300">{finding.path}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-300">{finding.explanation}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-300"><strong>Remediation:</strong> {finding.recommendation}</p>
                    </li>)}</ul>
                  )}
                </section>
                {assessment && <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <h2 className="font-semibold">Reconciliation requirements</h2>
                  <p className="mt-2 text-xs text-slate-400">{met} of {total} checks passed in the last scan.</p>
                  <ul className="mt-3 space-y-2">{assessment.requirements.map((req) => <li key={req.id} className={`text-xs leading-5 ${req.met ? 'text-emerald-300' : 'text-amber-200'}`}>{req.met ? '✓' : '○'} {req.title}</li>)}</ul>
                </section>}
              </aside>
            </div>
          </div>}

          {stage === 'review' && <section className="max-w-4xl rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Knowledge check</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Review the difference between drift and proven compromise. This quiz is formative and does not change your score.</p>
            <div className="mt-6 space-y-7">{lesson.questions.map((question, index) => {
              const feedback = quiz?.results.find((item) => item.question_id === question.id);
              return <fieldset key={question.id} className="border-t border-slate-700 pt-5">
                <legend className="text-sm font-semibold leading-6">{index + 1}. {question.question}</legend>
                <div className="mt-3 space-y-2">{question.options.map((option) => <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 hover:border-sky-600">
                  <input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => { setAnswers((a) => ({ ...a, [question.id]: option.id })); setQuiz(null); }} className="mt-1 accent-sky-500" />
                  <span>{option.text}</span>
                </label>)}</div>
                {feedback && <p className={`mt-3 text-sm leading-6 ${feedback.correct ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {feedback.correct ? 'Correct.' : `Consider: ${question.options.find((option) => option.id === feedback.correct_option_id)?.text ?? 'Review the lesson.'}`} {feedback.explanation}
                </p>}
              </fieldset>;
            })}</div>
            <button disabled={working || lesson.questions.some((q) => !answers[q.id])} onClick={() => void checkKnowledge()} className="mt-6 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50">{working ? 'Checking…' : 'Check answers'}</button>
            {quiz && <p role="status" className="mt-4 text-sm text-slate-200">{quiz.correct_count} of {quiz.total_questions} correct. {quiz.message}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
            <button onClick={() => setStage('investigate')} className="mt-5 block text-sm font-medium text-sky-300 underline underline-offset-4">Return to snapshots →</button>
          </section>}
        </>}
      </div>
    </main>
  );
};

export default KubernetesDriftLabPage;
