import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock3, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context';
import {
  liveK8sClient, LiveK8sApiError, parseAssignmentId, validSessionId,
  type Catalog, type Evidence, type Feedback, type Phase, type Session, type VerifyResult,
} from '../../features/liveK8s/client';
import {
  ACTION_LABELS, PHASES, completeAnswers, nextPhase, phaseUnlocked,
  pointsPreview, readyForAssessment, validCatalog,
} from '../../features/liveK8s/workflow';

type PageView = 'briefing' | Phase | 'complete';
const liveEnabled = import.meta.env.VITE_LIVE_K8S_UI_ENABLED === 'true';
const selectStyle = 'mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60';
const primaryStyle = 'rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryStyle = 'rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50';

function display(value: unknown): string {
  if (value === null || value === undefined) return 'Not specified';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(', ') || 'None';
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => `${key}=${display(entry)}`).join(', ') || 'None';
  return String(value);
}

function expiresOn(timestamp?: string): string {
  if (!timestamp) return 'Unavailable';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
}

function FactRow({ label, value }: { label: string; value: unknown }) {
  return <div className="flex flex-col gap-1 border-t border-slate-800 py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
    <dt className="text-sm text-slate-400">{label}</dt>
    <dd className="break-words text-sm font-medium text-slate-100 sm:max-w-[65%] sm:text-right">{display(value)}</dd>
  </div>;
}

function LiveObservations({ evidence, onRefresh, busy }: { evidence: Evidence | null; onRefresh: () => void; busy: boolean }) {
  const observed = evidence?.observations;
  return <section className="rounded-xl border border-slate-700 bg-slate-900 p-5" aria-labelledby="live-observations-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="live-observations-title" className="font-semibold">Read-only Kubernetes observations</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">Live API facts from your assigned namespace. These are not editable manifests or a simulated snapshot.</p>
      </div>
      <button type="button" onClick={onRefresh} disabled={busy} className={secondaryStyle}><RefreshCw className="mr-2 inline h-4 w-4"/>Refresh evidence</button>
    </div>
    {!observed ? <p className="mt-4 text-sm text-amber-200">No verified live observations are available. Refresh after your session becomes ready.</p> : <>
      <dl className="mt-4 grid gap-x-8 lg:grid-cols-2">
        <div>
          <FactRow label="Pod Security enforcement" value={observed.pod_security_enforce}/>
          <FactRow label="Run as non-root" value={observed.web_security?.run_as_non_root}/>
          <FactRow label="Seccomp profile" value={observed.web_security?.seccomp_type}/>
          <FactRow label="Privilege escalation allowed" value={observed.web_security?.allow_privilege_escalation}/>
          <FactRow label="Read-only root filesystem" value={observed.web_security?.read_only_root_fs}/>
        </div>
        <div>
          <FactRow label="Pod automatically mounts API token" value={observed.api_token?.pod_automount}/>
          <FactRow label="ServiceAccount automatically mounts token" value={observed.api_token?.service_account_automount}/>
          <FactRow label="ConfigMap Role rules" value={observed.configmap_role_rules?.map((rule) => `${display(rule.resources)} / ${display(rule.verbs)} / ${display(rule.resource_names)}`)}/>
          <FactRow label="Service selector" value={observed.service_selector}/>
          <FactRow label="NetworkPolicy objects" value={observed.network_policy_names}/>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-400">Scanner reports {evidence?.finding_count ?? '—'} findings. This count is context, not a grading result or proof of traffic isolation.</p>
    </>}
  </section>;
}

export const LiveKubernetesSecurityLabPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const assignmentId = parseAssignmentId(params.get('assignment_id'));
  const { apiFetch, user } = useAuth();
  const api = useMemo(() => liveK8sClient(apiFetch), [apiFetch]);
  const cacheKey = user?.id && assignmentId ? `cyberrange-live-k8s:${user.id}:${assignmentId}` : null;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [view, setView] = useState<PageView>('briefing');
  const [answers, setAnswers] = useState<Record<'investigate' | 'assess', Record<string, string>>>({ investigate: {}, assess: {} });
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [focus, setFocus] = useState(0);
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stopArmed, setStopArmed] = useState(false);
  const [completion, setCompletion] = useState<VerifyResult['completion'] | null>(null);

  const refreshSession = useCallback(async (sessionId: string) => {
    if (!assignmentId) return;
    const current = await api.session(assignmentId, sessionId);
    setSession(current);
    if (current.state === 'TERMINATED') {
      if (cacheKey) sessionStorage.removeItem(cacheKey);
      setSession(null); setView('briefing'); setEvidence(null);
    } else if (readyForAssessment(current.state, current.stage_ready)) {
      const fresh = await api.evidence(assignmentId, sessionId);
      setEvidence(fresh);
    }
    return current;
  }, [api, assignmentId, cacheKey]);

  const initialize = useCallback(async () => {
    if (!liveEnabled || !assignmentId || !cacheKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.catalog(assignmentId);
      if (!validCatalog(data)) throw new Error('An incompatible version of the assessment backend is configured. Contact your facilitator.');
      setCatalog(data);
      const stored = sessionStorage.getItem(cacheKey);
      if (validSessionId(stored)) {
        try {
          const current = await refreshSession(stored);
          if (current?.state === 'TERMINATED') {
            setView('briefing');
          } else if (current && readyForAssessment(current.state, current.stage_ready)) {
            setView(current.stages?.verify ? 'complete' : nextPhase(current));
          }
        } catch (caught) {
          if (caught instanceof LiveK8sApiError && caught.status === 404) {
            sessionStorage.removeItem(cacheKey);
            setSession(null);
          } else throw caught;
        }
      } else if (stored) sessionStorage.removeItem(cacheKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the assigned assessment.');
    } finally {
      setLoading(false);
    }
  }, [api, assignmentId, cacheKey, refreshSession]);

  useEffect(() => { void initialize(); }, [initialize]);

  useEffect(() => {
    if (!session?.session_id || !assignmentId || readyForAssessment(session.state, session.stage_ready) ||
        ['CLEANING', 'TERMINATED', 'FAILED'].includes(session.state)) return;
    const id = session.session_id;
    const interval = window.setInterval(() => {
      void refreshSession(id).catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'Could not check session readiness.');
      });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [assignmentId, refreshSession, session?.session_id, session?.state, session?.stage_ready]);

  async function perform(task: () => Promise<void>) {
    if (working) return;
    setWorking(true); setError(''); setNotice('');
    try { await task(); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The request could not be completed.');
      if (caught instanceof LiveK8sApiError && caught.status === 409 && session?.session_id) {
        try { await refreshSession(session.session_id); }
        catch { /* Keep the original failure visible; no automatic replay of a write. */ }
      }
    } finally { setWorking(false); }
  }

  const start = () => perform(async () => {
    if (!assignmentId || !cacheKey) return;
    const created = await api.start(assignmentId);
    if (!validSessionId(created.session_id)) throw new Error('Backend returned an invalid session ID.');
    sessionStorage.setItem(cacheKey, created.session_id);
    setSession(created); setView('briefing'); setEvidence(null); setCompletion(null);
    setNotice('Namespace requested. The assessment unlocks only after live readiness and isolation checks pass.');
    const current = await refreshSession(created.session_id);
    if (current && readyForAssessment(current.state, current.stage_ready)) setView(nextPhase(current));
  });

  const refresh = () => perform(async () => {
    if (!session?.session_id) return;
    const current = await refreshSession(session.session_id);
    if (current && readyForAssessment(current.state, current.stage_ready)) {
      setNotice('Live observations and session status refreshed.');
      if (view === 'briefing') setView(nextPhase(current));
    }
  });

  const grade = (phase: 'investigate' | 'assess') => perform(async () => {
    if (!assignmentId || !session?.session_id || typeof session.revision !== 'number') return;
    const result = await api.grade(assignmentId, session.session_id, phase, session.revision, answers[phase]);
    setSession((previous) => previous ? { ...previous, ...result } : previous);
    setFeedback(result.feedback || []);
    setNotice(result.passed ? 'Stage verified by CyberRange. You can continue.' : 'Some answers need another look. Review the live evidence and retry.');
  });

  const applyAction = (actionId: string) => perform(async () => {
    if (!assignmentId || !session?.session_id || typeof session.revision !== 'number') return;
    if (!catalog?.actions.some((item) => item.id === actionId)) return;
    const result = await api.action(assignmentId, session.session_id, actionId, session.revision);
    setSession((previous) => previous ? { ...previous, ...result } : previous);
    setNotice(result.already_applied ? 'This change was already applied.' : 'Change verified against fresh Kubernetes state and isolation checks.');
    await refreshSession(session.session_id);
  });

  const verify = () => perform(async () => {
    if (!assignmentId || !session?.session_id || typeof session.revision !== 'number') return;
    const result = await api.verify(assignmentId, session.session_id, session.revision);
    if (!result.passed) throw new Error('Live verification did not pass.');
    setSession((previous) => previous ? { ...previous, ...result } : previous);
    setCompletion(result.completion);
    setView('complete');
    setNotice('The backend confirmed the live security checks and recorded module completion.');
  });

  const stop = () => perform(async () => {
    if (!assignmentId || !session?.session_id) return;
    const result = await api.stop(assignmentId, session.session_id);
    setStopArmed(false);
    setSession((previous) => previous ? { ...previous, state: result.state } : previous);
    setNotice('Cleanup requested. The namespace lease remains reserved until deletion finishes.');
    if (result.state === 'TERMINATED') {
      if (cacheKey) sessionStorage.removeItem(cacheKey);
      setSession(null); setView('briefing'); setEvidence(null);
    }
  });

  const ready = !!session && readyForAssessment(session.state, session.stage_ready);
  const currentPhase = PHASES.find((phase) => phase.id === view);
  const questions = (view === 'investigate' ? catalog?.investigation : view === 'assess' ? catalog?.assessment : undefined) ?? [];
  const activeQuestion = questions[focus];
  const applied = session?.actions_applied ?? [];
  const currentAction = catalog?.actions[focus];
  const actionInfo = currentAction ? ACTION_LABELS[currentAction.id] : null;
  const score = pointsPreview(session ?? undefined);

  return <main className="min-h-screen bg-slate-950 px-4 py-7 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button type="button" className="mb-3 inline-flex items-center gap-2 text-sm text-sky-300 hover:underline" onClick={() => navigate('/assigned-labs')}><ArrowLeft className="h-4 w-4"/>Back to assignments</button>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Live Kubernetes Security Assessment</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Investigate a running application, judge its security boundaries, apply targeted controls, and verify real cluster behavior.</p>
        </div>
        <span className="rounded-full border border-sky-800 bg-sky-950 px-3 py-1.5 text-xs font-semibold text-sky-200">ISOLATED TEACHING CLUSTER · 500 PTS</span>
      </header>

      {!liveEnabled ? <section className="rounded-xl border border-amber-800 bg-slate-900 p-6" role="status">
        <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-amber-300"/><div><h2 className="font-semibold">Live lab not released</h2><p className="mt-2 text-sm leading-6 text-slate-300">This student interface is installed but intentionally disabled while the Kubernetes cluster, remediation worker, and safety checks are being commissioned. No session has been launched.</p></div></div>
      </section> : !assignmentId ? <section className="rounded-xl border border-amber-800 bg-slate-900 p-6" role="alert">
        <h2 className="font-semibold">An assignment is required</h2><p className="mt-2 text-sm text-slate-300">Open this lab from your active Assignments page. Its assignment reference is needed for every request.</p>
        <button type="button" className={`${primaryStyle} mt-4`} onClick={() => navigate('/assigned-labs')}>Open assignments</button>
      </section> : loading ? <section role="status" className="animate-pulse rounded-xl border border-slate-700 bg-slate-900 p-6 text-sm text-slate-300">Loading your assigned assessment…</section>
        : !catalog ? <section className="rounded-xl border border-amber-800 bg-slate-900 p-6" role="alert">
          <h2 className="font-semibold">Assessment not available</h2><p className="mt-2 text-sm text-amber-200">{error || 'The approved assessment catalog is not available yet.'}</p>
          <button type="button" className={`${secondaryStyle} mt-4`} onClick={() => void initialize()}>Retry</button>
        </section> : <>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900 px-5 py-4" aria-label="Assessment status">
            <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-sky-300"/><div><p className="text-sm font-semibold">{session?.stages?.verify ? 'Verified completion' : session ? `Session ${session.state.toLowerCase()}` : 'Ready to provision'}</p><p className="text-xs text-slate-400">Assignment #{assignmentId}{session && ` · Expires ${expiresOn(session.expires_at)}`}</p></div></div>
            <div className="text-right"><p className="text-2xl font-bold tabular-nums">{score}<span className="text-sm font-medium text-slate-400"> / 500</span></p><p className="text-xs text-slate-400">Validated progress preview · not awarded points</p></div>
          </section>

          {session && <nav aria-label="Assessment stages" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PHASES.map((phase, index) => {
              const done = session.stages?.[phase.id] ?? false;
              const unlocked = ready && phaseUnlocked(phase.id, session);
              return <button key={phase.id} type="button" disabled={!unlocked || working}
                aria-current={view === phase.id ? 'step' : undefined}
                onClick={() => { setView(phase.id); setFocus(0); setFeedback([]); setNotice(''); }}
                className={`rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50 ${view === phase.id ? 'border-sky-400 bg-sky-950' : done ? 'border-emerald-800 bg-slate-900' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'}`}>
                <span className={`text-xs ${done ? 'text-emerald-300' : 'text-slate-400'}`}>{done ? 'Verified' : `Step ${index + 1}`} · {phase.points} pts</span><span className="mt-1 block font-semibold">{phase.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{phase.description}</span>
              </button>;
            })}
          </nav>}

          {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><span>{error}</span></div>}
          {notice && <div role="status" className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-sky-200">{notice}</div>}

          {!session && <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Your mission</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">You will work inside a temporary Kubernetes namespace that is shared with no other student. CyberRange controls the Kubernetes API, while you investigate live observations and request six specifically approved changes.</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2"><p>Real Deployment, ServiceAccount, Role, Service and NetworkPolicy objects</p><p>Read-only evidence; no kubectl, SSH, or kubeconfig access</p><p>Server-owned remediation and isolation checks</p><p>500 points only after verified completion</p></div>
            <button type="button" className={`${primaryStyle} mt-6`} onClick={() => void start()} disabled={working}><ArrowRight className="mr-2 inline h-4 w-4"/>{working ? 'Requesting namespace…' : 'Start isolated session'}</button>
          </section>}

          {session && !ready && <section className="rounded-xl border border-slate-700 bg-slate-900 p-6" role="status">
            <h2 className="text-lg font-semibold">{session.state === 'CLEANING' ? 'Cleanup in progress' : session.state === 'FAILED' ? 'Session needs facilitator attention' : session.state === 'TERMINATED' ? 'Session ended' : 'Checking cluster readiness'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{session.state === 'CLEANING' ? 'Resources must be deleted before another session can start.' : session.state === 'FAILED' ? 'The cluster did not satisfy the required launch checks. No grading is available.' : session.state === 'TERMINATED' ? 'This namespace is no longer available.' : 'The backend is provisioning resources and testing isolation. The stage controls stay locked until it confirms readiness.'}</p>
            <button type="button" className={`${secondaryStyle} mt-4`} disabled={working} onClick={() => void refresh()}><RefreshCw className="mr-2 inline h-4 w-4"/>Refresh status</button>
          </section>}

          {ready && (view === 'briefing') && <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Your namespace is ready</h2><p className="mt-2 text-sm text-slate-300">CyberRange has completed its readiness checks. Start with the live observations, not guessed values.</p>
            <button type="button" className={`${primaryStyle} mt-4`} onClick={() => setView(nextPhase(session))}>Continue assessment</button>
          </section>}

          {ready && currentPhase && <div className="space-y-5">
            <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{currentPhase.title} <span className="text-sm font-normal text-slate-400">· {currentPhase.points} pts</span></h2><span className="text-xs text-slate-400">Server-verified stage</span></div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{view === 'investigate' ? 'Read the live fields and identify the current security configuration. Answers are checked against the original live baseline.' : view === 'assess' ? 'Distinguish real risks from assumptions: namespace Roles, token exposure, Service routing and additive network policies.' : view === 'remediate' ? 'Apply one approved remediation at a time. Each change is checked by the backend; no arbitrary YAML or commands are submitted.' : 'Completion requires a fresh hardened scan and actual live network, authorization and application health checks. A zero-finding scan alone is insufficient.'}</p>
            </section>
            {(view === 'investigate' || view === 'remediate' || view === 'verify') && <LiveObservations evidence={evidence} busy={working} onRefresh={() => void refresh()}/>}
            {(view === 'investigate' || view === 'assess') && session.stages?.[view] && <section className="rounded-xl border border-emerald-800 bg-slate-900 p-5" role="status">
              <p className="text-sm font-semibold text-emerald-300"><CheckCircle2 className="mr-2 inline h-4 w-4"/>This reasoning stage has already passed.</p>
              <p className="mt-2 text-sm text-slate-300">Your validated progress is stored on the server. Individual choices are not retained in your browser after a reload.</p>
            </section>}
            {(view === 'investigate' || view === 'assess') && !session.stages?.[view] && activeQuestion && <section className="rounded-xl border border-slate-700 bg-slate-900 p-5" aria-labelledby="current-question-title">
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-medium text-sky-300">Question {focus + 1} of {questions.length}</p><div className="flex gap-2"><button type="button" className={secondaryStyle} onClick={() => setFocus((index) => Math.max(0, index - 1))} disabled={focus === 0}>Previous</button><button type="button" className={secondaryStyle} onClick={() => setFocus((index) => Math.min(questions.length - 1, index + 1))} disabled={focus === questions.length - 1}>Next</button></div></div>
              <label htmlFor={`live-k8s-${activeQuestion.id}`} id="current-question-title" className="mt-3 block text-base font-semibold">{activeQuestion.prompt}</label>
              <select id={`live-k8s-${activeQuestion.id}`} className={selectStyle} disabled={working || !!session.stages?.[view]} value={answers[view][activeQuestion.id] ?? ''} onChange={(event: { target: { value: string } }) => { setAnswers((all) => ({ ...all, [view]: { ...all[view], [activeQuestion.id]: event.target.value } })); setFeedback([]); setNotice(''); }}>
                <option value="">Select an answer</option>{activeQuestion.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              {feedback.find((entry) => entry.id === activeQuestion.id) && <p className={`mt-2 text-sm ${feedback.find((entry) => entry.id === activeQuestion.id)?.correct ? 'text-emerald-300' : 'text-amber-200'}`}>{feedback.find((entry) => entry.id === activeQuestion.id)?.correct ? 'Correct — confirmed by CyberRange.' : 'Recheck the live evidence and the question scope.'}</p>}
              <div className="mt-5 flex flex-wrap gap-2" aria-label="Choose a question">{questions.map((question, index) => { const result = feedback.find((entry) => entry.id === question.id); return <button key={question.id} type="button" aria-label={`Question ${index + 1}${result ? result.correct ? ', correct' : ', needs attention' : ''}`} aria-current={focus === index ? 'step' : undefined} onClick={() => setFocus(index)} className={`rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${focus === index ? 'bg-sky-600 text-white' : result ? result.correct ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-200' : answers[view][question.id] ? 'bg-slate-700 text-slate-100' : 'bg-slate-800 text-slate-400'}`}>{index + 1}</button>; })}</div>
              <div className="mt-5 border-t border-slate-700 pt-4">{session.stages?.[view] ? <p className="text-sm text-emerald-300"><CheckCircle2 className="mr-2 inline h-4 w-4"/>This stage is verified.</p> : <button type="button" className={primaryStyle} onClick={() => void grade(view)} disabled={working || !completeAnswers(questions, answers[view])}>{working ? 'Checking answers…' : `Check all ${questions.length} answers`}</button>}</div>
            </section>}
            {view === 'remediate' && currentAction && actionInfo && <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-medium text-sky-300">Change {focus + 1} of {catalog.actions.length}</p><div className="flex gap-2"><button type="button" className={secondaryStyle} disabled={focus === 0} onClick={() => setFocus((index) => Math.max(index - 1, 0))}>Previous</button><button type="button" className={secondaryStyle} disabled={focus === catalog.actions.length - 1} onClick={() => setFocus((index) => Math.min(index + 1, catalog.actions.length - 1))}>Next</button></div></div>
              <h3 className="mt-3 text-lg font-semibold">{actionInfo.title}</h3><p className="mt-2 text-sm text-slate-300">{actionInfo.description}</p>
              <p className="mt-3 text-xs text-slate-400">This applies a fixed backend-owned mutation to your assigned namespace. You cannot submit a manifest or target another namespace.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">{applied.includes(currentAction.id) ? <p className="text-sm text-emerald-300"><CheckCircle2 className="mr-2 inline h-4 w-4"/>Applied and verified</p> : <button type="button" className={primaryStyle} disabled={working || (currentAction.id === 'enforce-restricted-pod-security' && !applied.includes('harden-workload'))} onClick={() => void applyAction(currentAction.id)}>{working ? 'Applying and verifying…' : 'Apply approved change'}</button>}{currentAction.id === 'enforce-restricted-pod-security' && !applied.includes('harden-workload') && <p className="text-sm text-amber-200">Harden the workload first.</p>}</div>
              <div className="mt-5 flex flex-wrap gap-2" aria-label="Select remediation">{catalog.actions.map((action, index) => <button type="button" key={action.id} aria-label={`${ACTION_LABELS[action.id].title}${applied.includes(action.id) ? ', verified' : ''}`} aria-current={focus === index ? 'step' : undefined} onClick={() => setFocus(index)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${index === focus ? 'bg-sky-600 text-white' : applied.includes(action.id) ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{applied.includes(action.id) ? '✓ ' : ''}{index + 1}</button>)}</div>
              <p className="mt-4 text-xs text-slate-400">{applied.length} of 6 approved changes verified · {applied.length * 25} / 150 remediation preview points</p>
            </section>}
            {view === 'verify' && <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <h3 className="text-lg font-semibold">Final live verification</h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">The backend must confirm an unchanged namespace identity, a clean security scan, workload readiness, allowed client traffic, blocked unauthorized traffic, and restricted API permissions. Your browser cannot assert these results.</p>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-950 p-4 text-sm text-slate-300"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300"/>The score is committed only if the entire verification transaction succeeds; retrying cannot award duplicate points.</div>
              <button type="button" className={`${primaryStyle} mt-5`} disabled={working || applied.length !== 6 || !!session.stages?.verify} onClick={() => void verify()}>{working ? 'Running live verification…' : 'Run live verification & submit'}</button>
            </section>}
            {view !== 'verify' && phaseUnlocked(nextPhase(session), session) && session.stages?.[currentPhase.id] && <div className="flex justify-end"><button type="button" className={primaryStyle} onClick={() => { setView(nextPhase(session)); setFocus(0); setFeedback([]); }}>Continue to {PHASES.find((phase) => phase.id === nextPhase(session))?.title}<ArrowRight className="ml-2 inline h-4 w-4"/></button></div>}
          </div>}

          {ready && (view === 'complete' || session.stages?.verify) && <section className="rounded-xl border border-emerald-800 bg-slate-900 p-6">
            <ShieldCheck className="h-8 w-8 text-emerald-300"/><h2 className="mt-3 text-xl font-semibold">Assessment verified</h2>
            <p className="mt-2 text-sm text-slate-300">CyberRange recorded successful live validation for this module. Completion is idempotent; replaying this page does not award extra points.</p>
            <p className="mt-4 text-sm font-semibold text-emerald-300">{completion ? `${completion.points_awarded} points awarded in this request${completion.already_completed ? ' (previously completed)' : ''}` : '500-point module completion recorded previously'}</p>
            <button type="button" className={`${secondaryStyle} mt-5`} onClick={() => navigate('/assigned-labs')}>Return to assignments</button>
          </section>}

          {session && session.state !== 'TERMINATED' && <section className="border-t border-slate-800 pt-5">
            <h2 className="text-sm font-semibold text-slate-200">Session controls</h2>
            <p className="mt-1 text-xs text-slate-400">End your disposable namespace when you finish. Cleanup may take additional time.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {!stopArmed ? <button type="button" disabled={working || session.state === 'CLEANING'} className={secondaryStyle} onClick={() => setStopArmed(true)}>End session</button> : <><span className="text-sm text-amber-200">Delete the session resources?</span><button type="button" disabled={working} className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50" onClick={() => void stop()}>Confirm cleanup</button><button type="button" className={secondaryStyle} onClick={() => setStopArmed(false)}>Cancel</button></>}
            </div>
          </section>}
        </>}
    </div>
  </main>;
};
