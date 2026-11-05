import { lazy, Suspense, useEffect, useState } from 'react';
import { Award, Box, Boxes, CalendarCheck, Compass, Crown, Flame, Lock, Sparkles, Zap } from 'lucide-react';
import type { Badge, GameState } from '../../utils/progressGame';
import { CUBE_BLOCKS } from '../three/clay';
import { useRichGraphics } from '../../utils/webgl';
import { Mascot } from '../mascot/Mascot';
import { ClayRain } from '../ui/ClayRain';
import { FlatCube } from './FlatCube';

const ClayCube = lazy(() => import('../three/ClayCube'));

const BADGE_ICONS: Record<string, typeof Box> = {
  'first-block': Box,
  'first-try': Zap,
  'ten-blocks': Boxes,
  'lab-done': Award,
  'on-a-roll': Flame,
  explorer: Compass,
  'full-week': CalendarCheck,
  'first-cube': Crown,
};

const TONES: Record<Badge['tone'], string> = {
  peach: 'from-[#FFD9C2] to-[#F6B48E] text-[#7A3B17]',
  mint: 'from-[#C9F3E2] to-[#8DDDBF] text-[#0F5640]',
  butter: 'from-[#FFF0B8] to-[#FFD866] text-[#6B4C00]',
  sky: 'from-[#D6ECFA] to-[#A5D1F2] text-[#163E5C]',
  blush: 'from-[#FBDCE5] to-[#F2B3C6] text-[#6E2238]',
};

interface CubeStageProps {
  game: GameState;
  fresh: number;
  dark: boolean;
  ready: boolean;
  /** The new blocks finished a cube since the last visit; `previous` of its blocks were already there. */
  levelUp: { previous: number } | null;
}

// The dashboard's right side: the student's own clay cube, one block per cleared
// module, with their level and how far the next one is. The cube is built once the
// counts are loaded; building it on the empty first render meant building it twice.
// A finished cube gets its moment: the card shows the cube being completed, then,
// as the cube spins and lifts away, "Level up!", the new level and clay confetti.
export function CubeStage({ game, fresh, dark, ready, levelUp }: CubeStageProps) {
  const webgl = useRichGraphics();
  const [hover, setHover] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [drawn, setDrawn] = useState(false);
  // Without WebGL there is no cube to wait for, so the card celebrates at once.
  useEffect(() => {
    if (levelUp && !webgl) setCelebrating(true);
  }, [levelUp, webgl]);
  const finishing = Boolean(levelUp) && !celebrating;
  const level = levelUp ? (celebrating ? Math.max(2, game.level) : Math.max(1, game.level - 1)) : game.level;
  const inLevel = finishing ? CUBE_BLOCKS : game.inLevel;
  const share = inLevel / CUBE_BLOCKS;

  return (
    <div className="relative h-full w-full">
      {celebrating && <ClayRain count={48} delay={0.1} />}
      {/* The flat drawing of the student's own cube holds its place while the 3D
          loads (or never starts), and stays for good in light mode. */}
      <div className={`absolute inset-x-0 bottom-28 top-16 flex items-center justify-center transition-opacity duration-500 ${webgl && drawn ? 'opacity-0' : 'opacity-100'}`}>
        <FlatCube filled={inLevel} dark={dark} className="h-full max-h-80 w-auto" />
      </div>
      {webgl && ready && (
        <Suspense fallback={null}>
          <ClayCube mode="progress" filled={game.inLevel} fresh={fresh} dark={dark} levelUp={levelUp} onReady={() => setDrawn(true)} onHover={setHover} onLevelUp={() => setCelebrating(true)} className="absolute inset-x-0 bottom-24 top-10" />
        </Suspense>
      )}

      <div className="pointer-events-none absolute right-6 top-6 text-right">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Your cube</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">One block for every module you clear</p>
      </div>


      <div
        className={`absolute bottom-5 right-5 w-64 rounded-2xl bg-white/85 p-4 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 backdrop-blur-sm transition-transform duration-300 dark:bg-slate-900/80 dark:ring-white/10 ${hover ? '-translate-y-1' : ''}`}
      >
        {/* Perched on the card's top edge, legs over it. */}
        <div className="pointer-events-none absolute -top-[56px] left-3" aria-hidden="true">
          <Mascot pose={celebrating || (fresh > 0 && !levelUp) ? 'cheer' : 'idle'} size={72} seated interactive />
        </div>
        {celebrating ? (
          <p className="reward-pop mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300" role="status">
            <Crown className="h-3.5 w-3.5" />Level up! Cube {level - 1} is complete.
          </p>
        ) : finishing ? (
          <p className="rise-in mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />Your new blocks finish this cube
          </p>
        ) : fresh > 0 ? (
          <p className="rise-in mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />+{fresh} new block{fresh === 1 ? '' : 's'} since your last visit
          </p>
        ) : null}
        <div className="flex items-baseline justify-between">
          <p key={level} className={`font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white ${celebrating ? 'stamp-in' : ''}`}>Level {level}</p>
          <p className="text-xs tabular text-slate-500 dark:text-slate-400">{inLevel}/{CUBE_BLOCKS} blocks</p>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={CUBE_BLOCKS} aria-valuenow={inLevel} aria-label={`Level ${level} progress`}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#F6C6A6] via-[#FFE08A] to-[#9BE3C8] transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(share * 100, inLevel ? 4 : 0)}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {finishing
            ? 'Watch your cube come together.'
            : game.inLevel === 0 && game.cleared === 0
              ? 'Clear your first module to place your first block.'
              : `${game.toNext} more block${game.toNext === 1 ? '' : 's'} to reach level ${level + 1}.`}
        </p>
      </div>
    </div>
  );
}

export function BadgeShelf({ badges, fresh }: { badges: Badge[]; fresh: Set<string> }) {
  const earned = badges.filter((badge) => badge.earned).length;
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">Badges</h2>
        <span className="text-xs tabular text-slate-500 dark:text-slate-400">{earned} of {badges.length}</span>
      </div>
      <ul className="mt-4 grid grid-cols-4 gap-2.5">
        {badges.map((badge, index) => {
          const align = index % 4 === 0 ? 'left-0' : index % 4 === 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';
          const Icon = BADGE_ICONS[badge.id] ?? Award;
          const isNew = fresh.has(badge.id);
          return (
            <li key={badge.id} className="group relative flex flex-col items-center text-center">
              <span
                role="img"
                tabIndex={0}
                aria-label={`${badge.name}: ${badge.earned ? 'earned' : `locked. ${badge.hint}`}`}
                className={`relative flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:rotate-[-4deg] focus-visible:-translate-y-0.5 ${
                  badge.earned
                    ? `bg-gradient-to-br shadow-[0_6px_14px_-6px_rgba(120,80,40,0.45),inset_0_1px_0_rgba(255,255,255,0.7)] ${TONES[badge.tone]} ${isNew ? 'shine' : ''}`
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={2.2} />
                {!badge.earned && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                    <Lock className="h-2.5 w-2.5" />
                  </span>
                )}
                {isNew && <span className="tick-in absolute -right-1.5 -top-1.5 rounded-full bg-emerald-500 px-1.5 py-px text-xs font-bold text-white">New</span>}
              </span>
              <span className={`mt-1.5 text-xs leading-tight ${badge.earned ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{badge.name}</span>
              <span
                role="tooltip"
                className={`pointer-events-none absolute bottom-full z-10 mb-2 w-40 ${align} rounded-xl bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-white dark:text-slate-900`}
              >
                {badge.earned ? `Earned: ${badge.hint.toLowerCase()}` : badge.hint}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

