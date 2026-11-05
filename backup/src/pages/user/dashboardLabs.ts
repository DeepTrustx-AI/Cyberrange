export interface TrainingLab {
  id: string;
  title: string;
  category: string;
  status: 'live' | 'upcoming' | 'completed';
  description?: string;
  totalChallenges: number;
  solvedChallenges: number;
  durationHours: number;
  assignmentId: number | null;
  startDatetime: string | null;
  endDatetime: string | null;
}

export interface DashboardLabGroup<T> {
  id: string;
  lab: T;
  assignments: T[];
}

/** Group the display without dropping assignments, combining progress or changing order. */
export function groupDashboardLabs<T extends { id?: string | null }>(
  labs: readonly T[],
): DashboardLabGroup<T>[] {
  const groups = new Map<string, DashboardLabGroup<T>>();
  for (const lab of labs) {
    if (!lab.id) continue;
    const group = groups.get(lab.id);
    if (group) group.assignments.push(lab);
    else groups.set(lab.id, { id: lab.id, lab, assignments: [lab] });
  }
  return [...groups.values()];
}
