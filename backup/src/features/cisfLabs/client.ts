export const CISF_LAB_IDS = ['aws-cisf', 'gcp-cisf', 'kubernetes-cisf', 'iac-cisf'] as const;
export type CisfLabId = typeof CISF_LAB_IDS[number];
export type Choices = Record<string, string>;
export type Task = { id: string; title: string; instruction: string; hint: string; initial: string | null;
  options: Array<{ id: string; label: string; effect: string }> };
export type Activity = { id: string; title: string; minutes: number; completed: boolean; available: boolean };
export type Progress = { stages: Activity[]; course_completed: boolean };
export type Lesson = { schema_version: 1; lab_id: CisfLabId; assignment_id: number; mode: 'guided-practice';
  title: string; minutes: number; points: number; completed: boolean; summary: string; introduction: string;
  analogy: string; scenario: string; safety: string; takeaway: string;
  stage_id: string; stage_title: string; stage_minutes: number; timing: Array<{title: string; minutes: number}>;
  terms: Array<{ word: string; meaning: string }>; tasks: Task[] } & Progress;
export type Result = { lab_id: CisfLabId; mode: 'guided-practice'; passed: boolean; checks_passed: number;
  assignment_id: number; stage_id: string;
  checks_total: number; checks: Array<{ id: string; title: string; passed: boolean; feedback: string }>;
  observations: Array<{ title: string; result: string }>; message: string;
  completion: null | { already_completed: boolean; points_awarded: number; new_total_score: number } } & Progress;
export type Fetch = (path: string, options?: RequestInit) => Promise<Response>;
const API = '/api/v1/cisf-labs';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string';
export function assignmentId(value: string | null): number | null {
  return value && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
function progressValid(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.stages) || value.stages.length < 1 || value.stages.length > 12
      || !value.stages.every(stage => object(stage) && string(stage.id) && /^[a-z][a-z0-9-]{0,63}$/.test(stage.id)
        && string(stage.title) && Number.isSafeInteger(stage.minutes) && Number(stage.minutes) > 0
        && typeof stage.completed === 'boolean' && typeof stage.available === 'boolean')
      || new Set(value.stages.map(stage => stage.id)).size !== value.stages.length
      || value.course_completed !== value.stages.every(stage => stage.completed)) return false;
  let available = true;
  for (const stage of value.stages) {
    if (stage.available !== available) return false;
    available = available && stage.completed;
  }
  return true;
}
export function lessonValid(value: unknown, lab: CisfLabId, assignment: number, stageId: string | null = null): value is Lesson {
  if (!object(value) || value.schema_version !== 1 || value.lab_id !== lab || value.assignment_id !== assignment
      || value.mode !== 'guided-practice' || typeof value.completed !== 'boolean'
      || !Number.isSafeInteger(value.minutes) || Number(value.minutes) < 1 || !Number.isSafeInteger(value.points) || Number(value.points) < 1
      || !['title','summary','introduction','analogy','scenario','safety','takeaway','stage_id','stage_title'].every(key => string(value[key]))
      || (stageId !== null && value.stage_id !== stageId) || !progressValid(value)
      || !Array.isArray(value.terms) || !value.terms.every(term => object(term) && string(term.word) && string(term.meaning))
      || !Array.isArray(value.tasks) || value.tasks.length !== 3) return false;
  const stages = value.stages as Activity[];
  const selected = stages.find(stage => stage.id === value.stage_id);
  if (!selected || !selected.available || selected.minutes !== value.stage_minutes || selected.title !== value.stage_title
      || selected.completed !== value.completed || stages.reduce((sum, stage) => sum + stage.minutes, 0) !== value.minutes
      || !Array.isArray(value.timing) || value.timing.length !== 3
      || !value.timing.every(item => object(item) && string(item.title) && Number.isSafeInteger(item.minutes) && Number(item.minutes) > 0)
      || value.timing.reduce((sum, item) => sum + item.minutes, 0) !== value.stage_minutes) return false;
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
      || value.assignment_id !== lesson.assignment_id || value.stage_id !== lesson.stage_id || !progressValid(value)
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
  const stages = value.stages as Activity[];
  if (stages.length !== lesson.stages.length || !stages.every((stage, i) => stage.id === lesson.stages[i].id
      && stage.minutes === lesson.stages[i].minutes && stage.title === lesson.stages[i].title)) return false;
  if (!submit || !value.passed) return value.completion === null;
  if (!stages.find(stage => stage.id === lesson.stage_id)?.completed) return false;
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
    async workspace(signal?: AbortSignal, stageId: string | null = null): Promise<Lesson> {
      const value = await request(`workspace?assignment_id=${assignment}${stageId ? `&stage_id=${encodeURIComponent(stageId)}` : ''}`, undefined, signal);
      if (!lessonValid(value, lab, assignment, stageId)) throw new Error('The lab service returned an incompatible lesson. Ask your facilitator.');
      return value;
    },
    async grade(lesson: Lesson, choices: Choices, submit: boolean): Promise<Result> {
      const value = await request(submit ? 'submit' : 'check', { assignment_id: assignment, stage_id: lesson.stage_id, choices });
      if (!resultValid(value, lesson, submit)) throw new Error('The lab service returned an incomplete result. Please retry.');
      return value;
    },
  };
}
