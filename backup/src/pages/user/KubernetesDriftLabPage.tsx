import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';

type Phase = 'investigate' | 'decide' | 'reconcile' | 'verify';
type View = 'briefing' | Phase | 'review';
type Choice = { id: string; text: string };
type Finding = { id: string; severity: string; title: string; path: string; explanation: string };
type Question = { id: string; question: string; options: Choice[] };
type Evidence = {
  observations: Record<string, { observed: string; desired: string }>;
  impacts: Record<string, string>;
  plans: Record<string, string>;
  verification: string;
};
type Lesson = {
  course: { safety: string; duration_minutes: number };
  scenario: string;
  objectives: string[];
  concepts: { title: string; body: string }[];
  questions: Question[];
  assessment: {
    observations: { id: string; title: string; path: string; observed_options: Choice[]; desired_options: Choice[] }[];
    impact_options: Choice[];
    plans: { id: string; title: string; options: Choice[] }[];
    repairs: { id: string; title: string; options: Choice[] }[];
    verification: { title: string; options: Choice[] };
  };
};
type Feedback = { id: string; observed_ok?: boolean; desired_ok?: boolean; impact_ok?: boolean; correct?: boolean; selected?: boolean; hint?: string };
type StageResult = {
  phase: Phase;
  prerequisites_met: boolean;
  stage_passed: boolean;
  feedback: Feedback[];
  message: string;
  review: { phases: { id: string; score: number; max_points: number }[]; score_preview: number; max_points: number };
  snapshot_preview?: string;
  findings?: Finding[];
  finding_count?: number;
  passed?: boolean;
  completion?: { already_completed: boolean; points_awarded: number } | null;
};
type Quiz = { correct_count: number; total_questions: number; message: string; results: { question_id: string; correct: boolean; correct_option_id: string; explanation: string }[] };

const API = '/api/v1/kubernetes-drift-lab';
const PHASES: { id: Phase; title: string; pts: number; description: string }[] = [
  { id: 'investigate', title: 'Investigate', pts: 210, description: 'Find and explain six original differences' },
  { id: 'decide', title: 'Decide', pts: 90, description: 'Choose safe response actions' },
  { id: 'reconcile', title: 'Reconcile', pts: 150, description: 'Apply six targeted corrections' },
  { id: 'verify', title: 'Verify', pts: 50, description: 'Check scope and complete the assessment' },
];
const BLANK: Evidence = { observations: {}, impacts: {}, plans: {}, verification: '' };
const selectStyle = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus-visible:border-sky-400';
const primaryStyle = 'rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50';
const mutedStyle = 'rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string') return payload.detail;
  return fallback;
}
function shuffled(questions: Question[]): Question[] {
  return questions.map((q) => {
    const options = [...q.options];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { ...q, options };
  });
}
function FeedbackMark({ ok, hint }: { ok?: boolean; hint?: string }) {
  if (ok === undefined) return null;
  return <p className={`mt-1 text-xs ${ok ? 'text-emerald-300' : 'text-amber-200'}`}>
    {ok ? 'Verified' : hint || 'Recheck the original snapshot and the approved baseline.'}
  </p>;
}
function SnapshotPanel({ title, subtitle, content }: { title: string; subtitle: string; content: string }) {
  return <section className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-4">
    <h3 className="text-sm font-semibold text-slate-100">{title} <span className="ml-2 font-normal text-slate-400">READ ONLY</span></h3>
    <p className="my-2 text-xs text-slate-400">{subtitle}</p>
    <pre className="max-h-72 min-h-32 overflow-auto whitespace-pre rounded-lg bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-200" tabIndex={0}>{content}</pre>
  </section>;
}

export const KubernetesDriftLabPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [view, setView] = useState<View>('briefing');
  const [unlocked, setUnlocked] = useState(0);
  const [desired, setDesired] = useState('');
  const [starter, setStarter] = useState('');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [evidence, setEvidence] = useState<Evidence>(BLANK);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [focusItem, setFocusItem] = useState(0);
  const [results, setResults] = useState<Partial<Record<Phase, StageResult>>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [completed, setCompleted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/workspace`);
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'An active Kubernetes Drift assignment is required.'));
      if (payload.desired?.filename !== 'desired-deployment.yaml' ||
          payload.files?.[0]?.filename !== 'live-snapshot.yaml' ||
          !Array.isArray(payload.learning?.assessment?.repairs)) {
        throw new Error('The updated guided-workflow backend is required. Please contact your facilitator.');
      }
      setDesired(payload.desired.content);
      setStarter(payload.files[0].content);
      setLesson({ ...payload.learning, questions: shuffled(payload.learning.questions) });
      setView('briefing'); setUnlocked(0); setFocusItem(0);
      setEvidence({ observations: {}, impacts: {}, plans: {}, verification: '' });
      setActions({}); setResults({}); setCompleted(false); setNotice(''); setAnswers({}); setQuiz(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the lab.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);
  useEffect(() => { void load(); }, [load]);

  const phaseIndex = (phase: Phase) => PHASES.findIndex((s) => s.id === phase);
  const updateEvidence = (phase: Phase, updated: Evidence) => {
    setEvidence(updated); setUnlocked((value) => Math.min(value, phaseIndex(phase)));
    setResults((old) => Object.fromEntries(Object.entries(old).filter(([key]) => phaseIndex(key as Phase) < phaseIndex(phase))) as Partial<Record<Phase, StageResult>>);
    setNotice(''); setCompleted(false);
  };
  const updateAction = (id: string, value: string) => {
    setActions((old) => ({ ...old, [id]: value }));
    setUnlocked((value) => Math.min(value, 2));
    setResults((old) => ({ investigate: old.investigate, decide: old.decide }));
    setNotice(''); setCompleted(false);
  };
  const evaluate = async (phase: Phase, submit = false) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await apiFetch(`${API}/${submit ? 'submit' : 'stage'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submit ? { evidence, actions } : { phase, evidence, actions }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'Assessment could not be checked.'));
      const result = payload as StageResult;
      setResults((old) => ({ ...old, [phase]: result }));
      if (result.stage_passed && !submit) setUnlocked((value) => Math.max(value, phaseIndex(phase) + 1));
      if (submit && result.passed) {
        setCompleted(true); setView('review');
        setNotice(`Lab completed. ${result.completion?.points_awarded ?? 0} points awarded${result.completion?.already_completed ? ' (already completed)' : ''}.`);
      } else {
        setNotice(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assessment failed.');
    } finally {
      setBusy(false);
    }
  };
  const checkKnowledge = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`${API}/knowledge-check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'Unable to check your answers.'));
      setQuiz(payload as Quiz);
    } catch (err) { setError(err instanceof Error ? err.message : 'Knowledge check failed.'); }
    finally { setBusy(false); }
  };
  const phase = PHASES.find((item) => item.id === view);
  const selected = lesson?.assessment.observations[focusItem];
  const relevant = view === 'briefing' || view === 'review' ? undefined : results[view];
  const activeFeedback = relevant?.feedback ?? [];

  return <main className="min-h-screen bg-slate-950 px-4 py-7 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/assigned-labs')} className="mb-3 text-sm text-sky-300 hover:underline">← Back to assigned labs</button>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Kubernetes Configuration Drift Detection</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">Investigate the original change, decide what is safe, then restore the simulated workload.</p>
        </div>
        <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs font-semibold text-emerald-300">OFFLINE SIMULATION · 500 POINTS</span>
      </header>
      {loading ? <p className="rounded-xl bg-slate-900 p-6" role="status">Loading guided lab…</p> : !lesson ? (
        <section className="rounded-xl bg-slate-900 p-6"><h2 className="font-semibold">Workspace unavailable</h2>
          <p className="mt-2 text-sm text-rose-300" role="alert">{error}</p><button className={`${primaryStyle} mt-4`} onClick={() => void load()}>Retry</button></section>
      ) : <>
        <nav aria-label="Assessment steps" className="mb-6 grid gap-2 sm:grid-cols-4">
          {PHASES.map((step, index) => <button key={step.id} disabled={index > unlocked}
            aria-current={view === step.id ? 'step' : undefined}
            onClick={() => { setView(step.id); setError(''); setNotice(''); }}
            className={`rounded-xl border px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50 ${view === step.id ? 'border-sky-400 bg-sky-950' : index < unlocked ? 'border-emerald-700 bg-slate-900' : 'border-slate-700 bg-slate-900'}`}>
            <span className="block text-xs text-sky-300">{index < unlocked ? 'Verified' : `Step ${index + 1}`} · {step.pts} pts</span>
            <span className="mt-1 block font-semibold">{step.title}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-400">{step.description}</span>
          </button>)}
        </nav>
        {view === 'briefing' && <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Your mission</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{lesson.scenario}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{lesson.concepts.map((concept) => <div key={concept.title} className="rounded-lg bg-slate-950 p-4"><h3 className="font-semibold">{concept.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{concept.body}</p></div>)}</div>
          <p className="mt-4 text-xs text-slate-400">{lesson.course.safety} · About {lesson.course.duration_minutes} minutes.</p>
          <button className={`${primaryStyle} mt-6`} onClick={() => setView('investigate')}>Begin investigation</button>
        </section>}
        {phase && <div className="space-y-5">
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{phase.title} <span className="text-sm font-normal text-slate-400">· {phase.pts} points</span></h2><span className="text-xs text-slate-400">Step {phaseIndex(phase.id) + 1} of 4</span></div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{
              view === 'investigate' ? 'Compare the untouched snapshots below. The observed values must come from the ORIGINAL snapshot, not your later corrections.' :
              view === 'decide' ? 'Now that the original differences are verified, choose how you would respond to each change.' :
              view === 'reconcile' ? 'Make small, named changes to the simulated live snapshot. Full-document paste is not accepted. Check the resulting preview.' :
              'The configuration may match without proving the application runs. Explain what this offline comparison verifies, then submit.'
            }</p>
          </section>
          {view === 'investigate' && <>
            <div className="grid gap-4 lg:grid-cols-2">
              <SnapshotPanel title="Original observed" subtitle="Snapshot before any corrections" content={starter}/>
              <SnapshotPanel title="Approved desired" subtitle="Authoritative comparison baseline" content={desired}/>
            </div>
            {selected && <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs text-slate-400">Difference {focusItem + 1} of {lesson.assessment.observations.length}</p>
                  <h3 className="mt-1 text-lg font-semibold">{selected.title}</h3><p className="mt-1 break-all font-mono text-xs text-sky-300">{selected.path}</p></div>
                <div className="flex gap-2"><button className={mutedStyle} disabled={focusItem === 0} onClick={() => setFocusItem((i) => i - 1)}>Previous</button>
                  <button className={mutedStyle} disabled={focusItem === lesson.assessment.observations.length - 1} onClick={() => setFocusItem((i) => i + 1)}>Next</button></div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {(['observed', 'desired'] as const).map((field) => <label key={field} className="block text-sm">
                  <span className="font-semibold">{field === 'observed' ? 'Before: original observed' : 'Target: approved desired'}</span>
                  <select className={selectStyle} value={evidence.observations[selected.id]?.[field] ?? ''}
                    onChange={(event) => updateEvidence('investigate', { ...evidence, observations: { ...evidence.observations, [selected.id]: { observed: evidence.observations[selected.id]?.observed ?? '', desired: evidence.observations[selected.id]?.desired ?? '', [field]: event.target.value } } })}>
                    <option value="">Choose a value</option>
                    {(field === 'observed' ? selected.observed_options : selected.desired_options).map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
                  </select>
                  <FeedbackMark ok={activeFeedback.find((f) => f.id === selected.id)?.[field === 'observed' ? 'observed_ok' : 'desired_ok']} hint={`Compare ${selected.path} in the ${field === 'observed' ? 'original observed' : 'approved desired'} YAML.`}/>
                </label>)}
                <label className="block text-sm"><span className="font-semibold">What could this difference affect?</span>
                  <select className={selectStyle} value={evidence.impacts[selected.id] ?? ''}
                    onChange={(event) => updateEvidence('investigate', { ...evidence, impacts: { ...evidence.impacts, [selected.id]: event.target.value } })}>
                    <option value="">Choose an impact</option>
                    {lesson.assessment.impact_options.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
                  </select><FeedbackMark ok={activeFeedback.find((f) => f.id === selected.id)?.impact_ok} hint="Consider the operational or security consequence of this field."/></label>
              </div>
              <div className="mt-5 flex flex-wrap gap-2" aria-label="Choose difference">
                {lesson.assessment.observations.map((item, index) => {
                  const status = activeFeedback.find((f) => f.id === item.id);
                  const verified = status?.observed_ok && status?.desired_ok && status?.impact_ok;
                  return <button key={item.id} onClick={() => setFocusItem(index)}
                    aria-label={`Difference ${index + 1}: ${item.title}${status ? verified ? ', verified' : ', needs attention' : ''}`}
                    aria-current={index === focusItem ? 'step' : undefined}
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${index === focusItem ? 'bg-sky-600 text-white' : status ? verified ? 'bg-emerald-900 text-emerald-100' : 'bg-amber-900 text-amber-100' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{index + 1}{status ? verified ? ' ✓' : ' !' : ''}</button>;
                })}
              </div>
            </section>}
          </>}
          {view === 'decide' && <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold">How should the team respond?</h3>
            <p className="mt-2 text-sm text-slate-400">An unexpected object needs ownership review; drift does not automatically prove an attack.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">{lesson.assessment.plans.map((item) => <label key={item.id} className="block rounded-lg bg-slate-950 p-4 text-sm">
              <span className="font-semibold">{item.title}</span><select className={selectStyle} value={evidence.plans[item.id] ?? ''}
                onChange={(event) => updateEvidence('decide', { ...evidence, plans: { ...evidence.plans, [item.id]: event.target.value } })}>
                <option value="">Select response</option>{item.options.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
              </select><FeedbackMark ok={activeFeedback.find((f) => f.id === item.id)?.correct} hint="Review the safest response for this particular difference."/>
            </label>)}</div>
          </section>}
          {view === 'reconcile' && <>
            <div className="grid gap-4 lg:grid-cols-2"><SnapshotPanel title="Original observed" subtitle="Trusted starting point" content={starter}/>
              <SnapshotPanel title="Approved desired" subtitle="Read-only target" content={desired}/></div>
            <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <h3 className="font-semibold">Targeted remediation changes</h3><p className="mt-2 text-sm text-slate-400">Choose a concrete change for each field. The server rebuilds the outcome from the starting snapshot; you cannot overwrite the whole document.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">{lesson.assessment.repairs.map((item) => <label key={item.id} className="block rounded-lg bg-slate-950 p-4 text-sm">
                <span className="font-semibold">{item.title}</span><select className={selectStyle} value={actions[item.id] ?? ''}
                  onChange={(event) => updateAction(item.id, event.target.value)}><option value="">Choose a change</option>
                  {item.options.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}</select>
                <FeedbackMark ok={activeFeedback.find((f) => f.id === item.id)?.selected} hint="Select an action for this field." />
              </label>)}</div>
            </section>
            {relevant?.snapshot_preview && <><SnapshotPanel title="Resulting simulated snapshot" subtitle="Server-generated preview, not a real Kubernetes deployment" content={relevant.snapshot_preview}/>
              <section className="rounded-xl border border-slate-700 bg-slate-900 p-4"><h3 className="font-semibold">Remaining differences: {relevant.finding_count}</h3>
                {relevant.findings?.length ? <ul className="mt-3 space-y-2 text-sm text-amber-200">{relevant.findings.map((f) => <li key={f.id}>{f.title} · <code className="break-all">{f.path}</code></li>)}</ul>
                  : <p className="mt-2 text-sm text-emerald-300">No differences in the simulated snapshot. Continue to verification.</p>}</section></>}
          </>}
          {view === 'verify' && <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold">What have we actually verified?</h3>
            <p className="mt-2 text-sm text-slate-300">Static snapshot comparison cannot prove that a Deployment starts, passes admission, reaches readiness, or serves traffic.</p>
            <label className="mt-4 block max-w-2xl text-sm"><span className="font-semibold">{lesson.assessment.verification.title}</span>
              <select className={selectStyle} value={evidence.verification}
                onChange={(event) => updateEvidence('verify', { ...evidence, verification: event.target.value })}>
                <option value="">Choose the supported conclusion</option>{lesson.assessment.verification.options.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
              </select><FeedbackMark ok={activeFeedback.find((f) => f.id === 'verification')?.correct} hint="Only offline YAML agreement was checked."/></label>
            <div className="mt-5 rounded-lg bg-slate-950 p-4 text-sm text-slate-300">Your previous stages were checked by the server. The final submission repeats every prerequisite check before awarding the 500 points once.</div>
          </section>}
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-5" aria-live="polite">
            <div className="flex flex-wrap items-center gap-3">
              {phaseIndex(phase.id) > 0 && <button className={mutedStyle} onClick={() => setView(PHASES[phaseIndex(phase.id) - 1].id)}>Back</button>}
              <button className={primaryStyle} disabled={busy} onClick={() => void evaluate(phase.id)}>{busy ? 'Checking…' : `Check ${phase.title.toLowerCase()}`}</button>
              {relevant?.stage_passed && view !== 'verify' && <button className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-600" onClick={() => setView(PHASES[phaseIndex(phase.id) + 1].id)}>Continue to {PHASES[phaseIndex(phase.id) + 1].title}</button>}
              {view === 'verify' && relevant?.stage_passed && <button className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50" disabled={busy} onClick={() => void evaluate('verify', true)}>Submit completed assessment</button>}
            </div>
            {notice && <p className={`mt-3 text-sm ${relevant?.stage_passed ? 'text-emerald-300' : 'text-amber-200'}`} role="status">{notice}</p>}
            {error && <p className="mt-3 text-sm text-rose-300" role="alert">{error}</p>}
            {relevant && <p className="mt-2 text-xs text-slate-400">Feedback applies to this step only. {relevant.stage_passed ? 'Validated; you can continue.' : 'Correct highlighted items, then check again.'}</p>}
          </section>
        </div>}
        {view === 'review' && <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">{completed ? 'Assessment completed' : 'Review your understanding'}</h2>
          {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
          <p className="mt-2 text-sm text-slate-300">This knowledge check provides learning feedback; it does not award additional completion points.</p>
          <div className="mt-5 space-y-5">{lesson.questions.map((question, index) => {
            const feedback = quiz?.results.find((item) => item.question_id === question.id);
            return <fieldset key={question.id} className="border-t border-slate-700 pt-4"><legend className="text-sm font-semibold">{index + 1}. {question.question}</legend>
              <div className="mt-3 space-y-2">{question.options.map((option) => <label key={option.id} className="flex items-start gap-3 rounded-lg bg-slate-950 p-3 text-sm">
                <input className="mt-1" type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => { setAnswers((old) => ({ ...old, [question.id]: option.id })); setQuiz(null); }}/><span>{option.text}</span>
              </label>)}</div>{feedback && <p className={`mt-2 text-sm ${feedback.correct ? 'text-emerald-300' : 'text-amber-200'}`}>{feedback.correct ? 'Correct.' : 'Review the reasoning.'} {feedback.explanation}</p>}
            </fieldset>;
          })}</div>
          <button className={`${primaryStyle} mt-5`} disabled={busy || lesson.questions.some((q) => !answers[q.id])} onClick={() => void checkKnowledge()}>Check my answers</button>
          {quiz && <p role="status" className="mt-3 text-sm">{quiz.correct_count} of {quiz.total_questions} correct. {quiz.message}</p>}
          <button className="mt-5 block text-sm text-sky-300 underline" onClick={() => setView('verify')}>Back to verification</button>
        </section>}
      </>}
    </div>
  </main>;
};

export default KubernetesDriftLabPage;
