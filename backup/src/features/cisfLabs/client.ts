export const CISF_LAB_IDS = ['aws-cisf', 'gcp-cisf', 'kubernetes-cisf', 'iac-cisf'] as const;
export type CisfLabId = typeof CISF_LAB_IDS[number];
export type Choices = Record<string, string>;
export type Task = { id: string; title: string; instruction: string; hint: string; initial: string | null;
  options: Array<{ id: string; label: string; effect: string }> };
export type Lesson = { schema_version: 1; lab_id: CisfLabId; assignment_id: number; mode: 'guided-practice';
  title: string; minutes: number; points: number; completed: boolean; summary: string; introduction: string;
  analogy: string; scenario: string; safety: string; takeaway: string;
  terms: Array<{ word: string; meaning: string }>; tasks: Task[] };
export type Result = { lab_id: CisfLabId; mode: 'guided-practice'; passed: boolean; checks_passed: number;
  checks_total: number; checks: Array<{ id: string; title: string; passed: boolean; feedback: string }>;
  observations: Array<{ title: string; result: string }>; message: string;
  completion: null | { already_completed: boolean; points_awarded: number; new_total_score: number } };
export type Fetch = (path: string, options?: RequestInit) => Promise<Response>;
const API = '/api/v1/cisf-labs';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string';
export function assignmentId(value: string | null): number | null {
  return value && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
export function lessonValid(value: unknown, lab: CisfLabId, assignment: number): value is Lesson {
  if (!object(value) || value.schema_version !== 1 || value.lab_id !== lab || value.assignment_id !== assignment
      || value.mode !== 'guided-practice' || typeof value.completed !== 'boolean'
      || !Number.isSafeInteger(value.minutes) || Number(value.minutes) < 1 || !Number.isSafeInteger(value.points) || Number(value.points) < 1
      || !['title','summary','introduction','analogy','scenario','safety','takeaway'].every(key => string(value[key]))
      || !Array.isArray(value.terms) || !value.terms.every(term => object(term) && string(term.word) && string(term.meaning))
      || !Array.isArray(value.tasks) || value.tasks.length !== 3) return false;
  if (!value.tasks.every(task => object(task) && ['id','title','instruction','hint'].every(key => string(task[key]))
      && Array.isArray(task.options) && task.options.length === 2
      && task.options.every(option => object(option) && ['id','label','effect'].every(key => string(option[key])))
      && new Set(task.options.map(option => option.id)).size === 2
      && (task.initial === null || task.options.some(option => option.id === task.initial)))) return false;
  return new Set(value.tasks.map(task => task.id)).size === 3;
}
export function initialChoices(lesson: Lesson): Choices {
  return Object.fromEntries(lesson.tasks.filter(task => task.initial !== null).map(task => [task.id, task.initial! ]));
}
export function resultValid(value: unknown, lesson: Lesson, submit: boolean): value is Result {
  if (!object(value) || value.lab_id !== lesson.lab_id || value.mode !== 'guided-practice'
      || typeof value.passed !== 'boolean' || !string(value.message)
      || !Array.isArray(value.checks) || value.checks.length !== 3 || value.checks_total !== 3
      || !value.checks.every(item => object(item) && string(item.id) && string(item.title)
        && typeof item.passed === 'boolean' && string(item.feedback))
      || new Set(value.checks.map(item => item.id)).size !== 3
      || !value.checks.every(item => lesson.tasks.some(task => item.id === task.id))
      || value.checks_passed !== value.checks.filter(item => item.passed).length
      || value.passed !== value.checks.every(item => item.passed)
      || !Array.isArray(value.observations) || value.observations.length !== 2
      || !value.observations.every(item => object(item) && string(item.title) && string(item.result))) return false;
  if (!submit || !value.passed) return value.completion === null;
  const done = value.completion;
  return object(done) && typeof done.already_completed === 'boolean' && Number.isSafeInteger(done.points_awarded)
    && Number(done.points_awarded) >= 0 && Number(done.points_awarded) <= lesson.points
    && (!done.already_completed || done.points_awarded === 0)
    && Number.isSafeInteger(done.new_total_score) && Number(done.new_total_score) >= 0;
}
export function cisfClient(apiFetch: Fetch, lab: CisfLabId, assignment: number) {
  if (!CISF_LAB_IDS.includes(lab) || !assignmentId(String(assignment))) throw new Error('Open this lab from your assignments.');
  async function request(path: string, body?: object, signal?: AbortSignal) {
    let response: Response;
    try {
      response = await apiFetch(`${API}/${lab}/${path}`, body ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      } : { signal });
    } catch {
      throw new Error('Cannot reach the lab service. Check your connection and try again.');
    }
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(object(value) && string(value.detail) && value.detail.length < 300 ? value.detail
      : 'The lab service is unavailable. Please retry or ask your facilitator.');
    return value;
  }
  return {
    async workspace(signal?: AbortSignal): Promise<Lesson> {
      const value = await request(`workspace?assignment_id=${assignment}`, undefined, signal);
      if (!lessonValid(value, lab, assignment)) throw new Error('The lab service returned an incompatible lesson. Ask your facilitator.');
      return value;
    },
    async grade(lesson: Lesson, choices: Choices, submit: boolean): Promise<Result> {
      const value = await request(submit ? 'submit' : 'check', { assignment_id: assignment, choices });
      if (!resultValid(value, lesson, submit)) throw new Error('The lab service returned an incomplete result. Please retry.');
      return value;
    },
  };
}
