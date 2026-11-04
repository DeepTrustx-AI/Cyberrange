import { LabArtImage } from './LabArtImage';
import { labArtKind } from '../../utils/labArtKind';

// The top band of every lab card, student catalogue and admin marketplace alike:
// a soft tint per lab family, the lab's clay illustration and its difficulty.
// The illustration is always the pre-rendered picture: a live 3D scene per hovered
// card made browsers without parallel shader compiling (Firefox) freeze for seconds.

const FAMILY_TINTS: Record<string, string> = {
  linux: 'from-[#FFE9DA] to-[#FFF6EE] dark:from-[#3A2C22] dark:to-[#2A231D]',
  cloud: 'from-[#DDF6EC] to-[#F2FBF7] dark:from-[#20332C] dark:to-[#1F2724]',
  crypto: 'from-[#FFF3C9] to-[#FFFAEA] dark:from-[#3A331D] dark:to-[#29261B]',
  recon: 'from-[#E7EEF9] to-[#F5F8FD] dark:from-[#262B36] dark:to-[#22252C]',
  ot: 'from-[#F7E6F0] to-[#FCF4F8] dark:from-[#36252F] dark:to-[#2A2128]',
  puzzle: 'from-[#FFF3C9] to-[#FFFAEA] dark:from-[#3A331D] dark:to-[#29261B]',
};

const DIFFICULTY: Record<string, { dot: string; text: string }> = {
  beginner: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  intermediate: { dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300' },
  advanced: { dot: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  expert: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
};

interface LabCardMediaProps {
  labId: string;
  category?: string | null;
  difficulty?: string | null;
  size?: 'card' | 'hero';
  complete?: boolean;
}

function familyTint(category?: string | null) {
  const family = (category ?? '').toLowerCase();
  return FAMILY_TINTS[Object.keys(FAMILY_TINTS).find((name) => family.includes(name)) ?? 'recon'];
}

export function LabCardMedia({ labId, category, difficulty, size = 'card', complete = false }: LabCardMediaProps) {
  const level = (difficulty ?? '').toLowerCase();
  const style = DIFFICULTY[level];
  const kind = labArtKind(labId, category ?? '');
  const art = size === 'hero' ? 'h-64 w-[22rem]' : 'h-40 w-56';

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${size === 'hero' ? 'h-72' : 'h-44'} ${familyTint(category)}`}>
      <LabArtImage kind={kind} className={`${art} transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-[1.04]`} />
      {complete && (
        <span className="stamp-in absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-emerald-500 py-1 pl-1.5 pr-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-700/20">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25">
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5" /></svg>
          </span>
          Complete
        </span>
      )}
      {difficulty && (
        <span className={`absolute left-4 top-4 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/85 px-2.5 py-1 text-xs font-medium capitalize shadow-xs backdrop-blur-sm dark:bg-slate-950/60 ${style?.text ?? 'text-slate-600 dark:text-slate-300'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style?.dot ?? 'bg-slate-400'}`} aria-hidden="true" />
          {level}
        </span>
      )}
    </div>
  );
}
