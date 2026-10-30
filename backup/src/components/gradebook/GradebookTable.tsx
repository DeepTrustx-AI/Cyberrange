import { getLetterGrade } from '../../utils/grading';
import { STANDING_LABEL, finalPercent, studentStanding, type GradeRow, type Standing } from './gradebook';

export interface Draft {
  adjustment: number;
  feedback: string;
}

interface GradebookTableProps {
  rows: GradeRow[];
  drafts: Record<number, Draft>;
  locked: boolean;
  onChange: (studentId: number, patch: Partial<Draft>) => void;
}

const STANDING_STYLE: Record<Standing, string> = {
  'not-started': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  working: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  stuck: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
};

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function lastActive(value: string | null) {
  if (!value) return 'Never';
  const minutes = Math.round((Date.parse(value) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

const inputClass =
  'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800/60';

// Students down the side, what they did and the teacher's marks across.
export function GradebookTable({ rows, drafts, locked, onChange }: GradebookTableProps) {
  return (
    <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      <table className="w-full min-w-[60rem] text-left text-sm">
        <thead className="border-b border-slate-100 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Student</th>
            <th scope="col" className="px-3 py-3 font-medium">Standing</th>
            <th scope="col" className="px-3 py-3 font-medium">Modules</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Attempts</th>
            <th scope="col" className="px-3 py-3 font-medium">Last active</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Auto</th>
            <th scope="col" className="px-3 py-3 font-medium">Adjust</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Final</th>
            <th scope="col" className="px-3 py-3 font-medium">Feedback</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => {
            const draft = drafts[row.student_id] ?? { adjustment: row.manual_adjustment, feedback: row.feedback };
            const final = finalPercent(row, draft.adjustment);
            const standing = studentStanding(row);
            const share = row.total_modules ? Math.round((row.completed_modules / row.total_modules) * 100) : 0;
            return (
              <tr key={row.student_id} className="align-middle">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900 dark:text-white">{row.student_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{row.email}</p>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STANDING_STYLE[standing]}`}>{STANDING_LABEL[standing]}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
                      <span className="block h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${share}%` }} />
                    </span>
                    <span className="tabular text-slate-700 dark:text-slate-200">{row.completed_modules}/{row.total_modules}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular text-slate-700 dark:text-slate-200">{row.attempts}</td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{lastActive(row.last_activity_at)}</td>
                <td className="px-3 py-3 text-right tabular text-slate-700 dark:text-slate-200">{Math.round(row.score_percent ?? 0)}%</td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    step={1}
                    value={draft.adjustment}
                    disabled={locked}
                    onChange={(event) => onChange(row.student_id, { adjustment: Math.max(-100, Math.min(100, Number(event.target.value) || 0)) })}
                    aria-label={`Adjustment for ${row.student_name}, in percentage points`}
                    className={`${inputClass} w-20 tabular`}
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="font-semibold tabular text-slate-900 dark:text-white">{final}%</span>
                  <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">{getLetterGrade(final)}</span>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value={draft.feedback}
                    maxLength={5000}
                    disabled={locked}
                    placeholder="A note the student will see"
                    onChange={(event) => onChange(row.student_id, { feedback: event.target.value })}
                    aria-label={`Feedback for ${row.student_name}`}
                    className={`${inputClass} w-64`}
                  />
                </td>
                <td className="px-4 py-3">
                  {row.grade_status === 'PUBLISHED' ? (
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Published</span>
                  ) : (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Draft</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
