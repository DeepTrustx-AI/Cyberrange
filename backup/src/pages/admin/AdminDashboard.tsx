import { apiFetch as routedApiFetch, isUnconfiguredOrgName } from '../../lib/api';
import React, { useState, useEffect } from 'react';
import {
  Users,
  FlaskConical,
  UsersRound,
  UserPlus,
  Store,
  Clock,
  BookOpen,
  Award,
  Check,
  AlertCircle
} from 'lucide-react';
import { LabArtImage } from '../../components/art/LabArtImage';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context';
import { accessDeniedReason } from '../../utils/accessDenied';
import { AccessDeniedNotice } from '../../components/admin/AccessDeniedNotice';

export const AdminDashboard: React.FC = () => {
  const { user, authorization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);

  // Profile-incomplete banner: mandatory until the admin replaces their
  // placeholder organization name with a real one, or adds a verified
  // college affiliation instead, via "Update Profile" (deferred from the
  // minimal signup form — also covers first-time Google sign-in admins, who
  // land in the same unconfigured state). Not dismissible — checked against
  // real account state, so it disappears on its own once the admin actually
  // finishes either path. authorization.roles is only populated from a real,
  // non-bootstrap RBAC binding (see authorization_service.py), so a
  // non-empty value here means some path - college or organization - has
  // already unblocked the account, regardless of what the org name field
  // still says.
  const [showProfileBanner, setShowProfileBanner] = useState(false);
  const isUnblockedElsewhere = (authorization?.roles?.length ?? 0) > 0;

  useEffect(() => {
    if (!user) return;
    if (isUnblockedElsewhere) {
      setShowProfileBanner(false);
      return;
    }
    const token = localStorage.getItem('token');
    routedApiFetch('/api/v1/admin/profile', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setShowProfileBanner(isUnconfiguredOrgName(data.organization_info?.name));
      })
      .catch((err) => console.error('Error checking admin profile status:', err));
  }, [user, isUnblockedElsewhere]);
  const [summaryData, setSummaryData] = useState<any>({
    databaseConnected: false,
    purchasedLabs: {
      total: 0,
      totalSeats: 0,
      seatsUsed: 0,
      seatsRemaining: 0,
      utilizationPercentage: 0
    },
    students: {
      total: 0,
      active: 0,
      inactive: 0
    },
    groups: {
      total: 0,
      withActive: 0,
      empty: 0
    },
    assignments: {
      total: 0,
      running: 0,
      scheduled: 0,
      completed: 0,
      expired: 0
    }
  });

  useEffect(() => {
    const fetchDashboardSummary = async () => {
      const token = localStorage.getItem('token');
      try {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await routedApiFetch('/api/v1/admin/dashboard/summary', { headers });
        setAccessDenied(await accessDeniedReason(res));

        if (res.ok) {
          const data = await res.json();
          setSummaryData(data);
        }
      } catch (err) {
        console.error('Error fetching dashboard summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardSummary();
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-slate-400 font-medium">Loading summary details...</div>;
  }

  if (accessDenied) {
    return <AccessDeniedNotice reason={accessDenied} />;
  }

  const isDbConnected = summaryData.databaseConnected;

  return (
    <div className="space-y-8 animate-in fade-in duration-200 text-xs">
      {/* Profile Completion Banner for new Google sign-in admins */}
      {showProfileBanner && (
        <div className="flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3.5 ring-1 ring-brand-200/60 dark:bg-brand-500/10 dark:ring-brand-500/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-slate-900 dark:text-white">Complete your profile to connect with students</p>
            <p className="mt-0.5 text-slate-600 dark:text-slate-300">Add your organisation details so you can start assigning labs.</p>
          </div>
          <Link
            to="/admin/profile"
            className="shrink-0 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Update profile
          </Link>
        </div>
      )}
      <section className="range-wash relative overflow-hidden rounded-[2rem] ring-1 ring-slate-900/5 dark:ring-white/5">
        <div className="relative z-10 max-w-xl p-6 sm:p-10">
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            Your command centre
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            Track cohort progress, manage lab seats, buy curriculum modules and follow learning outcomes.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/labs"
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700"
            >
              <Store className="h-4 w-4" />
              Browse lab marketplace
            </Link>
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 rounded-full bg-white/80 px-5 py-2.5 text-sm font-medium text-slate-800 ring-1 ring-slate-900/10 transition-colors hover:bg-white dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/10"
            >
              <UserPlus className="h-4 w-4" />
              Manage students and groups
            </Link>
          </div>
        </div>
        <div className="pointer-events-none flex justify-center pb-4 lg:absolute lg:inset-y-0 lg:right-8 lg:items-center lg:pb-0">
          <LabArtImage kind="shield" className="h-48 w-72 lg:h-64 lg:w-96" />
        </div>
      </section>

      {/* 2. LIVE DATABASE COUNTS OVERVIEW */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Overview
          </h2>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            isDbConnected
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isDbConnected ? 'bg-emerald-500' : 'bg-brand-500'}`} />
            {isDbConnected ? 'Database connected' : 'Database offline'}
          </span>
        </div>

        <dl className="grid grid-cols-2 divide-slate-200 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 lg:grid-cols-4 lg:divide-x dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
          {[
            { label: 'Purchased labs', value: summaryData.purchasedLabs.total, note: `${summaryData.purchasedLabs.seatsRemaining} seats available`, icon: FlaskConical },
            { label: 'Students', value: summaryData.students.total, note: `${summaryData.students.active} active`, icon: Users },
            { label: 'Groups', value: summaryData.groups.total, note: `${summaryData.groups.withActive} with active work`, icon: UsersRound },
            { label: 'Assignments', value: summaryData.assignments.total, note: `${summaryData.assignments.running} running · ${summaryData.assignments.completed} completed`, icon: Clock },
          ].map((stat) => (
            <div key={stat.label} className="px-5 py-5 sm:px-6">
              <dt className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <stat.icon className="h-4 w-4" /> {stat.label}
              </dt>
              <dd className="mt-2 font-display text-3xl font-bold tabular text-slate-900 dark:text-white">{stat.value}</dd>
              <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.note}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 3. ABOUT CYBERRANGE PLATFORM SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            About CyberRange Platform
          </h3>
          <p className="mt-2 max-w-3xl leading-relaxed text-slate-600 dark:text-slate-300">
            CyberRange is an enterprise cybersecurity learning platform designed for universities, engineering colleges, training institutes, and organizations.
            The platform enables educators to purchase cybersecurity labs, manage students and groups, assign labs, monitor learning progress, generate analytics, and export detailed reports from a centralized dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800 pt-6">
          {/* What Professors Can Do Card */}
          <div className="p-5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800/60 rounded-xl space-y-3">
            <h4 className="text-sm font-semibold text-brand-600 dark:text-blue-400 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> What Professors Can Do
            </h4>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-brand-600" /> Purchase cybersecurity labs</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-brand-600" /> Manage students</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-brand-600" /> Create groups</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-brand-600" /> Assign labs</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-brand-600" /> Track student progress</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-brand-600" /> View analytics</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-brand-600" /> Export reports</li>
            </ul>
          </div>

          {/* What Students Experience Card */}
          <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/60 rounded-xl space-y-3">
            <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Award className="w-4 h-4" /> What Students Experience
            </h4>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Access assigned labs</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Perform practical exercises</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Submit flags</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Track progress</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> View scores</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
