// Warm the code for the pages people move between most, so navigating feels
// instant. Each entry imports the same module App.tsx lazy-loads, so the browser
// fetches the chunk once and React.lazy finds it ready.

const STUDENT: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/user/UserDashboard'),
  '/labs': () => import('../pages/user/AvailableLabs'),
  '/assigned-labs': () => import('../pages/user/AssignedLabsPage'),
  '/ctf': () => import('../pages/user/CtfPortalPage'),
  '/statistics': () => import('../pages/user/ProgressPage'),
  '/study-material': () => import('../pages/user/StudyMaterial'),
  '/settings': () => import('../pages/user/SettingsPage'),
  '/profile': () => import('../pages/user/ProfilePage'),
  '/my-labs': () => import('../pages/user/MyLabsPage'),
  '/help': () => import('../pages/shared/HelpFAQPage'),
};

const ADMIN: Record<string, () => Promise<unknown>> = {
  '/admin/dashboard': () => import('../pages/admin/AdminDashboard'),
  '/admin/labs': () => import('../pages/admin/LabMarketplace'),
  '/admin/users': () => import('../pages/admin/UserManagement'),
  '/admin/allocations': () => import('../pages/admin/LabAllocation'),
  '/admin/monitoring': () => import('../pages/admin/MonitoringAnalytics'),
  '/admin/settings': () => import('../pages/admin/AdminSettings'),
  '/admin/purchased-labs': () => import('../pages/admin/PurchasedLabsPage'),
  '/admin/reports': () => import('../pages/admin/ReportsPage'),
  '/admin/ctf': () => import('../pages/admin/CTFListPage'),
  '/admin/scheduler': () => import('../pages/admin/LabSchedulerPage'),
};

const started = new Set<string>();

export function prefetchRoute(path: string) {
  const load = STUDENT[path] ?? ADMIN[path];
  if (!load || started.has(path)) return;
  started.add(path);
  load().catch(() => started.delete(path));
}

// After a layout settles, quietly fetch the rest of its pages one at a time.
export function prefetchArea(area: 'student' | 'admin') {
  const paths = Object.keys(area === 'student' ? STUDENT : ADMIN);
  const idle = (callback: () => void) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(callback, { timeout: 3000 });
    else setTimeout(callback, 1200);
  };
  let index = 0;
  const next = () => {
    if (index >= paths.length) return;
    prefetchRoute(paths[index]);
    index += 1;
    idle(next);
  };
  idle(next);
}
