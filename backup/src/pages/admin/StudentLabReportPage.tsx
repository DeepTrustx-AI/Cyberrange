import { apiFetch as routedApiFetch } from '../../lib/api';
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getDeptShortCode } from '../../utils/deptMapping';
import {
  ArrowLeft,
  User,
  Clock,
  Target,
  Repeat,
  Award,
  Activity,
  GraduationCap,
} from 'lucide-react';
import { getGradeColor } from '../../utils/grading';
import { formatSkillLabel, skillChartKind, wrapSkillLabel } from './skillRadar';

interface ModuleBreakdown {
  module_id: string;
  title: string;
  track: string;
  max_points: number;
  score: number;
  attempts: number;
  time_taken_seconds: number;
  status: string;
  flag_correct: boolean;
}

interface StudentReport {
  student: {
    id: number;
    name: string;
    email: string;
    department: string;
    year: string;
    roll_number: string;
  };
  lab_name: string;
  assignment_id: number;
  total_modules: number;
  modules_completed: number;
  total_score: number;
  total_score_possible: number | null;
  score_percent: number | null;
  grade: string | null;
  total_time_seconds: number;
  total_attempts: number;
  modules: ModuleBreakdown[];
  radar_labels: string[];
  radar_values: number[];
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return '0m';
  const mins = Math.floor(totalSeconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const secs = totalSeconds % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const SkillBars: React.FC<{ labels: string[]; values: number[] }> = ({ labels, values }) => (
  <ul className="w-full space-y-4 py-2">
    {labels.map((label, i) => {
      const value = clampPercent(values[i]);
      const name = formatSkillLabel(label);
      return (
        <li key={label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-semibold text-slate-600 dark:text-slate-300" title={name}>{name}</span>
            <span className="shrink-0 font-bold tabular text-brand-600 dark:text-brand-400">{value}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${value}%` }} />
          </div>
        </li>
      );
    })}
  </ul>
);

function clampPercent(value: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

const RadarChart: React.FC<{ labels: string[]; values: number[] }> = ({ labels, values }) => {
  if (skillChartKind(labels) === 'bars') return <SkillBars labels={labels} values={values} />;

  // Everything is drawn in viewBox units, so the chart and its labels scale together and stay inside the card.
  const width = 400;
  const height = 300;
  const R = 88;
  const cx = width / 2;
  const cy = height / 2;
  const lineHeight = 12;
  const n = labels.length;
  const angles = labels.map((_, i) => (2 * Math.PI * i) / n);
  const scores = labels.map((_, i) => clampPercent(values[i]));
  const hasScore = scores.some((v) => v > 0);

  const toXY = (angle: number, r: number) => ({
    x: cx + r * Math.sin(angle),
    y: cy - r * Math.cos(angle),
  });
  const polygon = (radius: (i: number) => number) =>
    angles.map((a, i) => {
      const pt = toXY(a, radius(i));
      return `${pt.x},${pt.y}`;
    }).join(' ');

  const summary = labels.map((label, i) => `${formatSkillLabel(label)} ${scores[i]}%`).join(', ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Skill areas: ${summary}`} className="text-brand-600 dark:text-brand-400 w-full max-w-[400px] h-auto mx-auto">
      {[20, 40, 60, 80, 100].map((pct) => (
        <polygon key={pct} points={polygon(() => (pct / 100) * R)} fill="none" strokeWidth="1" className="stroke-slate-200 dark:stroke-slate-700" />
      ))}
      {angles.map((a, i) => {
        const pt = toXY(a, R);
        return <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} strokeWidth="1" className="stroke-slate-200 dark:stroke-slate-700" />;
      })}
      {hasScore && (
        <>
          <polygon points={polygon((i) => (scores[i] / 100) * R)} fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          {angles.map((a, i) => {
            if (scores[i] === 0) return null;
            const pt = toXY(a, (scores[i] / 100) * R);
            return <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="currentColor" strokeWidth="1.5" className="stroke-white dark:stroke-slate-900" />;
          })}
        </>
      )}
      {angles.map((a, i) => {
        const name = formatSkillLabel(labels[i]);
        const lines = wrapSkillLabel(name, 14, 2);
        const sin = Math.sin(a);
        const cos = Math.cos(a);
        const anchor = Math.abs(sin) < 0.2 ? 'middle' : sin > 0 ? 'start' : 'end';
        const lp = toXY(a, R + 14);
        // Top labels grow upwards, bottom labels downwards, side labels sit centred on their spoke.
        const blockHeight = (lines.length + 1) * lineHeight;
        const top = cos > 0.5 ? lp.y - blockHeight + lineHeight * 0.75 : cos < -0.5 ? lp.y + lineHeight * 0.75 : lp.y - blockHeight / 2 + lineHeight * 0.75;
        return (
          <text key={i} x={lp.x} y={top} textAnchor={anchor}>
            <title>{`${name}: ${scores[i]}%`}</title>
            {lines.map((line, row) => (
              <tspan key={row} x={lp.x} dy={row === 0 ? 0 : lineHeight} fontSize="11" fontWeight="600" className="fill-slate-500 dark:fill-slate-400">{line}</tspan>
            ))}
            <tspan x={lp.x} dy={lineHeight} fontSize="10" fontWeight="700" className="fill-brand-600 dark:fill-brand-400">{scores[i]}%</tspan>
          </text>
        );
      })}
    </svg>
  );
};

export const StudentLabReportPage: React.FC = () => {
  const { groupId, userId } = useParams<{ groupId: string; userId: string }>();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignment_id');
  const reportGroupUrl = assignmentId
    ? `/admin/reports/groups/${groupId}?assignment_id=${encodeURIComponent(assignmentId)}`
    : `/admin/reports/groups/${groupId}`;
  const [report, setReport] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      const dbGroupId = (groupId || '').replace('grp-', '');
      const token = localStorage.getItem('token');
      try {
        const assignmentQuery = assignmentId
          ? `?assignment_id=${encodeURIComponent(assignmentId)}`
          : '';

        const res = await routedApiFetch(
          `/api/v1/admin/groups/${dbGroupId}/students/${userId}/report${assignmentQuery}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );
        if (res.ok) {
          setReport(await res.json());
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.detail || 'Failed to load report.');
        }
      } catch (err) {
        console.error('Error fetching student report:', err);
        setError('An error occurred while loading the report.');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [groupId, userId, assignmentId]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading report...</div>;
  }

  if (error || !report) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-500 text-sm">{error || 'Report not found.'}</p>
        <Link to={reportGroupUrl} className="mt-3 text-brand-600 font-bold text-xs hover:underline inline-block">
          Back to Group
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to={reportGroupUrl}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Group
      </Link>

      {/* Student Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-6 shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
          {report.student.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{report.student.name}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {getDeptShortCode(report.student.department)} &middot; {report.student.year} &middot; {report.student.roll_number} &middot; {report.student.email}
          </p>
          <p className="text-xs text-brand-600 dark:text-blue-400 font-bold mt-1">{report.lab_name}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Modules</span>
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{report.modules_completed}/{report.total_modules}</span>
          </div>
          <Target className="w-7 h-7 text-slate-300" />
        </div>
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Total Score</span>
            <span className="text-xl font-bold text-brand-600">{report.total_score}</span>
          </div>
          <Award className="w-7 h-7 text-blue-200" />
        </div>
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Grade</span>
            {report.grade ? (
              <span className={`inline-block mt-0.5 text-sm font-bold px-2 py-0.5 rounded-lg border ${getGradeColor(report.grade)}`}>
                {report.grade}
              </span>
            ) : (
              <span className="text-xl font-bold text-slate-300">—</span>
            )}
          </div>
          <GraduationCap className="w-7 h-7 text-slate-300" />
        </div>
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Time Taken</span>
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatDuration(report.total_time_seconds)}</span>
          </div>
          <Clock className="w-7 h-7 text-slate-300" />
        </div>
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Attempts</span>
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{report.total_attempts}</span>
          </div>
          <Repeat className="w-7 h-7 text-slate-300" />
        </div>
      </div>

      {/* Radar + Module breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl p-6 flex flex-col items-center shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-1.5 self-start">
            <Activity className="w-4 h-4 text-brand-600" /> Skill Area Breakdown
          </h3>
          <RadarChart labels={report.radar_labels} values={report.radar_values} />
        </div>

        <div className="bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
            <User className="w-4 h-4 text-brand-600" /> Per-Module Detail
          </h3>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold sticky top-0">
                <tr>
                  <th className="p-2.5">Module</th>
                  <th className="p-2.5">Score</th>
                  <th className="p-2.5">Attempts</th>
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.modules.map((m) => (
                  <tr key={m.module_id}>
                    <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-100">{m.title}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{m.score}/{m.max_points}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{m.attempts}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{formatDuration(m.time_taken_seconds)}</td>
                    <td className="p-2.5">
                      <span className={`inline-block whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded-full ${
                        m.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : m.status === 'STARTED' ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {m.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
