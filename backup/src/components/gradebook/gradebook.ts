import { getLetterGrade } from '../../utils/grading.ts';

// One student's row in an assignment's gradebook, as the gradebook API returns it.
export interface GradeRow {
  student_id: number;
  student_name: string;
  email: string;
  completed_modules: number;
  total_modules: number;
  completion_percent: number;
  attempts: number;
  score_percent: number | null;
  rubric_percent: number;
  manual_adjustment: number;
  final_percent: number;
  feedback: string;
  grade_status: 'DRAFT' | 'PUBLISHED' | string;
  last_activity_at: string | null;
}

export interface GradebookAssignment {
  assignment_id: number;
  lab_id: string;
  lab_title: string;
  group_id: number | null;
  student_count: number;
  start_datetime: string | null;
  end_datetime: string | null;
  status: string;
}

export type Standing = 'not-started' | 'working' | 'stuck' | 'done';

export const STANDING_LABEL: Record<Standing, string> = {
  'not-started': 'Not started',
  working: 'Working',
  stuck: 'Stuck',
  done: 'Done',
};

// A student is stuck after three or more attempts that cleared nothing new.
const STUCK_AFTER = 3;

export function studentStanding(row: GradeRow): Standing {
  if (row.completion_percent >= 100) return 'done';
  if (row.completed_modules === 0 && row.attempts === 0) return 'not-started';
  return row.attempts - row.completed_modules >= STUCK_AFTER ? 'stuck' : 'working';
}

export function finalPercent(row: GradeRow, adjustment: number) {
  return Math.min(100, Math.max(0, Math.round((row.score_percent ?? 0) + adjustment)));
}

// Numbers stay numbers. Text is always quoted, and text that starts like a formula
// is saved as plain text, so a student named "=HYPERLINK(...)" cannot run anything
// when the file is opened in Excel.
const cell = (value: string | number) => {
  if (typeof value === 'number') return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
};

export function toCsv(rows: GradeRow[]) {
  const header = ['Student', 'Email', 'Modules done', 'Modules', 'Attempts', 'Auto score %', 'Adjustment', 'Final %', 'Grade', 'Status', 'Feedback'];
  const lines = rows.map((row) => [
    row.student_name,
    row.email,
    row.completed_modules,
    row.total_modules,
    row.attempts,
    Math.round(row.score_percent ?? 0),
    Math.round(row.manual_adjustment),
    Math.round(row.final_percent),
    getLetterGrade(row.final_percent) ?? '',
    row.grade_status === 'PUBLISHED' ? 'Published' : 'Draft',
    row.feedback ?? '',
  ].map(cell).join(','));
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}
