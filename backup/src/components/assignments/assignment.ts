import { serverTime } from '../../utils/assignmentState.ts';

// The student's view of one assignment, as the API returns it.
export interface Assignment {
  id: number;
  lab_id: string;
  lab_name: string;
  difficulty: string;
  assigned_by: string;
  group_name: string;
  start_datetime: string | null;
  end_datetime: string | null;
  status: string;
  progress_percent: number;
  published_grade?: PublishedGrade | null;
}

// Only present once the teacher has published grades for the assignment.
export interface PublishedGrade {
  final_percent: number;
  letter: string;
  feedback: string;
  published_at: string | null;
}

export const timingOf = (item: Assignment) => ({
  start: item.start_datetime,
  end: item.end_datetime,
  progress: item.progress_percent ?? 0,
});

const dateTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const formatWhen = (value: string | null) => {
  const at = serverTime(value);
  return at === null ? '' : dateTime.format(new Date(at));
};
