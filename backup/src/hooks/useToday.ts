import { useEffect, useState } from 'react';
import { sysadminGradingService, type AuthenticatedFetch, type SysadminSubmission } from '../services/sysadminGradingService';

// What the dashboard needs to talk about today: the next deadline, the
// submission streak, and what the student actually did recently.

export interface Deadline {
  labId: string;
  labName: string;
  endsAt: Date;
}

export interface DoneItem {
  id: number;
  labId: string;
  title: string;
  course: string;
  path: string;
  passed: boolean;
  score: number | null;
  maxScore: number | null;
  at: Date;
}

export interface TodayData {
  loaded: boolean;
  deadline: Deadline | null;
  streak: number;
  week: boolean[];
  weekSubmissions: number;
  activity: DoneItem[];
  /** Distinct grader challenges passed (Linux sysadmin, workshop, race). */
  passedChallenges: number;
  /** The same, per grader course id. Only the latest submissions are read, so a course's server count can be higher. */
  passedByCourse: Record<string, number>;
  /** Challenges passed on the very first attempt. */
  firstTryPasses: number;
  /** Challenges in the grader-backed courses this student can see. */
  graderTotal: number;
}

// The grader-backed courses, so a submission id can be named and linked.
const COURSES = [
  { id: 'linux-sysadmin-lab', title: 'Linux sysadmin', path: '/labs/linux-sysadmin' },
  { id: 'linux-security-workshop', title: 'Linux security', path: '/labs/linux-security-workshop' },
  { id: 'race-conditions-lab', title: 'Race conditions', path: '/labs/race-conditions-lab' },
];

// Challenge ids start with their course's prefix, which names retired challenges too.
function courseByPrefix(labId: string) {
  if (labId.startsWith('RACE-')) return COURSES[2];
  if (labId.startsWith('WS-')) return COURSES[1];
  return COURSES[0];
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function parseUtc(value: string) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

// Days in a row, ending today or yesterday, with at least one submission.
function streakOf(days: Set<string>) {
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useToday(apiFetch: AuthenticatedFetch): TodayData {
  const [data, setData] = useState<TodayData>({
    loaded: false, deadline: null, streak: 0, week: Array(7).fill(false), weekSubmissions: 0, activity: [], passedChallenges: 0, passedByCourse: {}, firstTryPasses: 0, graderTotal: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Challenge titles are only cosmetic, so they load alongside and fill in later.
      const catalogsLoading = Promise.all(COURSES.map((course) => sysadminGradingService.listLabs(apiFetch, course.id).catch(() => [])));
      const [assignments, submissions] = await Promise.all([
        apiFetch('/api/v1/user/assignments').then((r) => (r.ok ? r.json() : [])).catch(() => []),
        sysadminGradingService.listRecentSubmissions(apiFetch, 50).catch(() => [] as SysadminSubmission[]),
      ]);
      if (cancelled) return;

      const now = Date.now();
      const deadline = (Array.isArray(assignments) ? assignments : [])
        .map((row: { lab_id?: string; lab_name?: string; end_datetime?: string }) => ({
          labId: row.lab_id ?? '',
          labName: row.lab_name ?? 'Assigned lab',
          endsAt: row.end_datetime ? parseUtc(row.end_datetime) : new Date(NaN),
        }))
        .filter((row: Deadline) => row.endsAt.getTime() > now)
        .sort((a: Deadline, b: Deadline) => a.endsAt.getTime() - b.endsAt.getTime())[0] ?? null;

      const finished = submissions.filter((row) => ['PASS', 'FAIL'].includes(row.status.toUpperCase()));
      const days = new Set(submissions.map((row) => dayKey(parseUtc(row.submitted_at))));
      const week = Array.from({ length: 7 }, (_, i) => {
        const day = new Date();
        day.setDate(day.getDate() - (6 - i));
        return days.has(dayKey(day));
      });
      const weekAgo = now - 7 * 86_400_000;

      // Oldest first, so the first attempt per challenge is seen first.
      const firstAttempt = new Map<string, boolean>();
      const passed = new Set<string>();
      [...finished].reverse().forEach((row) => {
        if (!firstAttempt.has(row.lab_id)) firstAttempt.set(row.lab_id, Boolean(row.passed));
        if (row.passed) passed.add(row.lab_id);
      });

      setData((current) => ({
        graderTotal: current.graderTotal,
        loaded: true,
        deadline,
        streak: streakOf(days),
        week,
        weekSubmissions: submissions.filter((row) => parseUtc(row.submitted_at).getTime() > weekAgo).length,
        passedChallenges: passed.size,
        passedByCourse: [...passed].reduce<Record<string, number>>((byCourse, labId) => {
          const id = courseByPrefix(labId).id;
          byCourse[id] = (byCourse[id] ?? 0) + 1;
          return byCourse;
        }, {}),
        firstTryPasses: [...firstAttempt.values()].filter(Boolean).length,
        activity: finished.slice(0, 6).map((row) => {
          const course = courseByPrefix(row.lab_id);
          return {
            id: row.submission_id,
            labId: row.lab_id,
            title: row.lab_id,
            course: course.title,
            path: `${course.path}/${encodeURIComponent(row.lab_id)}`,
            passed: Boolean(row.passed),
            score: row.score,
            maxScore: row.max_score,
            at: parseUtc(row.completed_at ?? row.submitted_at),
          };
        }),
      }));

      const catalogs = await catalogsLoading;
      if (cancelled) return;
      const titles = new Map<string, { title: string; course: string; path: string }>();
      catalogs.forEach((rows, index) => {
        const course = COURSES[index];
        rows.forEach((lab) => titles.set(lab.lab_id, {
          title: lab.title.replace(/^\d+\.\s*/, ''),
          course: course.title,
          path: `${course.path}/${encodeURIComponent(lab.lab_id)}`,
        }));
      });

      setData((current) => ({
        ...current,
        graderTotal: catalogs.reduce((sum, rows) => sum + rows.length, 0),
        activity: current.activity.map((item) => {
          const known = titles.get(item.labId);
          return known ? { ...item, ...known } : item;
        }),
      }));
    };
    void load();
    return () => { cancelled = true; };
  }, [apiFetch]);

  return data;
}
