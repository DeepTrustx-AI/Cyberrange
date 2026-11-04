import { apiFetch as routedApiFetch } from '../../lib/api';
import React, { useState, useEffect, useRef, useCallback, memo, Suspense } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AmbientBackground } from '../ui/AmbientBackground';
import { MascotLoader } from '../mascot/MascotLoader';
import { prefetchArea } from '../../routes/prefetch';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../context';
import { useTheme } from '../../context/ThemeContext';
import { ProductTour } from '../ProductTour';
import { adminTourSteps } from '../../data/tourSteps';
import { adminPageTitle } from '../../utils/adminPageTitles';
import { useScrolled } from '../../hooks/useScrolled';
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
  HelpCircle,
  ChevronDown,
  User as UserIcon,
  Sun,
  Moon,
  Settings,
  LogOut
} from 'lucide-react';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

// OPTIMIZATION 3: React.memo prevents re-render when parent re-renders with same props.
// The children prop changes only on actual route navigation — this is the desired behavior.
export const AdminLayout: React.FC<AdminLayoutProps> = memo(({ children }) => {
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('cr_show_tour')) {
      sessionStorage.removeItem('cr_show_tour');
      setShowTour(true);
    }
  }, []);

  // useCallback: stable reference — avoids re-creating on every render
  const getInitials = useCallback((name: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  // useCallback: stable handler passed to AdminSidebar — prevents sidebar re-render
  const handleSidebarClose = useCallback(() => setIsSidebarOpen(false), []);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications({ limit: 10 });
      setNotifications(data.items || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      console.error('Failed to load notifications', e);
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

  const location = useLocation();

  // Warm the other pages in idle time so moving around feels instant.
  useEffect(() => {
    prefetchArea('admin');
  }, []);
  const searchRef = useRef<HTMLDivElement>(null);

  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Close popup on route location change
  useEffect(() => {
    setIsSearchOpen(false);
    setSearchResults([]);
  }, [location.pathname]);

  // Outside click & Escape key listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      } else if (e.key === 'ArrowDown' && isSearchOpen && searchResults.length > 0) {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % searchResults.length);
      } else if (e.key === 'ArrowUp' && isSearchOpen && searchResults.length > 0) {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
      } else if (e.key === 'Enter' && isSearchOpen && searchResults[selectedIndex]) {
        e.preventDefault();
        setIsSearchOpen(false);
        navigate(searchResults[selectedIndex].link);
      } else if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Debounced API Search execution (350ms delay)
  useEffect(() => {
    const val = adminSearchQuery.trim();
    if (val.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setIsSearchOpen(true);

    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await routedApiFetch(`/api/v1/admin/global-search?q=${encodeURIComponent(val)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSearchResults(data);
          }
        }
      } catch (err) {
        console.error('Error executing global search:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [adminSearchQuery]);

  // Helper to highlight matching query text
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 font-bold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div className="isolate flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">
      <AmbientBackground />
      {/* Sidebar Navigation */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
      />

      {/* Backdrop for Mobile Sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Main Execution Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[16.5rem]">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between px-4 sm:px-6">
          {/* Clear at the top of the page, so the background flows behind the search bar.
              Once content scrolls under it, a frosted band fades in across the full width
              (behind the sidebar too) and fades out at its bottom edge, so it never reads
              as a box. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 left-0 right-0 -z-10 bg-slate-100/75 backdrop-blur-md transition-opacity duration-300 [mask-image:linear-gradient(to_bottom,black_65%,transparent)] lg:-left-[16.5rem] dark:bg-slate-950/75 ${scrolled ? 'opacity-100' : 'opacity-0'}`}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Global Search Bar with Debounced Popup */}
            <div ref={searchRef} className="relative hidden md:block w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Global search (Ctrl + K)..."
                value={adminSearchQuery}
                onFocus={() => {
                  if (adminSearchQuery.trim().length >= 2) setIsSearchOpen(true);
                }}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                className="h-10 w-full rounded-full border border-transparent bg-white pl-10 pr-12 text-sm text-slate-900 shadow-xs transition-colors placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-xs leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                ⌘K
              </kbd>

              {/* Categorized Dropdown Results & States */}
              {isSearchOpen && adminSearchQuery.trim().length >= 2 && (
                <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-2 z-50 animate-in fade-in duration-150 max-h-96 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      Searching platform records...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400 font-semibold">
                      No platform results matching "{adminSearchQuery}"
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-1 text-xs font-semibold text-slate-400">
                        Categorized Platform Matches
                      </div>
                      {searchResults.map((item, idx) => (
                        <div
                          key={`${item.category}-${item.id}-${idx}`}
                          onClick={() => {
                            setIsSearchOpen(false);
                            navigate(item.link);
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                            idx === selectedIndex
                              ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {renderHighlightedText(item.title, adminSearchQuery)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {renderHighlightedText(item.subtitle, adminSearchQuery)}
                            </p>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-brand-600 border border-blue-200 dark:border-blue-800 flex-shrink-0 ml-2">
                            {item.category}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">

            {/* Documentation Quick Link */}
            <Link
              to="/help"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:block"
              title="Documentation & Guide"
            >
              <HelpCircle className="w-5 h-5" />
            </Link>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationMenuOpen(!isNotificationMenuOpen)}
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-4 px-1 bg-brand-600 text-white text-[10px] font-semibold tabular ring-2 ring-slate-100 dark:ring-slate-950 rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationMenuOpen && (
                <div className="absolute right-0 mt-2 w-88 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Admin Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-xs text-brand-600 hover:underline font-bold cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-400 font-medium">
                        No active notifications.
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${!item.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</p>
                            {!item.read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1"></span>}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">{item.message}</p>
                          <span className="text-xs text-slate-400 mt-1.5 inline-block font-medium">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2 text-center border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => {
                        setIsNotificationMenuOpen(false);
                        navigate('/admin/notifications');
                      }}
                      className="text-xs font-bold text-brand-600 hover:underline cursor-pointer w-full text-center block"
                    >
                      View all alerts
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar & Dropdown */}
            <div className="relative border-l border-slate-200 dark:border-slate-700 pl-3 sm:pl-4">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {getInitials(user?.name || 'Security Admin')}
                </div>
                <span className="hidden md:inline-block font-semibold text-sm text-slate-900 dark:text-white">
                  {user?.name || 'Security Admin'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-2 z-50 animate-in fade-in duration-150">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{user?.name || 'Admin Lead'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300 truncate">{user?.email || 'admin@cyberrange.in'}</p>
                    <span className="inline-block mt-1 text-xs font-bold text-brand-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                      System Administrator
                    </span>
                  </div>

                  <div className="py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <button
                       onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/profile'); }}
                       className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>My Profile</span>
                    </button>



                    {/* Single Clean Theme Toggle Action */}
                    <button
                      onClick={async () => {
                        await toggleTheme();
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span>Toggle Light Mode</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 text-indigo-500" />
                          <span>Toggle Dark Mode</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/settings'); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Settings</span>
                    </button>

                    <button
                      onClick={logout}
                      className="w-full px-4 py-2.5 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body Container */}
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-8 pt-2 sm:px-6">
          {(() => {
            const page = adminPageTitle(location.pathname);
            return page ? (
              <header className="mb-6">
                <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">{page.title}</h1>
                <p className="mt-2 max-w-2xl text-[15px] text-slate-500 dark:text-slate-400">{page.description}</p>
              </header>
            ) : null;
          })()}
          {/* Each page gets its own loading boundary, so the layout stays put
              while a page's code downloads and the new page settles in. */}
          <div key={location.pathname} className="page-in">
            <Suspense fallback={<MascotLoader />}>{children}</Suspense>
          </div>
        </main>

        {/* Admin Footer */}
        <footer className="mt-auto px-4 py-5 text-xs text-slate-500 sm:px-6 dark:text-slate-400">
          <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-2 sm:flex-row">
            <span>© 2026 CyberRange</span>
          </div>
        </footer>
      </div>
      {showTour && <ProductTour steps={adminTourSteps} onClose={() => setShowTour(false)} />}
    </div>
  );
});

AdminLayout.displayName = 'AdminLayout';
