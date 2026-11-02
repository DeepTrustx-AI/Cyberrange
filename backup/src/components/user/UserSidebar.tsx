import React from 'react';
import { NavLink } from 'react-router-dom';
import { prefetchRoute } from '../../routes/prefetch';
import { useAuth } from '../../context';
import { Wordmark } from '../brand/LogoMark';
import { initialsOf } from '../../utils/initials';
import { useUrgentWork } from '../../hooks/useUrgentWork';
import {
  LayoutDashboard,
  FlaskConical,
  Settings,
  LogOut,
  Flag,
  BookOpen,
  Layers,
  BarChart2,
  LifeBuoy,
  X,
  type LucideIcon,
} from 'lucide-react';

interface UserSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  badge?: number;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Train',
    items: [
      { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
      { name: 'My work', path: '/assigned-labs', icon: Layers },
      { name: 'Labs', path: '/labs', icon: FlaskConical },
      { name: 'Competitions', path: '/ctf', icon: Flag },
    ],
  },
  {
    label: 'Grow',
    items: [
      { name: 'Progress', path: '/statistics', icon: BarChart2 },
      { name: 'Study material', path: '/study-material', icon: BookOpen },
    ],
  },
];

const FOOTER_ITEMS: NavItem[] = [
  { name: 'Settings', path: '/settings', icon: Settings },
  { name: 'Help', path: '/help', icon: LifeBuoy },
];

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      onMouseEnter={() => prefetchRoute(item.path)}
      onFocus={() => prefetchRoute(item.path)}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
          isActive
            ? 'bg-brand-100 text-brand-900 dark:bg-brand-500/15 dark:text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110 ${
              isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 group-hover:text-slate-500 dark:text-slate-500'
            }`}
            strokeWidth={isActive ? 2.25 : 2}
          />
          <span className="flex-1">{item.name}</span>
          {item.badge ? (
            <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold tabular leading-5 text-white" aria-label={`${item.badge} due soon`}>
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export const UserSidebar: React.FC<UserSidebarProps> = ({ isOpen = true, onClose }) => {
  const { user, logout, apiFetch } = useAuth();
  const urgent = useUrgentWork(apiFetch, Boolean(user));

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white transition-transform duration-300 ease-out lg:inset-y-3 lg:left-3 lg:w-60 lg:translate-x-0 lg:rounded-3xl lg:shadow-sm lg:ring-1 lg:ring-slate-200/70 dark:bg-slate-900 dark:lg:ring-slate-800 ${
        isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
      }`}
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center justify-between px-5">
        <NavLink to="/dashboard" onClick={onClose} aria-label="CyberRange home">
          <Wordmark />
        </NavLink>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 lg:hidden dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pt-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarLink key={item.path} item={item.path === '/assigned-labs' ? { ...item, badge: urgent } : item} onNavigate={onClose} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 px-3 pb-3">
        {FOOTER_ITEMS.map((item) => (
          <SidebarLink key={item.path} item={item} onNavigate={onClose} />
        ))}
      </div>

      <div className="m-2 rounded-2xl bg-slate-50 p-1.5 dark:bg-slate-800/50">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
            {initialsOf(user?.name ?? '')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{user?.name ?? ''}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
