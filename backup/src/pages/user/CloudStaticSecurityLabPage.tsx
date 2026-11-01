import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';

type ModuleId = 'iac-remediation' | 'kubernetes-remediation';
type Stage = 'briefing' | 'practice' | 'review';
type LabFile = { filename: string; content: string };
type Finding = {
  id: string; severity: string; title: string; recommendation: string;
  explanation?: string; investigative_hint?: string; files: string[];
};
type Requirement = { id: string; title: string; met: boolean };
type Learning = {
  course: { title: string; subtitle: string; safety: string; workflow: string[]; duration_minutes: number };
  scenario: string;
  duration_minutes: number;
  objectives: string[];
  concepts: { title: string; body: string }[];
  tasks: { id: string; title: string; file: string; instruction: string; hint: string }[];
  questions: { id: string; question: string; options: { id: string; text: string }[] }[];
};
type QuizResult = {
  correct_count: number; total_questions: number; passed: boolean; message: string;
  results: { question_id: string; correct: boolean; correct_option_id: string; explanation: string }[];
};

const MODULES: { id: ModuleId; title: string; points: number; description: string }[] = [
  { id: 'iac-remediation', title: 'Infrastructure as Code', points: 250, description: 'Terraform and CloudFormation' },
  { id: 'kubernetes-remediation', title: 'Kubernetes hardening', points: 250, description: 'Workloads, identity and network policy' },
];
const STAGES: { id: Stage; title: string; description: string }[] = [
  { id: 'briefing', title: 'Mission briefing', description: 'Understand the risks' },
  { id: 'practice', title: 'Investigate & fix', description: 'Edit, scan and validate' },
  { id: 'review', title: 'Check understanding', description: 'Explain your decisions' },
];

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

function shuffleKnowledgeOptions(lesson: Learning): Learning {
  // Shuffle once per workspace load; preserve stable answer IDs for grading.
  // Answer position must not be a reusable hint across attempts.
  return {
    ...lesson,
    questions: lesson.questions.map((question) => {
      const options = [...question.options];
      for (let index = options.length - 1; index > 0; index--) {
        const pick = Math.floor(Math.random() * (index + 1));
        [options[index], options[pick]] = [options[pick], options[index]];
      }
      return { ...question, options };
    }),
  };
}

export const CloudStaticSecurityLabPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [moduleId, setModuleId] = useState<ModuleId>('iac-remediation');
  const [stage, setStage] = useState<Stage>('briefing');
  const [files, setFiles] = useState<LabFile[]>([]);
  const [starterFiles, setStarterFiles] = useState<LabFile[]>([]);
  const [learning, setLearning] = useState<Learning | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [revealedHints, setRevealedHints] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quiz, setQuiz] = useState<QuizResult | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  const activeModule = useMemo(() => MODULES.find((module) => module.id === moduleId) ?? MODULES[0], [moduleId]);
  const unmetRequirements = requirements.filter((item) => !item.met);

  const loadWorkspace = useCallback(async (target: ModuleId) => {
    setLoading(true);
    setError('');
    setResult('');
    setFindings([]);
    setRequirements([]);
    setHasScanned(false);
    setStage('briefing');
    setRevealedHints([]);
    setAnswers({});
    setQuiz(null);
    setIsCompleted(false);
    setResetArmed(false);
    try {
      const response = await apiFetch(`/api/v1/cloud-static-labs/${target}/workspace`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(response.status === 404
          ? 'Workspace unavailable. Sign in as a learner with an active assignment for Cloud Configuration Hardening, then retry.'
          : errorMessage(payload, 'Unable to load this workspace.'));
      }
      if (!Array.isArray(payload.files) || !payload.learning) {
        throw new Error('This workspace requires the guided-lab backend release.');
      }
      setFiles(payload.files);
      setStarterFiles(payload.files);
      setLearning(shuffleKnowledgeOptions(payload.learning as Learning));
    } catch (err) {
      setFiles([]);
      setStarterFiles([]);
      setLearning(null);
      setError(err instanceof Error ? err.message : 'Unable to load this workspace.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void loadWorkspace(moduleId); }, [moduleId, loadWorkspace]);

  const updateFile = (filename: string, content: string) => {
    setFiles((current) => current.map((file) => file.filename === filename ? { ...file, content } : file));
    setHasScanned(false);
    setFindings([]);
    setRequirements([]);
    setResult('');
    setIsCompleted(false);
    setResetArmed(false);
  };

  const runCheck = async (submit: boolean) => {
    if (!files.length || working || loading) return;
    setWorking(true);
    setError('');
    setResult('');
    try {
      const response = await apiFetch(`/api/v1/cloud-static-labs/${moduleId}/${submit ? 'submit' : 'scan'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'The assessment could not be completed.'));
      setFindings(payload.findings ?? []);
      // A scan now returns the same structural checks as a submission,
      // without awarding points. Learners see missing controls early.
      setRequirements(payload.requirements ?? []);
      setHasScanned(true);
      if (submit) {
        setIsCompleted(Boolean(payload.passed));
        setResult(payload.passed
          ? `Module completed. ${payload.completion?.points_awarded ?? 0} points awarded${payload.completion?.already_completed ? ' (already completed)' : ''}.`
          : payload.message || 'Your submission still needs remediation.');
      } else {
        const missing = (payload.requirements ?? []).filter((item: Requirement) => !item.met).length;
        setResult(payload.finding_count === 0
          ? missing > 0
            ? `No taught-pattern findings, but ${missing} required control${missing === 1 ? '' : 's'} still need attention. Review Submission integrity before submitting.`
            : 'No taught-pattern findings or missing structural controls detected. You can submit your remediation.'
          : `${payload.finding_count} finding${payload.finding_count === 1 ? '' : 's'} detected. Read the impact, update the configuration and scan again.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The security check could not be completed.');
    } finally {
      setWorking(false);
    }
  };

  const checkKnowledge = async () => {
    if (!learning || working) return;
    setWorking(true);
    setError('');
    try {
      const response = await apiFetch(`/api/v1/cloud-static-labs/${moduleId}/knowledge-check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'Unable to assess your answers.'));
      setQuiz(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assess your answers.');
    } finally {
      setWorking(false);
    }
  };

  const resetFiles = () => {
    setFiles(starterFiles.map((file) => ({ ...file })));
    setFindings([]);
    setRequirements([]);
    setHasScanned(false);
    setResult('Starter files restored. Your current edits have been replaced.');
    setIsCompleted(false);
    setResetArmed(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-7 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <button onClick={() => navigate('/labs')} className="mb-3 text-sm text-sky-300 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">← Back to labs</button>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Cloud Configuration Hardening</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Learn to investigate cloud exposure, harden insecure configuration, and explain why each change matters.</p>
          </div>
          <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs font-semibold text-emerald-300">STATIC ANALYSIS ONLY</span>
        </header>

        <nav aria-label="Choose a lab module" className="mb-6 flex flex-wrap gap-2">
          {MODULES.map((module) => (
            <button key={module.id} onClick={() => setModuleId(module.id)} aria-current={module.id === moduleId ? 'step' : undefined}
              className={`rounded-xl border px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${moduleId === module.id ? 'border-sky-400 bg-sky-950 text-white' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}>
              <span className="block font-semibold">{module.title}</span>
              <span className="mt-1 block text-xs text-slate-400">{module.description} · {module.points} points</span>
            </button>
          ))}
        </nav>

        {loading ? <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-slate-300">Loading guided workspace…</p> : !learning ? (
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Workspace unavailable</h2>
            <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>
            <button onClick={() => void loadWorkspace(moduleId)} className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500">Retry loading</button>
          </section>
        ) : <>
          <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 px-5 py-4">
            <p className="text-sm text-slate-200"><strong>Lab boundary:</strong> {learning.course.safety}</p>
            <p className="mt-2 text-xs text-slate-400">Estimated module time: {learning.duration_minutes} minutes · Your edits are kept only on this page until you submit.</p>
          </div>

          <nav aria-label="Learning stages" className="mb-5 grid gap-2 sm:grid-cols-3">
            {STAGES.map((item, index) => (
              <button key={item.id} onClick={() => setStage(item.id)} aria-current={stage === item.id ? 'step' : undefined}
                className={`rounded-xl border px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${stage === item.id ? 'border-sky-400 bg-sky-950' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}>
                <span className="text-xs font-medium text-sky-300">Step {index + 1}</span>
                <span className="mt-1 block font-semibold">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-400">{item.description}</span>
              </button>
            ))}
          </nav>

          {stage === 'briefing' && <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(250px,1fr)]">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Your mission</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{learning.scenario}</p>
              <h3 className="mt-7 text-base font-semibold">What you'll be able to do</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">{learning.objectives.map((item) => <li key={item}>{item}</li>)}</ul>
              <button onClick={() => setStage('practice')} className="mt-8 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500">Start investigation →</button>
            </section>
            <aside className="space-y-3">
              <h2 className="text-lg font-semibold">Concepts to know</h2>
              {learning.concepts.map((concept) => <section key={concept.title} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="font-semibold text-slate-100">{concept.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{concept.body}</p>
              </section>)}
            </aside>
          </div>}

          {stage === 'practice' && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-semibold">Investigation checklist</h2>
                <p className="mt-1 text-sm text-slate-400">Work through each task. Reveal a hint only when you need a nudge.</p>
                <ol className="mt-4 divide-y divide-slate-800">{learning.tasks.map((task, index) => <li key={task.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 rounded-md bg-slate-800 px-2 py-1 text-xs text-sky-300">{index + 1}</span>
                    <div><h3 className="text-sm font-semibold">{task.title}</h3>
                      <p className="mt-1 text-xs text-sky-300">{task.file}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{task.instruction}</p>
                      <button onClick={() => setRevealedHints((current) => current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id])}
                        aria-expanded={revealedHints.includes(task.id)} className="mt-2 text-xs font-medium text-sky-300 underline underline-offset-4 hover:text-sky-100">
                        {revealedHints.includes(task.id) ? 'Hide hint' : 'Reveal hint'}
                      </button>
                      {revealedHints.includes(task.id) && <p className="mt-2 rounded-lg bg-slate-950 p-3 text-sm text-slate-300">{task.hint}</p>}
                    </div>
                  </div>
                </li>)}</ol>
              </section>
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-semibold">Configuration workspace</h2>
                <p className="mt-2 text-sm text-slate-300">Read the starter file before scanning. Change only the text below; nothing is deployed or executed.</p>
                {files.map((file) => <label key={file.filename} className="mt-5 block">
                  <span className="mb-2 block font-mono text-xs text-sky-300">{file.filename}</span>
                  {file.filename.endsWith('.yaml') && <span className="mb-2 block text-xs leading-5 text-slate-400">
                    YAML uses spaces, not tabs. CloudFormation resources must be siblings directly under <code>Resources</code>; Kubernetes documents are separated with <code>---</code>.
                  </span>}
                  <textarea aria-label={`Edit ${file.filename}`} value={file.content} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateFile(file.filename, event.target.value)} spellCheck={false} tabIndex={0}
                    className="h-80 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-base leading-6 text-slate-100 outline-none focus:border-sky-400 md:text-sm" />
                </label>)}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button disabled={working || !files.length} onClick={() => void runCheck(false)} className="rounded-lg border border-sky-500 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-950 disabled:opacity-50">{working ? 'Checking…' : 'Scan configuration'}</button>
                  <button disabled={working || !files.length} onClick={() => void runCheck(true)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">Submit remediation</button>
                  <button disabled={working} onClick={() => resetArmed ? resetFiles() : setResetArmed(true)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">{resetArmed ? 'Confirm restore (discard edits)' : 'Restore starter files'}</button>
                  {resetArmed && <button onClick={() => setResetArmed(false)} className="rounded-lg px-3 py-2 text-sm text-slate-300 underline underline-offset-4">Cancel</button>}
                </div>
                <p className="mt-3 text-xs text-slate-400">Scan previews security findings and resource-integrity requirements without awarding points. Submission awards completion points only when both pass. This is not a production security audit.</p>
                {result && <p role="status" className="mt-4 rounded-lg bg-slate-950 p-3 text-sm text-slate-200">{result}</p>}
                {isCompleted && <button className="mt-4 text-sm font-semibold text-sky-300 underline underline-offset-4" onClick={() => setStage('review')}>Review what you learned →</button>}
              </section>
            </div>
            <aside className="space-y-4 lg:sticky lg:top-6">
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5" aria-live="polite">
                <h2 className="font-semibold">Security findings</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">Investigate the risk before making changes. Rescan after each edit.</p>
                {!hasScanned ? <p className="mt-5 text-sm text-slate-400">No scan yet. Inspect the files, then run your first assessment.</p>
                  : findings.length === 0 ? <p className="mt-5 text-sm text-emerald-300">No taught-pattern findings detected. Check submission integrity below before submitting.</p>
                    : <ul className="mt-4 space-y-3">{findings.map((finding, index) => <li key={`${finding.id}-${index}`} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                      <span className="text-xs font-bold text-amber-300">{finding.severity}</span>
                      <h3 className="mt-1 text-sm font-semibold">{finding.title}</h3>
                      {finding.explanation && <p className="mt-2 text-xs leading-5 text-slate-300"><strong>Why it matters:</strong> {finding.explanation}</p>}
                      <p className="mt-2 text-xs leading-5 text-slate-300"><strong>Remediation:</strong> {finding.recommendation}</p>
                      {finding.investigative_hint && <details className="mt-2 text-xs text-slate-300"><summary className="cursor-pointer font-medium text-sky-300">Investigation hint</summary><p className="mt-2">{finding.investigative_hint}</p></details>}
                    </li>)}</ul>}
              </section>
              {requirements.length > 0 && <section className="rounded-xl border border-slate-800 bg-slate-900 p-5" aria-live="polite">
                <h2 className="font-semibold">Submission integrity</h2>
                <p className="mt-1 text-xs text-slate-400">{requirements.length - unmetRequirements.length} of {requirements.length} required controls verified during the last scan.</p>
                {unmetRequirements.length > 0 ? <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-amber-200">{unmetRequirements.map((item) => <li key={item.id}>{item.title}</li>)}</ul>
                : <p className="mt-3 text-sm text-emerald-300">All required controls detected.</p>}
                <details className="mt-3 text-xs text-slate-300"><summary className="cursor-pointer text-sky-300">Review every integrity check</summary>
                  <ul className="mt-2 space-y-2">{requirements.map((item) => <li key={item.id} className={item.met ? 'text-emerald-300' : 'text-amber-200'}>{item.met ? 'Passed' : 'Needs attention'} — {item.title}</li>)}</ul>
                </details>
              </section>}
            </aside>
          </div>}

          {stage === 'review' && <section className="max-w-4xl rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Check your understanding</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Answer the questions without referring to the hints. This is formative feedback and does not change your lab score.</p>
            <div className="mt-6 space-y-7">{learning.questions.map((question, index) => {
              const feedback = quiz?.results.find((item) => item.question_id === question.id);
              return <fieldset key={question.id} className="border-t border-slate-700 pt-5">
                <legend className="text-sm font-semibold leading-6">{index + 1}. {question.question}</legend>
                <div className="mt-3 space-y-2">{question.options.map((option) => <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 hover:border-sky-600">
                  <input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => { setAnswers((current) => ({ ...current, [question.id]: option.id })); setQuiz(null); }} className="mt-1 accent-sky-500" />
                  <span>{option.text}</span>
                </label>)}</div>
                {feedback && <p className={`mt-3 text-sm leading-6 ${feedback.correct ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {feedback.correct ? 'Correct.' : `Review this: ${question.options.find((option) => option.id === feedback.correct_option_id)?.text ?? 'Revisit the question.'}`} {feedback.explanation}
                </p>}
              </fieldset>;
            })}</div>
            <button disabled={working || learning.questions.some((question) => !answers[question.id])} onClick={() => void checkKnowledge()} className="mt-7 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50">
              {working ? 'Checking answers…' : 'Check my answers'}
            </button>
            {quiz && <p role="status" className="mt-4 text-sm font-semibold text-slate-200">{quiz.correct_count} of {quiz.total_questions} correct. {quiz.message}</p>}
            <p className="mt-5 text-xs text-slate-400">To earn module points, return to Investigate & fix and submit a valid remediation.</p>
            <button onClick={() => setStage('practice')} className="mt-3 text-sm font-medium text-sky-300 underline underline-offset-4">Return to configuration →</button>
          </section>}
          {error && <p role="alert" className="mt-5 rounded-lg border border-rose-800 bg-rose-950/50 p-4 text-sm text-rose-200">{error}</p>}
        </>}
      </div>
    </main>
  );
};

export default CloudStaticSecurityLabPage;
