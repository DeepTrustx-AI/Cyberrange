import React, { useEffect, useMemo, useState } from 'react';
import { Award, Download, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context';
import { EmptyState } from '../../components/ui/EmptyState';
import { SegmentedBar } from '../../components/ui/SegmentedBar';
import { earnedSkills, roleCoverage, type LabProgress } from '../../data/skills';
import { formatWhen, type Assignment } from '../../components/assignments/assignment';

interface CatalogueLab {
  id: string;
  title?: string;
  name?: string;
  modules?: unknown[];
  totalChallenges?: number;
  solvedChallenges?: number;
  isCompleted?: boolean;
}

interface Certificate {
  display_certificate_id: string;
  lab_id: string;
  lab_title: string;
  completion_date: string;
  percentage: number;
  score: number;
  pdf_url: string | null;
  verification_url: string;
}

// The backend's achievements, unlocked or not. A badge links to a certificate only
// when it has its own; otherwise an unlocked one just says when it was earned.
interface Achievement {
  id: string;
  title: string;
  description?: string;
  reward_points?: number;
  unlocked: boolean;
  earned_at?: string;
  certificate_id?: string | null;
  display_certificate_id?: string | null;
}

const card = 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800';

// What a student can show for their work: roles and skills from cleared
// modules, certificates for finished labs, grades teachers have published,
// achievements and training hours.
export const ProgressPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const [labs, setLabs] = useState<CatalogueLab[] | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [graded, setGraded] = useState<Assignment[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [trainingHours, setTrainingHours] = useState(0);
  const [allRoles, setAllRoles] = useState(false);

  useEffect(() => {
    const json = (path: string) => apiFetch(path).then((res) => (res.ok ? res.json() : [])).catch(() => []);
    void Promise.all([json('/api/v1/labs'), json('/api/v1/reporting/certificates'), json('/api/v1/user/assignments'), json('/api/v1/reporting/achievements'), json('/api/v1/reporting/dashboard')]).then(([labRows, certRows, workRows, badgeRows, summary]) => {
      setLabs(Array.isArray(labRows) ? labRows : []);
      setCertificates(Array.isArray(certRows) ? certRows : []);
      setGraded((Array.isArray(workRows) ? workRows : []).filter((item: Assignment) => item.published_grade));
      setAchievements(Array.isArray(badgeRows) ? [...badgeRows].sort((a: Achievement, b: Achievement) => Number(b.unlocked) - Number(a.unlocked)) : []);
      setTrainingHours(Number(summary?.total_training_hours) || 0);
    });
  }, [apiFetch]);

  const progress = useMemo<LabProgress[]>(() => (labs ?? []).map((lab) => ({
    id: lab.id,
    solved: lab.solvedChallenges ?? 0,
    total: lab.modules?.length || lab.totalChallenges || 0,
    completed: Boolean(lab.isCompleted),
  })), [labs]);
  const roles = useMemo(() => roleCoverage(progress), [progress]);
  const skills = useMemo(() => [...new Set(earnedSkills(progress))], [progress]);
  const cleared = progress.reduce((sum, lab) => sum + Math.min(lab.total, lab.completed ? lab.total : lab.solved), 0);
  const finished = progress.filter((lab) => lab.total > 0 && (lab.completed || lab.solved >= lab.total)).length;
  const started = roles.filter((role) => role.cleared > 0);
  const shownRoles = allRoles ? roles : started.length ? started : roles.slice(0, 4);
  const titleOf = (id: string) => labs?.find((lab) => lab.id === id)?.title ?? labs?.find((lab) => lab.id === id)?.name ?? id;

  if (labs === null) {
    return <div className="h-64 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800/60" aria-label="Loading your progress" />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Progress</h1>
        <p className="mt-2 max-w-xl text-[15px] text-slate-500 dark:text-slate-400">
          What you can show for your work: the roles and skills your cleared modules build, your certificates and your grades.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Modules cleared', cleared], ['Labs finished', finished], ['Certificates', certificates.length], ['Training hours', Math.round(trainingHours * 10) / 10]].map(([label, value]) => (
          <div key={label} className={card}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-1 font-display text-3xl font-bold tabular text-slate-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>

      {cleared === 0 && certificates.length === 0 ? (
        <EmptyState mascot="wave" title="Your progress starts with one module" body="Clear a module in any lab and it shows up here, with the skills and work roles it counts towards." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className={card} aria-labelledby="roles-title">
            <h2 id="roles-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">Work roles</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Roles from the NICE cybersecurity workforce framework, filled by the modules you have cleared.
            </p>
            <ul className="mt-4 space-y-4">
              {shownRoles.map((role) => (
                <li key={role.role}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{role.role}</span>
                    <span className="shrink-0 text-xs tabular text-slate-500 dark:text-slate-400">{role.cleared}/{role.total} modules · {role.percent}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={role.percent} aria-label={`${role.role}: ${role.percent}%`}>
                    <span className="block h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${role.percent}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">From {role.labs.map(titleOf).join(', ')}</p>
                </li>
              ))}
            </ul>
            {roles.length > shownRoles.length && (
              <button type="button" onClick={() => setAllRoles(true)} className="mt-4 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                Show {roles.length - shownRoles.length} more roles you can work towards
              </button>
            )}
          </section>

          <div className="space-y-6">
            <section className={card} aria-labelledby="skills-title">
              <h2 id="skills-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">Skills you have practised</h2>
              {skills.length ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {skills.map((skill) => <li key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{skill}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Clear a module to add its skills here.</p>
              )}
            </section>

            <section className={card} aria-labelledby="certs-title">
              <h2 id="certs-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">Certificates</h2>
              {certificates.length ? (
                <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {certificates.map((cert) => (
                    <li key={cert.display_certificate_id} className="flex items-center gap-3 py-3">
                      <Award className="h-5 w-5 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{cert.lab_title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{cert.display_certificate_id} · {cert.completion_date.slice(0, 10)}</p>
                      </div>
                      <a href={cert.verification_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                        Verify <ExternalLink className="h-3 w-3" />
                      </a>
                      {cert.pdf_url && (
                        <a href={cert.pdf_url} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={`Download the ${cert.lab_title} certificate`}>
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Finish every module of a lab to earn its certificate.</p>
              )}
            </section>
          </div>
        </div>
      )}

      {graded.length > 0 && (
        <section className={card} aria-labelledby="graded-title">
          <h2 id="graded-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">Graded work</h2>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {graded.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-white">{item.lab_name}</span>
                <span className="text-sm font-semibold tabular text-slate-900 dark:text-white">{Math.round(item.published_grade!.final_percent)}% {item.published_grade!.letter}</span>
                {item.published_grade!.published_at && <span className="text-xs text-slate-500 dark:text-slate-400">{formatWhen(item.published_grade!.published_at)}</span>}
                {item.published_grade!.feedback && <p className="w-full text-sm text-slate-600 dark:text-slate-300">{item.published_grade!.feedback}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {achievements.length > 0 && (
        <section className={card} aria-labelledby="badges-title">
          <h2 id="badges-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">Achievements</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {achievements.filter((badge) => badge.unlocked).length} of {achievements.length} unlocked
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 dark:divide-slate-800">
            {achievements.map((badge) => {
              const certId = badge.display_certificate_id || badge.certificate_id;
              return (
                <li key={badge.id} className={`flex items-center gap-3 py-3 ${badge.unlocked ? '' : 'opacity-60'}`}>
                  <Award className={`h-5 w-5 shrink-0 ${badge.unlocked ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{badge.title}</p>
                    {badge.description && <p className="text-xs text-slate-500 dark:text-slate-400">{badge.description}</p>}
                  </div>
                  {badge.unlocked && certId ? (
                    <a href={`/certificate/verify/${encodeURIComponent(certId)}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                      Verify <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : badge.unlocked ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-400">Earned{badge.earned_at ? ` ${badge.earned_at.slice(0, 10)}` : ''}</span>
                  ) : (
                    <span className="shrink-0 text-xs tabular text-slate-500 dark:text-slate-400">{badge.reward_points ? `${badge.reward_points} pts` : 'Locked'}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={card} aria-labelledby="labs-title">
        <h2 id="labs-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">By lab</h2>
        <ul className="mt-3 space-y-3">
          {progress.filter((lab) => lab.total > 0).sort((a, b) => b.solved / b.total - a.solved / a.total).map((lab) => (
            <li key={lab.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
              <span className="truncate text-sm text-slate-800 dark:text-slate-100">{titleOf(lab.id)}</span>
              <SegmentedBar done={lab.completed ? lab.total : lab.solved} total={lab.total} className="col-span-2 sm:col-span-1 sm:order-none" />
              <span className="text-xs tabular text-slate-500 dark:text-slate-400 sm:order-none">{lab.completed ? lab.total : lab.solved}/{lab.total}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default ProgressPage;
