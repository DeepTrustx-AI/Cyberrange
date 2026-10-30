import React, { useState, useEffect, useCallback, useRef, memo, Suspense } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { AmbientBackground } from '../ui/AmbientBackground';
import { MascotLoader } from '../mascot/MascotLoader';
import { prefetchArea } from '../../routes/prefetch';
import { UserSidebar } from './UserSidebar';
import { useAuth } from '../../context';
import { useTheme } from '../../context/ThemeContext';
import { ProductTour } from '../ProductTour';
import { studentTourSteps } from '../../data/tourSteps';
import { useDismiss } from '../../hooks/useDismiss';
import { useScrolled } from '../../hooks/useScrolled';
import { initialsOf } from '../../utils/initials';
import {
  fetchNotifications,
  markNotificationAsRead,
  clearAllNotifications,
  setupNotificationWebSocket,
  type NotificationItem
} from '../../services/notificationService';
import {
  Bell,
  Search,
  Menu,
  User,
  BarChart2,
  Settings,
  Moon,
  Sun,
  ShieldCheck,
  LogOut,
  ChevronDown,
  X,
  BellOff,
} from 'lucide-react';

interface UserLayoutProps {
  children?: React.ReactNode;
}

const menuItemClass =
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';

function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

// OPTIMIZATION 3: React.memo prevents re-render when parent re-renders with same props.
export const UserLayout: React.FC<UserLayoutProps> = memo(({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const scrolled = useScrolled();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const closeNotifications = useCallback(() => setIsNotificationMenuOpen(false), []);
  const closeUserMenu = useCallback(() => setIsUserDropdownOpen(false), []);
  useDismiss(notificationRef, isNotificationMenuOpen, closeNotifications);
  useDismiss(userMenuRef, isUserDropdownOpen, closeUserMenu);

  useEffect(() => {
    if (sessionStorage.getItem('cr_show_tour')) {
      sessionStorage.removeItem('cr_show_tour');
      setShowTour(true);
    }
  }, []);

  // "/" focuses search from anywhere, like most developer tools.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications({ limit: 10 });
      setNotifications(data.items || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      console.error('Failed to load user notifications', e);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const cleanupWs = setupNotificationWebSocket((newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    return () => cleanupWs();
  }, [loadNotifications]);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read) {
      await markNotificationAsRead(item.id);
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setIsNotificationMenuOpen(false);
    if (item.action_url) {
      navigate(item.action_url);
    }
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
    setUnreadCount(0);
    setIsNotificationMenuOpen(false);
  };

  const handleSidebarClose = useCallback(() => setIsSidebarOpen(false), []);

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Warm the other pages in idle time so moving around feels instant.
  useEffect(() => {
    prefetchArea('student');
  }, []);
  const globalSearchQuery = searchParams.get('search') || searchParams.get('q') || '';

  const handleGlobalSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (location.pathname !== '/labs') {
      if (val.trim()) {
        navigate(`/labs?search=${encodeURIComponent(val)}`);
      } else {
        navigate('/labs');
      }
    } else {
      if (val.trim()) {
        setSearchParams({ search: val });
      } else {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('search');
        newParams.delete('q');
        setSearchParams(newParams);
      }
    }
  };

  const clearSearch = () => {
    if (location.pathname === '/labs') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('search');
      newParams.delete('q');
      setSearchParams(newParams);
    } else {
      navigate('/labs');
    }
  };

  const go = (path: string) => {
    setIsUserDropdownOpen(false);
    navigate(path);
  };

  return (
    <div className="isolate flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AmbientBackground />
      <UserSidebar isOpen={isSidebarOpen} onClose={handleSidebarClose} />

      {isSidebarOpen && (
        <div
          onClick={handleSidebarClose}
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[16.5rem]">
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-6">
          {/* Clear at the top of the page, so the background flows behind the search bar.
              Once content scrolls under it, a frosted band fades in across the full width
              (behind the sidebar too) and fades out at its bottom edge, so it never reads
              as a box. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 left-0 right-0 -z-10 bg-slate-100/75 backdrop-blur-md transition-opacity duration-300 [mask-image:linear-gradient(to_bottom,black_65%,transparent)] lg:-left-[16.5rem] dark:bg-slate-950/75 ${scrolled ? 'opacity-100' : 'opacity-0'}`}
          />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative hidden w-full max-w-sm md:block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Search labs and challenges"
                aria-label="Search labs and challenges"
                value={globalSearchQuery}
                onChange={handleGlobalSearchChange}
                className="h-10 w-full rounded-full border border-transparent bg-white pl-10 pr-10 text-sm text-slate-900 shadow-xs transition-colors focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-white [&::-webkit-search-cancel-button]:hidden"
              />
              {globalSearchQuery ? (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-xs leading-5 text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                  /
                </kbd>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => toggleTheme()}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setIsNotificationMenuOpen(!isNotificationMenuOpen);
                  setIsUserDropdownOpen(false);
                }}
                className="relative rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                aria-expanded={isNotificationMenuOpen}
              >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white ring-2 ring-slate-100 tabular dark:ring-slate-950">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationMenuOpen && (
                <div className="rise-in absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                        <BellOff className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">You're all caught up.</p>
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className="flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? 'bg-transparent' : 'bg-brand-500'}`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium text-slate-900 dark:text-white">{item.title}</span>
                            <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.message}</span>
                            <span className="mt-1 block text-xs text-slate-400">{timeAgo(item.created_at)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <Link
                    to="/notifications"
                    onClick={closeNotifications}
                    className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:text-brand-400 dark:hover:bg-slate-800/50"
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>

            <div className="relative ml-1.5 border-l border-slate-200 pl-3 dark:border-slate-800" ref={userMenuRef}>
              <button
                onClick={() => {
                  setIsUserDropdownOpen(!isUserDropdownOpen);
                  setIsNotificationMenuOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-lg p-1 pr-1.5 transition-colors hover:bg-slate-200/60 dark:hover:bg-slate-800"
                aria-label="Account menu"
                aria-expanded={isUserDropdownOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {initialsOf(user?.name ?? '')}
                </span>
                <span className="hidden flex-col text-left md:flex">
                  <span className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-white">{user?.name ?? ''}</span>
                  <span className="text-xs capitalize leading-tight text-slate-500 dark:text-slate-400">
                    {(user?.account_type || 'student').toLowerCase()}
                  </span>
                </span>
                <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
              </button>

              {isUserDropdownOpen && (
                <div className="rise-in absolute right-0 z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="px-2.5 pb-2 pt-1.5">
                    <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{user?.name ?? ''}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email ?? ''}</p>
                  </div>
                  <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                  <button onClick={() => go('/profile')} className={menuItemClass}>
                    <User className="h-4 w-4 text-slate-400" />
                    Profile
                  </button>
                  <button onClick={() => go('/statistics')} className={menuItemClass}>
                    <BarChart2 className="h-4 w-4 text-slate-400" />
                    Statistics
                  </button>
                  <button onClick={() => go('/settings')} className={menuItemClass}>
                    <Settings className="h-4 w-4 text-slate-400" />
                    Settings
                  </button>
                  <button onClick={() => go('/settings?tab=security')} className={menuItemClass}>
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                    Security
                  </button>
                  <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                  <button
                    onClick={() => { setIsUserDropdownOpen(false); logout(); }}
                    className={`${menuItemClass} text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40`}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-8 pt-2 sm:px-6 lg:px-6">
          {/* Each page gets its own loading boundary, so the layout stays put
              while a page's code downloads and the new page settles in. */}
          <div key={location.pathname} className="page-in">
            <Suspense fallback={<MascotLoader />}>{children}</Suspense>
          </div>
        </main>

        <footer className="mt-auto px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-6 dark:text-slate-400">
          <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-2 sm:flex-row">
            <span>© 2026 CyberRange</span>
            <div className="flex items-center gap-5">
              <a href="#privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</a>
              <a href="#terms" className="hover:text-slate-900 dark:hover:text-white">Terms</a>
            </div>
          </div>
        </footer>
      </div>
      {showTour && <ProductTour steps={studentTourSteps} onClose={() => setShowTour(false)} />}
    </div>
  );
});

UserLayout.displayName = 'UserLayout';
