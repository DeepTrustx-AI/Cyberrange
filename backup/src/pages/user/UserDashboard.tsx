import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context';
import { useTheme } from '../../context/ThemeContext';
import { SegmentedBar } from '../../components/ui/SegmentedBar';
import { categoryMeta } from '../../utils/labMeta';
import { assignmentLabPath, labPath } from '../../utils/labRoutes';
import { labHours } from '../../utils/labCopy';
import { assignmentState, sortByUrgency } from '../../utils/assignmentState';
import { DueNextCard } from '../../components/assignments/DueNextCard';
import { timingOf, type Assignment } from '../../components/assignments/assignment';
import { useCountUp } from '../../hooks/useCountUp';
import { LabArtImage } from '../../components/art/LabArtImage';
import { labArtKind } from '../../utils/labArtKind';
import { useToday } from '../../hooks/useToday';
import { ActivityFeed, SkillsCard, TodayStrip, type SkillArea } from '../../components/dashboard/TodayPanels';
import { BadgeShelf, CubeStage } from '../../components/dashboard/GamePanels';
import { computeGame, useFreshBlocks, useNewBadges } from '../../utils/progressGame';
import { CUBE_BLOCKS } from '../../components/three/clay';
import {
  ArrowRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  Flame,
  Play,
  Trophy,
  Target,
} from 'lucide-react';

interface TrainingLab {
  id: string;
  title: string;
  category: string;
  status: 'live' | 'upcoming' | 'completed';
  description?: string;
  totalChallenges: number;
  solvedChallenges: number;
  durationHours: number;
}

interface DashboardData {
  user?: { name?: string | null } | null;
  statistics?: {
    total_score?: number | null;
    rank?: number | null;
    total_users?: number | null;
    completed_labs?: number | null;
    assigned_labs?: number | null;
    completion_percentage?: number | null;
  } | null;
  assigned_labs?: Array<{
    id?: string | null;
    title?: string | null;
    category?: string | null;
    description?: string | null;
    status?: 'live' | 'upcoming' | 'completed' | null;
    total_challenges?: number | null;
    solved_challenges?: number | null;
    duration_hours?: number | null;
    tags?: string[] | null;
  }> | null;
}

const PLATFORM_AREAS = [
  { title: 'Hands-on labs', points: ['Real-world cybersecurity scenarios', 'Guided practical exercises'] },
  { title: 'OT / ICS security', points: ['Industrial control systems', 'SCADA environments', 'PLC simulations'] },
  { title: 'CTF and puzzle challenges', points: ['Skill-based exercises', 'Flag submissions', 'Progressive difficulty'] },
  { title: 'Progress tracking', points: ['Scores', 'Badges', 'Achievements', 'Leaderboards'] },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function progressOf(lab: TrainingLab) {
  return lab.totalChallenges > 0 ? lab.solvedChallenges / lab.totalChallenges : lab.status === 'completed' ? 1 : 0;
}

function pickNextLab(labs: TrainingLab[]) {
  const open = labs.filter((lab) => lab.status !== 'completed' && progressOf(lab) < 1);
  return open.find((lab) => lab.solvedChallenges > 0) ?? open.find((lab) => lab.status === 'live') ?? open[0] ?? null;
}

function StatusPill({ lab }: { lab: TrainingLab }) {
  const progress = progressOf(lab);
  if (progress >= 1 || lab.status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Complete
      </span>
    );
  }
  if (lab.status === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
        <Clock className="h-3 w-3" /> Upcoming
      </span>
    );
  }
  if (progress > 0) {
    return (
      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        In progress
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      Not started
    </span>
  );
}

function NextLabCard({ lab, onOpen, onAll }: { lab: TrainingLab; onOpen: () => void; onAll: () => void }) {
  const meta = categoryMeta(lab.category);
  const started = lab.solvedChallenges > 0;
  return (
    <div className="rounded-2xl bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 backdrop-blur-sm dark:bg-slate-900/85 dark:ring-white/10">
      <div className="flex items-start gap-3">
        <span className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 dark:bg-brand-500/10">
          <LabArtImage kind={labArtKind(lab.id, lab.category)} className="h-14 w-20 max-w-none" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-semibold text-slate-900 dark:text-white">{lab.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {meta.label}
            {lab.durationHours > 0 && ` · about ${lab.durationHours} h`}
          </p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <SegmentedBar done={lab.solvedChallenges} total={lab.totalChallenges} className="max-w-sm" />
        <span className="shrink-0 text-xs tabular text-slate-500 dark:text-slate-400">
          {lab.solvedChallenges}/{lab.totalChallenges} modules
        </span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700"
        >
          <Play className="h-4 w-4 fill-current" />
          {started ? 'Resume lab' : 'Start lab'}
        </button>
        <button
          onClick={onAll}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          All assignments
        </button>
      </div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, prefix = '', unit }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  prefix?: string;
  unit?: string;
}) {
  const shown = useCountUp(value ?? 0);
  return (
    <div className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-slate-900/5 backdrop-blur-sm dark:bg-slate-900/60 dark:ring-white/10">
      <p className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold tabular text-slate-900 dark:text-white">
          {value === null ? '–' : `${prefix}${shown.toLocaleString()}`}
        </span>
        {unit && <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}

// The labs graded on a separate machine (Linux sysadmin, workshop, race).
const GRADER_LABS = ['linux-sysadmin-lab', 'linux-security-workshop', 'race-conditions-lab'];

export const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();
  const { theme } = useTheme();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [labs, setLabs] = useState<TrainingLab[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadedOk, setLoadedOk] = useState(false);

  // Profile-incomplete banner: mandatory until the student adds their college,
  // department and roll number via "Update Profile" (deferred from the
  // minimal signup form). Not dismissible — it tracks user.profile_completed
  // directly and disappears on its own once the profile is actually finished.
  // Mirrors the same pattern on AdminDashboard.
  // Read straight from the signed-in user, so the banner is there on the first paint
  // instead of appearing a moment later and pushing the page down.
  const showProfileBanner = user?.profile_completed === false;

  useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      try {
        const response = await apiFetch('/api/v1/user/dashboard');
        if (!response.ok || cancelled) return;
        const data: DashboardData = await response.json();
        if (cancelled) return;
        setDashboard(data);
        setLoadedOk(true);
        setLabs((data.assigned_labs ?? [])
          .filter((lab) => lab.id !== 'puzzle-lab' && lab.id !== 'puzzle')
          .map((lab) => ({
            id: lab.id ?? '',
            title: lab.title ?? '',
            category: lab.category ?? '',
            status: lab.status ?? 'live',
            description: lab.description ?? '',
            totalChallenges: lab.total_challenges ?? 0,
            solvedChallenges: lab.solved_challenges ?? 0,
            durationHours: labHours(lab.id ?? '', lab.duration_hours ?? 0),
          })));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load dashboard data:', error);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    loadDashboard();
    return () => { cancelled = true; };
  // apiFetch is stable (useCallback in AuthContext)
  }, [apiFetch]);

  const statistics = dashboard?.statistics;
  const name = dashboard?.user?.name ?? user?.name ?? '';
  const firstName = name.split(' ')[0];
  const nextLab = useMemo(() => pickNextLab(labs), [labs]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/v1/user/assignments')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (!cancelled && Array.isArray(data)) setAssignments(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiFetch]);
  // Set work with a deadline comes first; the next lab is the fallback.
  const { dueNext, dueOthers, dueNow } = useMemo(() => {
    const at = new Date();
    const open = sortByUrgency(assignments.map((item) => ({ ...item, ...timingOf(item) })), at)
      .filter((item) => !['done', 'opens', 'closed'].includes(assignmentState(item, at)));
    return { dueNext: open[0] ?? null, dueOthers: Math.max(0, open.length - 1), dueNow: at };
  }, [assignments]);
  const completedCount = labs.filter((lab) => progressOf(lab) >= 1).length;
  const today = useToday(apiFetch);

  // Grader-backed labs: the server counts a passed challenge only inside an assignment,
  // and the submissions read here are only the latest ones, so each lab takes the higher.
  const graderCleared = GRADER_LABS.reduce((sum, id) => {
    const lab = labs.find((row) => row.id === id);
    const server = lab ? Math.min(lab.solvedChallenges, lab.totalChallenges) : 0;
    return sum + Math.max(server, today.passedByCourse[id] ?? 0);
  }, 0);

  const skillAreas = useMemo<SkillArea[]>(() => {
    const byArea = new Map<string, SkillArea>();
    labs.filter((lab) => !today.graderTotal || !GRADER_LABS.includes(lab.id)).forEach((lab) => {
      const key = categoryMeta(lab.category).label;
      const area = byArea.get(key) ?? { category: lab.category, done: 0, total: 0 };
      area.done += Math.min(lab.solvedChallenges, lab.totalChallenges);
      area.total += lab.totalChallenges;
      byArea.set(key, area);
    });
    // Graded Linux challenges (sysadmin, workshop, race) count toward Linux.
    if (today.graderTotal > 0) {
      const key = categoryMeta('linux').label;
      const area = byArea.get(key) ?? { category: 'linux', done: 0, total: 0 };
      area.done += graderCleared;
      area.total += today.graderTotal;
      byArea.set(key, area);
    }
    return [...byArea.values()].filter((area) => area.total > 0).sort((a, b) => b.done / b.total - a.done / a.total);
  }, [labs, today.graderTotal, graderCleared]);
  const hasScore = (statistics?.total_score ?? 0) > 0;

  const cleared = labs
    .filter((lab) => !GRADER_LABS.includes(lab.id))
    .reduce((sum, lab) => sum + Math.min(lab.solvedChallenges, lab.totalChallenges), 0) + graderCleared;
  const game = computeGame({
    cleared,
    completedLabs: completedCount,
    streak: today.streak,
    firstTryPasses: today.firstTryPasses,
    areasStarted: skillAreas.filter((area) => area.done > 0).length + (graderCleared > 0 && !skillAreas.some((a) => a.done > 0 && categoryMeta(a.category).label === 'Linux') ? 1 : 0),
  });
  const ready = loaded && today.loaded;
  // Only counts that really loaded are compared with the last visit; a failed
  // load would otherwise read as zero blocks and replay them all next time.
  const countsTrusted = ready && loadedOk;
  const freshBlocks = useFreshBlocks(cleared, countsTrusted);
  // The new blocks finished a cube since the last visit: a level up to celebrate.
  // In development, /dashboard?preview=levelup shows the sequence on demand.
  const blocksBefore = cleared - freshBlocks;
  const crossedLevel = freshBlocks > 0 && Math.floor(blocksBefore / CUBE_BLOCKS) < Math.floor(cleared / CUBE_BLOCKS);
  const previewLevelUp = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'levelup';
  const levelUp = previewLevelUp ? { previous: 22 } : crossedLevel ? { previous: blocksBefore % CUBE_BLOCKS } : null;
  const newBadges = useNewBadges(game.badges, countsTrusted);


  const workspaceLabel = user?.auth_type === 'SSO'
    ? `${user?.email ? user.email.split('@')[1] : 'Institution'} academic workspace`
    : 'Personal learning account';


  return (
    <div className="space-y-6">
      {showProfileBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">Complete your profile</p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-200/80">
              Add your college, department and roll number so instructors can find and assign labs to you.
            </p>
          </div>
          <Link
            to="/onboarding"
            className="shrink-0 rounded-md bg-amber-900/5 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-900/10 dark:bg-amber-100/10 dark:text-amber-100 dark:hover:bg-amber-100/15"
          >
            Update profile
          </Link>
        </div>
      )}

      <section className="range-wash relative overflow-hidden rounded-[2rem] ring-1 ring-slate-900/5 dark:ring-white/5">
        <div className="relative z-10 flex flex-col gap-8 p-6 sm:p-10 lg:w-[46%] lg:min-h-[32rem] lg:justify-between">
          <div className="rise-in">
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              {greeting()}{firstName ? ',' : ''}
              {firstName && <><br /><span className="hero-mark -mx-1 px-1 dark:bg-none dark:text-brand-400">{firstName}.</span></>}
            </h1>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
              {labs.length === 0
                ? 'Your range is ready for its first lab.'
                : `${completedCount} of ${labs.length} assigned labs complete. Every module you clear adds a block to your cube.`}
              {user?.auth_type === 'SSO' && <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{workspaceLabel}</span>}
            </p>
          </div>

          <div className="rise-in" style={{ animationDelay: '120ms' }}>
            {dueNext ? (
              <DueNextCard
                item={dueNext}
                others={dueOthers}
                now={dueNow}
                onOpen={() => navigate(assignmentLabPath(dueNext.lab_id, dueNext.id))}
                onAll={() => navigate('/assigned-labs')}
              />
            ) : nextLab ? (
              <NextLabCard
                lab={nextLab}
                onOpen={() => navigate(labPath(nextLab.id))}
                onAll={() => navigate('/assigned-labs')}
              />
            ) : loaded ? (
              <div className="rounded-2xl bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 dark:bg-slate-900/85 dark:ring-white/10">
                <p className="font-medium text-slate-900 dark:text-white">
                  {labs.length > 0 ? 'Every assigned lab is complete.' : 'No labs assigned yet.'}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {labs.length > 0
                    ? 'Browse the catalogue for your next challenge.'
                    : 'Your instructor will assign labs here. Meanwhile, explore the catalogue.'}
                </p>
                <button
                  onClick={() => navigate('/labs')}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Browse labs <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="skeleton h-48 rounded-2xl" />
            )}
          </div>

          <div className="rise-in grid grid-cols-1 gap-2.5 sm:grid-cols-3" style={{ animationDelay: '240ms' }}>
            <StatChip icon={Target} label="Modules cleared" value={cleared} />
            {hasScore ? (
              <StatChip
                icon={Trophy}
                label="Global rank"
                value={statistics?.rank ?? null}
                prefix="#"
                unit={statistics?.total_users ? `of ${statistics.total_users.toLocaleString()}` : undefined}
              />
            ) : (
              <StatChip icon={Flame} label="Streak" value={today.streak} unit={today.streak === 1 ? 'day' : 'days'} />
            )}
            <StatChip icon={CheckCircle2} label="Labs complete" value={completedCount} unit={`of ${labs.length}`} />
          </div>
        </div>

        <div className="relative h-[26rem] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[54%]">
          <CubeStage game={game} fresh={freshBlocks} dark={theme === 'dark'} ready={ready} levelUp={levelUp} />
        </div>
      </section>

      <TodayStrip today={today} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="rounded-3xl ring-1 ring-slate-200/70 bg-white shadow-sm dark:ring-slate-800 dark:bg-slate-900">
          <header className="flex items-center justify-between px-5 py-4 sm:px-6">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">Assigned labs</h2>
            <Link to="/assigned-labs" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
              View all
            </Link>
          </header>
          {labs.length === 0 ? (
            <div className="border-t border-slate-100 px-6 py-8 dark:border-slate-800">
              {loaded ? (
                <>
                  <p className="max-w-prose text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    CyberRange is a practical cybersecurity learning platform with hands-on labs, OT/ICS simulations,
                    puzzles and Capture the Flag challenges. Practise real-world attack and defence scenarios and track
                    your progress as you go.
                  </p>
                  <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                    {PLATFORM_AREAS.map((area) => (
                      <div key={area.title}>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{area.title}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{area.points.join(' · ')}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => <div key={i} className="skeleton h-10" />)}
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {labs.map((lab) => {
                const meta = categoryMeta(lab.category);
                return (
                  <li key={lab.id}>
                    <button
                      onClick={() => navigate(labPath(lab.id))}
                      className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 sm:grid-cols-[auto_minmax(0,1fr)_10rem_auto] sm:px-6 dark:hover:bg-slate-800/40"
                    >
                      <span className="flex h-11 w-14 items-center justify-center overflow-hidden rounded-xl bg-slate-50 transition-colors group-hover:bg-brand-50 dark:bg-slate-800/60 dark:group-hover:bg-brand-500/10">
                        <LabArtImage kind={labArtKind(lab.id, lab.category)} className="h-12 w-16 max-w-none" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{lab.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                          {meta.label}
                          {lab.durationHours > 0 && ` · ${lab.durationHours} h`}
                        </span>
                      </span>
                      <span className="hidden items-center gap-2.5 sm:flex">
                        <SegmentedBar done={lab.solvedChallenges} total={lab.totalChallenges} />
                        <span className="w-8 shrink-0 text-right text-xs tabular text-slate-500 dark:text-slate-400">
                          {lab.solvedChallenges}/{lab.totalChallenges}
                        </span>
                      </span>
                      <StatusPill lab={lab} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <BadgeShelf badges={game.badges} fresh={newBadges} />
          <SkillsCard areas={skillAreas} />
          <ActivityFeed today={today} />
        </div>
      </div>
    </div>
  );
};
