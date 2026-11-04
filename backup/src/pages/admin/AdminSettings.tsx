import { apiFetch as routedApiFetch } from '../../lib/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context';
import { useTheme } from '../../context/ThemeContext';
import {
  Lock,
  MessageSquare,
  History,
  LogOut,
  Save,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  ExternalLink
} from 'lucide-react';
import { FEEDBACK_GOOGLE_FORM_URL, FEEDBACK_FORM_CONFIGURED } from '../../config/feedbackForm';
import { GraphicsSetting } from '../../components/settings/GraphicsSetting';

export const AdminSettings: React.FC = () => {
  const { user, logout } = useAuth();

  // Theme: the same saved preference the rest of the app uses, so the choice shown is
  // the one in force and saving it lasts after a reload.
  const { theme: savedTheme, setTheme: saveTheme } = useTheme();
  const [theme, setTheme] = useState<'light' | 'dark'>(savedTheme);
  useEffect(() => { setTheme(savedTheme); }, [savedTheme]);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Tables & Info states
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Fetch Login History
  const fetchLoginHistory = async () => {
    try {
      const res = await routedApiFetch('/api/v1/reporting/login-history', { headers });
      if (res.ok) {
        setLoginHistory(await res.json());
      }
    } catch (err) {
      console.error('Failed to load login history', err);
    }
  };

  useEffect(() => {
    fetchLoginHistory();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveTheme(theme);
    showToast('Theme preference updated successfully!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.');
      return;
    }

    try {
      const res = await routedApiFetch('/api/v1/reporting/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (res.ok) {
        showToast('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        showToast(data.detail || 'Password change failed.');
      }
    } catch {
      showToast('Password change failed.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200 text-xs text-slate-800 dark:text-slate-200">

      {/* LEFT COLUMN: Profile & Details */}
      <div className="lg:col-span-4 space-y-6">

        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-6 text-center shadow-sm">
          <div className="w-20 h-20 bg-brand-600/10 text-brand-600 dark:text-blue-400 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 border border-brand-600/25">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{user?.name || 'Administrator'}</h2>
          <p className="text-slate-500 font-bold mt-1 text-xs">{user?.role || 'SYSTEM ADMIN'}</p>

          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-left space-y-3 font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Email:</span>
              <span className="text-slate-900 dark:text-slate-200 font-bold">{user?.email || 'admin@cyberrange.io'}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Login:</span>
              <span className="text-slate-900 dark:text-slate-200 font-bold">Today</span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-5 shadow-sm">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/45 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" /> End Admin Session
          </button>
        </div>

      </div>

      {/* RIGHT COLUMN: Settings Forms & Logs */}
      <div className="lg:col-span-8 space-y-6">

        {/* Theme Settings */}
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Monitor className="w-4 h-4 text-brand-600 dark:text-blue-400" />
            Display Theme Preference
          </h3>
          <form onSubmit={handleSaveTheme} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-2">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={theme === t}
                  onClick={() => setTheme(t)}
                  className={`px-4 py-2 border rounded-full font-bold uppercase text-xs cursor-pointer transition-all ${
                    theme === t
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-blue-600 text-white font-bold rounded-full flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save Theme
            </button>
          </form>
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <GraphicsSetting />
          </div>
        </div>

        {/* Change Password Settings */}
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Lock className="w-4 h-4 text-brand-600 dark:text-blue-400" />
            Security & Credentials Update
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-slate-500 block mb-1" htmlFor="admin-current-password">Current Password</label>
                <input
                  id="admin-current-password"
                  autoComplete="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1" htmlFor="admin-new-password">New Password</label>
                <input
                  id="admin-new-password"
                  autoComplete="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1" htmlFor="admin-confirm-password">Confirm New Password</label>
                <input
                  id="admin-confirm-password"
                  autoComplete="new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-brand-600 hover:bg-blue-600 text-white font-bold rounded-full flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Change Password
              </button>
            </div>
          </form>
        </div>

        {/* Feedback Section */}
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <MessageSquare className="w-4 h-4 text-brand-600 dark:text-blue-400" />
            Platform Feedback & Bug Reports
          </h3>
          <p className="text-slate-500">
            Report an issue or share feedback about a Lab, Puzzle, CTF challenge, or anything else on the platform.
          </p>
          {FEEDBACK_FORM_CONFIGURED ? (
            <a
              href={FEEDBACK_GOOGLE_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-brand-600 hover:bg-blue-600 text-white font-bold rounded-full inline-flex items-center gap-2"
            >
              Give Feedback <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <p className="text-xs text-slate-400">The feedback form is not configured yet.</p>
          )}
        </div>

        {/* Login Audit Trail Log */}
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl overflow-hidden shadow-sm space-y-3 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <History className="w-4 h-4 text-brand-600 dark:text-blue-400" />
            Recent Login Audit Log
          </h3>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b text-xs font-bold text-slate-400">
                  <th className="p-3">Date</th>
                  <th className="p-3">Time</th>
                  <th className="p-3">IP Address</th>
                  <th className="p-3">Browser</th>
                  <th className="p-3">Device</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loginHistory.map((h, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="p-3 text-slate-600 dark:text-slate-300">{h.date}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{h.time}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-200">{h.ip_address}</td>
                    <td className="p-3 text-slate-500">{h.browser}</td>
                    <td className="p-3 text-slate-500">{h.device}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold text-xs">
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">End Active Session?</h4>
              <p className="text-slate-500 font-semibold leading-relaxed">
                Are you sure you want to log out and terminate your administrator session?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 border rounded-xl font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-5 z-50">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          {toastMsg}
        </div>
      )}

    </div>
  );
};
