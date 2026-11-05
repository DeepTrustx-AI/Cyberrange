import { useEffect, useState } from 'react';
import { assignmentState } from '../utils/assignmentState';

type ApiFetch = (url: string, init?: RequestInit) => Promise<Response>;

// How many assignments are due soon, for the badge on "My work".
export function useUrgentWork(apiFetch: ApiFetch, enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiFetch('/api/v1/user/assignments')
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => {
        if (cancelled || !Array.isArray(items)) return;
        const now = new Date();
        setCount(items.filter((item) => {
          const state = assignmentState({ start: item.start_datetime, end: item.end_datetime, progress: item.progress_percent ?? 0 }, now);
          return state === 'due-soon';
        }).length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiFetch, enabled]);
  return count;
}
