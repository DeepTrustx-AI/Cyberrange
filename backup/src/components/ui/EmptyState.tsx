import type { ReactNode } from 'react';
import { LabArtImage } from '../art/LabArtImage';
import { Mascot, type MascotPose } from '../mascot/Mascot';
import type { LabArtKind } from '../../utils/labArtKind';

interface EmptyStateProps {
  art?: LabArtKind;
  mascot?: MascotPose;
  title: string;
  body: string;
  action?: ReactNode;
}

// What a page shows when it has nothing to list: the mascot or a small clay
// scene, one line on why it is empty, and the next thing to do.
export function EmptyState({ art = 'blocks', mascot, title, body, action }: EmptyStateProps) {
  return (
    <div className="range-wash flex flex-col items-center rounded-3xl px-6 py-12 text-center ring-1 ring-slate-200/70 dark:ring-slate-800">
      {mascot ? <Mascot pose={mascot} size={104} interactive /> : <LabArtImage kind={art} className="h-28 w-40" />}
      <p className="mt-3 font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
