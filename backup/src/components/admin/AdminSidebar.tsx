import React from 'react';
import { NavLink } from 'react-router-dom';
import { prefetchRoute } from '../../routes/prefetch';
import { useAuth } from '../../context';
import { LogoMark } from '../brand/LogoMark';
import {
  BookOpen,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Settings,
  Store,
  Trophy,
  Users,
  ClipboardCheck,
} from 'lucide-react';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type NavItem = {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  capability: string;
};

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen = true, onClose }) => {
  const { user, logout, authorization, hasCapability } = useAuth();

  const getInitials = (name: string) => !name
    ? 'AD'
    : name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);

  const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, capability: 'DASHBOARD_VIEW' },
    { name: 'Lab Marketplace', path: '/admin/labs', icon: Store, capability: 'LAB_PURCHASE' },
    { name: 'Student Management', path: '/admin/users', icon: Users, capability: 'ROSTER_MANAGE' },
    { name: 'Gradebook', path: '/admin/gradebook', icon: ClipboardCheck, capability: 'GRADE_VIEW' },
    { name: 'Reports', path: '/admin/reports', icon: CreditCard, capability: 'REPORT_VIEW' },
    { name: 'Study Material', path: '/admin/study-material', icon: BookOpen, capability: 'CONTENT_MANAGE' },
    { name: 'CTF Manager', path: '/admin/ctf', icon: Trophy, capability: 'CTF_MANAGE' },
    { name: 'Settings', path: '/admin/settings', icon: Settings, capability: 'DASHBOARD_VIEW' },
  ];

  const visibleItems = navItems.filter((item) => hasCapability(item.capability));
  const roles = authorization?.roles || [];
  const isProfessor = roles.includes('PROFESSOR') && !roles.includes('ADMIN') && !roles.includes('SYSTEM_ADMIN');

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col justify-between bg-white transition-transform duration-300 ease-out lg:inset-y-3 lg:left-3 lg:w-60 lg:translate-x-0 lg:rounded-3xl lg:shadow-sm lg:ring-1 lg:ring-slate-200/70 dark:bg-slate-900 dark:lg:ring-slate-800 ${isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}>
      <div>
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <LogoMark size={28} />
            <div>
              <p className="font-display text-[17px] font-bold leading-none text-slate-900 dark:text-white">CyberRange</p>
              <span className="mt-1 inline-block text-xs font-medium text-slate-500 dark:text-slate-400">
                {isProfessor ? 'Professor Console' : 'Admin Console'}
              </span>
            </div>
          </div>
        </div>

        <nav className="max-h-[calc(100vh-170px)] space-y-0.5 overflow-y-auto px-3 pt-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                className={({ isActive }) =>
                  `group flex items-center justify-between rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-100 text-brand-900 dark:bg-brand-500/15 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.name}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 dark:text-slate-500" />
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="m-2 rounded-2xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <NavLink to="/admin/profile" className="flex items-center gap-3 font-medium hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {getInitials(user?.name || 'Admin Lead')}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user?.name || 'Admin Lead'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email || 'admin@cyberrange.in'}</p>
            </div>
          </NavLink>
          <button onClick={logout} title="Log out" className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
