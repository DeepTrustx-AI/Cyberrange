// Titles for admin pages that do not render their own header. The admin layout
// shows one of these above the page so every admin screen opens the same way.
const TITLES: Record<string, { title: string; description: string }> = {
  '/admin/labs': {
    title: 'Lab marketplace',
    description: 'Browse hands-on labs, buy seats and assign them to your groups.',
  },
  '/admin/users': {
    title: 'Students and groups',
    description: 'Import or add students, then organise them into training groups.',
  },
  '/admin/allocations': {
    title: 'Lab allocation',
    description: 'Assign purchased lab seats to groups and set their time windows.',
  },
  '/admin/monitoring': {
    title: 'Monitoring and analytics',
    description: 'Follow how each group and student is progressing through their labs.',
  },
  '/admin/settings': {
    title: 'Settings',
    description: 'Theme, password, feedback and your recent sign-ins.',
  },
  '/admin/purchased-labs': {
    title: 'Purchased labs',
    description: 'Labs your organisation owns, with their remaining seats and hours.',
  },
};

export function adminPageTitle(pathname: string) {
  return TITLES[pathname.replace(/\/+$/, '')] ?? null;
}
