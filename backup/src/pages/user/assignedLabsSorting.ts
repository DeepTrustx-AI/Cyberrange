import { sortByUrgency, type AssignmentTiming } from '../../utils/assignmentState';

export const ASSIGNMENT_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'urgent', label: 'Most urgent first' },
] as const;

export type AssignmentSort = (typeof ASSIGNMENT_SORT_OPTIONS)[number]['value'];

export function parseAssignmentSort(value: string | null): AssignmentSort {
  return ASSIGNMENT_SORT_OPTIONS.some((option) => option.value === value)
    ? value as AssignmentSort
    : 'newest';
}

export function sortAssignments<T extends AssignmentTiming & { id: number }>(
  items: readonly T[],
  order: AssignmentSort = 'newest',
  now = new Date(),
): T[] {
  if (order === 'urgent') return sortByUrgency([...items], now);

  // The API supplies auto-generated integer assignment IDs. Start dates and
  // deadlines can be rescheduled, so they must not change assignment recency.
  return [...items].sort((a, b) => order === 'oldest' ? a.id - b.id : b.id - a.id);
}
