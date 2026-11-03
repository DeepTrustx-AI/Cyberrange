/** Authenticated, assignment-scoped API client. No raw Kubernetes input is accepted here. */
export const LIVE_K8S_API = '/api/v1/live-k8s';
export const LAB_ID = 'live-kubernetes-security-lab';
export const SESSION_ID_PATTERN = /^[a-f0-9]{32}$/;

export type Phase = 'investigate' | 'assess' | 'remediate' | 'verify';
export type Choice = { id: string; label: string };
export type Question = { id: string; prompt: string; options: Choice[] };
export type Stage = { id: Phase; points: number };
export type Action = { id: string };
export type Catalog = {
  lab_id: string;
  module_id: string;
  max_points: number;
  stages: Stage[];
  investigation: Question[];
  assessment: Question[];
  actions: Action[];
};
export type Progress = {
  revision: number;
  stages: Record<Phase, boolean>;
  actions_applied: string[];
  score_preview: number;
  max_points: number;
};
export type Session = Partial<Progress> & {
  session_id: string;
  state: string;
  expires_at: string;
  stage_ready?: boolean;
};
export type Observation = {
  pod_security_enforce: string | null;
  web_security: {
    run_as_non_root: boolean | null;
    seccomp_type: string | null;
    allow_privilege_escalation: boolean | null;
    read_only_root_fs: boolean | null;
  };
  api_token: { pod_automount: boolean | null; service_account_automount: boolean | null };
  configmap_role_rules: Array<{ resources: string[] | null; resource_names: string[] | null; verbs: string[] | null }>;
  service_selector: Record<string, string> | null;
  network_policy_names: string[];
};
export type Evidence = {
  session_id: string;
  observations: Observation;
  finding_count: number;
  passed: boolean;
};
export type Feedback = { id: string; correct: boolean };
export type StageResult = Progress & {
  phase: 'investigate' | 'assess';
  passed: boolean;
  already_passed?: boolean;
  feedback: Feedback[];
};
export type ActionResult = Progress & { action_id: string; already_applied: boolean };
export type VerifyResult = Progress & {
  passed: boolean;
  completion: { already_completed: boolean; points_awarded: number; new_total_score?: number };
};
export type ApiFetch = (url: string, init?: RequestInit) => Promise<Response>;

export class LiveK8sApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function parseAssignmentId(value: string | null): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function validSessionId(value: string | null): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

function sessionPath(sessionId: string): string {
  if (!validSessionId(sessionId)) throw new LiveK8sApiError('Invalid session reference', 400);
  return `${LIVE_K8S_API}/sessions/${sessionId}`;
}

async function request<T>(apiFetch: ApiFetch, url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(url, init);
  } catch {
    throw new LiveK8sApiError('Cannot reach CyberRange. Check your connection and retry.', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? (payload as { detail: unknown }).detail : null;
    const message = typeof detail === 'string' && detail.length < 350
      ? detail : response.status === 503
        ? 'Live Kubernetes sessions are not available yet. Please contact your facilitator.'
        : response.status === 409
          ? 'Your session has changed or expired. Refresh its status before trying again.'
          : `CyberRange could not complete this request (${response.status}).`;
    throw new LiveK8sApiError(message, response.status);
  }
  if (payload === null || typeof payload !== 'object') {
    throw new LiveK8sApiError('Unexpected response from the assessment service.', 502);
  }
  return payload as T;
}

const json = (body: Record<string, unknown>): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const liveK8sClient = (apiFetch: ApiFetch) => ({
  catalog: (assignmentId: number) => request<Catalog>(apiFetch, `${LIVE_K8S_API}/catalog?assignment_id=${assignmentId}`),
  start: (assignmentId: number) => request<Session>(apiFetch, `${LIVE_K8S_API}/sessions`, json({ assignment_id: assignmentId })),
  session: (assignmentId: number, sessionId: string) => request<Session>(apiFetch, `${sessionPath(sessionId)}?assignment_id=${assignmentId}`),
  evidence: (assignmentId: number, sessionId: string) => request<Evidence>(apiFetch, `${sessionPath(sessionId)}/evidence?assignment_id=${assignmentId}`),
  grade: (assignmentId: number, sessionId: string, phase: 'investigate' | 'assess', revision: number, answers: Record<string, string>) =>
    request<StageResult>(apiFetch, `${sessionPath(sessionId)}/${phase}`, json({ assignment_id: assignmentId, expected_revision: revision, answers })),
  action: (assignmentId: number, sessionId: string, actionId: string, revision: number) =>
    request<ActionResult>(apiFetch, `${sessionPath(sessionId)}/actions/${encodeURIComponent(actionId)}`,
      json({ assignment_id: assignmentId, expected_revision: revision })),
  verify: (assignmentId: number, sessionId: string, revision: number) =>
    request<VerifyResult>(apiFetch, `${sessionPath(sessionId)}/verify`,
      json({ assignment_id: assignmentId, expected_revision: revision })),
  stop: (assignmentId: number, sessionId: string) =>
    request<{ session_id: string; state: string }>(apiFetch,
      `${sessionPath(sessionId)}?assignment_id=${assignmentId}`, { method: 'DELETE' }),
});
