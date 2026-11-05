import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import { LabArtImage } from '../../components/art/LabArtImage';
import { SegmentedBar } from '../../components/ui/SegmentedBar';
import { formatWhen } from '../../components/assignments/assignment';
import { serverTime } from '../../utils/assignmentState';
import { categoryMeta } from '../../utils/labMeta';
import { labArtKind } from '../../utils/labArtKind';
import { assignmentLabPath, labPath } from '../../utils/labRoutes';
import { groupDashboardLabs, type TrainingLab } from './dashboardLabs';

function LabIdentity({ lab, assignmentCount }: { lab: TrainingLab; assignmentCount?: number }) {
  const meta = categoryMeta(lab.category);
  return (
    <>
      <span className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800/60">
        <LabArtImage kind={labArtKind(lab.id, lab.category)} className="h-12 w-16 max-w-none" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="break-words font-display text-sm font-semibold text-slate-900 dark:text-white">{lab.title}</h3>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {meta.label}
          {lab.durationHours > 0 && ` · ${lab.durationHours} h`}
          {assignmentCount !== undefined && ` · ${assignmentCount} assignment${assignmentCount === 1 ? '' : 's'}`}
        </span>
      </div>
    </>
  );
}

function AssignmentDate({ value, empty }: { value: string | null; empty: string }) {
  const at = serverTime(value);
  return at === null ? <>{empty}</> : <time dateTime={new Date(at).toISOString()}>{formatWhen(value)}</time>;
}

// Catalogue fallback rows have no assignment identity or dates. Keep their
// existing direct lab navigation and progress instead of inventing an assignment.
function CatalogueStatus({ lab }: { lab: TrainingLab }) {
  const progress = lab.totalChallenges > 0 ? lab.solvedChallenges / lab.totalChallenges : 0;
  if (progress >= 1 || lab.status === 'completed') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Complete</span>;
  }
  if (lab.status === 'upcoming') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Clock className="h-3 w-3" /> Upcoming</span>;
  }
  if (progress > 0) {
    return <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">In progress</span>;
  }
  return <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">Not started</span>;
}

export function DashboardLabGroups({ labs }: { labs: TrainingLab[] }) {
  const groups = useMemo(() => groupDashboardLabs(labs), [labs]);
  return (
    <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
      {groups.map(({ id, lab, assignments }) => {
        const hasAssignments = assignments.some((item) => item.assignmentId !== null || item.startDatetime || item.endDatetime);
        return (
          <li key={id}>
            {hasAssignments ? (
              <>
                <div className="flex items-center gap-3 px-5 pb-3 pt-4 sm:px-6">
                  <LabIdentity lab={lab} assignmentCount={assignments.length} />
                </div>
                <table className="w-full table-fixed text-left text-xs" aria-label={`${lab.title} assignments`}>
                  <thead className="text-slate-500 dark:text-slate-400">
                    <tr>
                      <th scope="col" className="pb-1 pl-5 pr-2 font-medium sm:pl-6">Starts</th>
                      <th scope="col" className="px-2 pb-1 font-medium">Deadline</th>
                      <th scope="col" className="pb-1 pl-2 pr-5 font-medium sm:pr-6">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {assignments.map((item, index) => (
                      <tr key={item.assignmentId === null ? `legacy-${index}` : item.assignmentId} className="align-top">
                        <td className="py-3 pl-5 pr-2 leading-5 sm:pl-6">
                          <Link
                            to={item.assignmentId === null ? labPath(id) : assignmentLabPath(id, item.assignmentId)}
                            aria-label={`${lab.title}, assignment ${index + 1}: starts ${formatWhen(item.startDatetime) || 'date not set'}`}
                            className="inline-block max-w-full font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400"
                          >
                            <AssignmentDate value={item.startDatetime} empty="Not scheduled" />
                          </Link>
                        </td>
                        <td className="px-2 py-3 leading-5 text-slate-700 dark:text-slate-300">
                          <AssignmentDate value={item.endDatetime} empty="No deadline" />
                        </td>
                        <td className="py-3 pl-2 pr-5 sm:pr-6">
                          <span className="block tabular leading-5 text-slate-700 dark:text-slate-300">{item.solvedChallenges}/{item.totalChallenges} modules</span>
                          <SegmentedBar
                            done={item.solvedChallenges}
                            total={item.totalChallenges}
                            maxSegments={6}
                            label={`${lab.title}, assignment ${index + 1} progress`}
                            className="mt-1.5"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <Link to={labPath(id)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 sm:grid-cols-[auto_minmax(0,1fr)_10rem_auto] sm:px-6 dark:hover:bg-slate-800/40">
                <LabIdentity lab={lab} />
                <span className="hidden items-center gap-2.5 sm:flex">
                  <SegmentedBar done={lab.solvedChallenges} total={lab.totalChallenges} />
                  <span className="w-8 shrink-0 text-right text-xs tabular text-slate-500 dark:text-slate-400">{lab.solvedChallenges}/{lab.totalChallenges}</span>
                </span>
                <CatalogueStatus lab={lab} />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
