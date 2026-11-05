import type { SysadminSubmission } from '../services/sysadminGradingService';

// Shared rules for reading grader submissions in the Linux lab workspace.

export const ACTIVE_SUBMISSION_STATUSES = new Set(['QUEUED', 'STARTING', 'RUNNING']);
export const TERMINAL_SUBMISSION_STATUSES = new Set(['PASS', 'FAIL', 'ERROR', 'TIMED_OUT']);

export function formatCriterionId(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

// Which grading step a submission is at, from the statuses the grader reports.
export function gradingStep(latest: SysadminSubmission | null, waiting: boolean, watchFrom: number) {
  if (!waiting) return latest && TERMINAL_SUBMISSION_STATUSES.has(latest.status.toUpperCase()) ? 3 : -1;
  if (!latest || latest.submission_id <= watchFrom) return 0;
  const status = latest.status.toUpperCase();
  if (status === 'QUEUED') return 1;
  if (status === 'STARTING' || status === 'RUNNING') return 2;
  return 3;
}
