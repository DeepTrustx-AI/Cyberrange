/** Presentational workflow helpers only. The server is the authority on grades. */
import type { Catalog, Phase, Progress } from './client';

export const PHASES: { id: Phase; title: string; description: string; points: number }[] = [
  { id: 'investigate', title: 'Investigate', description: 'Read live objects and identify six risks', points: 200 },
  { id: 'assess', title: 'Assess', description: 'Explain the real scope of each risk', points: 100 },
  { id: 'remediate', title: 'Remediate', description: 'Apply six narrowly scoped changes', points: 150 },
  { id: 'verify', title: 'Verify', description: 'Prove workload health and isolation', points: 50 },
];

export const ACTION_LABELS: Record<string, { title: string; description: string }> = {
  'harden-workload': { title: 'Harden the web workload', description: 'Use a restricted-compatible security context.' },
  'disable-api-token': { title: 'Remove unnecessary API access', description: 'Disable automatic ServiceAccount token mounting.' },
  'reduce-configmap-rbac': { title: 'Scope ConfigMap permissions', description: 'Limit the Role to the one named ConfigMap.' },
  'correct-service-selector': { title: 'Correct application routing', description: 'Route only to the intended web Pods.' },
  'restrict-client-network': { title: 'Restrict incoming traffic', description: 'Permit only the approved client; remove broader allows.' },
  'enforce-restricted-pod-security': { title: 'Enforce Restricted Pod Security', description: 'Apply enforcement after the workload is compatible.' },
};

export function readyForAssessment(state: string, stageReady?: boolean): boolean {
  return ['READY', 'ASSESSING', 'VERIFYING'].includes(state) && stageReady !== false;
}

export function phaseUnlocked(phase: Phase, progress?: Partial<Progress>): boolean {
  if (!progress?.stages) return phase === 'investigate';
  switch (phase) {
    case 'investigate': return true;
    case 'assess': return progress.stages.investigate;
    case 'remediate': return progress.stages.assess;
    case 'verify': return progress.actions_applied?.length === 6;
  }
}

export function nextPhase(progress?: Partial<Progress>): Phase {
  if (!progress?.stages?.investigate) return 'investigate';
  if (!progress.stages.assess) return 'assess';
  if ((progress.actions_applied?.length ?? 0) < 6) return 'remediate';
  return 'verify';
}

export function validCatalog(catalog: Catalog): boolean {
  return catalog.lab_id === 'live-kubernetes-security-lab' &&
    catalog.module_id === 'live-kubernetes-security-lab_live-k8s_assessment' &&
    catalog.max_points === 500 &&
    catalog.investigation?.length === 6 &&
    catalog.assessment?.length === 4 &&
    catalog.actions?.length === 6 &&
    catalog.actions.every((action) => Object.hasOwn(ACTION_LABELS, action.id)) &&
    new Set(catalog.actions.map((action) => action.id)).size === 6 &&
    PHASES.every((phase) => catalog.stages?.some((step) => step.id === phase.id && step.points === phase.points));
}

export function completeAnswers(questions: { id: string }[], answers: Record<string, string>): boolean {
  return questions.every((question) => typeof answers[question.id] === 'string' && answers[question.id].length > 0);
}

export function pointsPreview(progress?: Partial<Progress>): number {
  const points = progress?.score_preview;
  return Number.isFinite(points) && typeof points === 'number' ? Math.min(Math.max(points, 0), 500) : 0;
}
