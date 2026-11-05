import { useEffect, useState } from 'react';
import { CUBE_BLOCKS } from '../components/three/clay';

// The progress game, computed only from real data: every cleared module is one
// block, 27 blocks complete a cube and raise your level, and badges unlock from
// what you have actually done.

export interface Badge {
  id: string;
  name: string;
  hint: string;
  earned: boolean;
  tone: 'peach' | 'mint' | 'butter' | 'sky' | 'blush';
}

export interface GameState {
  cleared: number;
  level: number;
  inLevel: number;
  toNext: number;
  badges: Badge[];
}

interface GameInput {
  cleared: number;
  completedLabs: number;
  streak: number;
  firstTryPasses: number;
  areasStarted: number;
}

export function computeGame({ cleared, completedLabs, streak, firstTryPasses, areasStarted }: GameInput): GameState {
  const level = Math.floor(cleared / CUBE_BLOCKS) + 1;
  const inLevel = cleared % CUBE_BLOCKS;
  return {
    cleared,
    level,
    inLevel,
    toNext: CUBE_BLOCKS - inLevel,
    badges: [
      { id: 'first-block', name: 'First block', hint: 'Clear your first module', earned: cleared >= 1, tone: 'peach' },
      { id: 'first-try', name: 'First try', hint: 'Pass a challenge on your first attempt', earned: firstTryPasses >= 1, tone: 'butter' },
      { id: 'ten-blocks', name: 'Ten blocks', hint: 'Clear 10 modules', earned: cleared >= 10, tone: 'sky' },
      { id: 'lab-done', name: 'Lab finished', hint: 'Finish every module of a lab', earned: completedLabs >= 1, tone: 'mint' },
      { id: 'on-a-roll', name: 'On a roll', hint: 'Submit work 3 days in a row', earned: streak >= 3, tone: 'peach' },
      { id: 'explorer', name: 'Explorer', hint: 'Make progress in 3 different areas', earned: areasStarted >= 3, tone: 'blush' },
      { id: 'full-week', name: 'Full week', hint: 'Submit work 7 days in a row', earned: streak >= 7, tone: 'butter' },
      { id: 'first-cube', name: 'First cube', hint: 'Fill all 27 blocks to reach level 2', earned: cleared >= CUBE_BLOCKS, tone: 'mint' },
    ],
  };
}

const SEEN_KEY = 'cyberrange-cube-seen';
const BADGES_KEY = 'cyberrange-badges-seen';

function readNumber(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

// How many blocks were added since this browser last showed the cube, so the
// new ones can drop in. The first visit shows the cube as it stands.
export function useFreshBlocks(cleared: number, ready: boolean) {
  const [fresh, setFresh] = useState(0);
  // What this browser had seen before the page opened, read once, so counts
  // that settle while the page loads are not mistaken for new blocks.
  const [seenBefore] = useState(() => readNumber(SEEN_KEY));
  useEffect(() => {
    if (!ready) return;
    setFresh(seenBefore === null ? 0 : Math.max(0, cleared - seenBefore));
    try {
      window.localStorage.setItem(SEEN_KEY, String(cleared));
    } catch { /* storage blocked: no drop-in animation */ }
  }, [cleared, ready, seenBefore]);
  return fresh;
}

// Badge ids earned since this browser last looked, so they can shine once.
export function useNewBadges(badges: Badge[], ready: boolean) {
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const earned = badges.filter((badge) => badge.earned).map((badge) => badge.id).join(',');
  useEffect(() => {
    if (!ready) return;
    let seen: string[] | null = null;
    try {
      seen = JSON.parse(window.localStorage.getItem(BADGES_KEY) ?? 'null');
      window.localStorage.setItem(BADGES_KEY, JSON.stringify(earned ? earned.split(',') : []));
    } catch { /* storage blocked: nothing shines */ }
    setFresh(seen === null ? new Set() : new Set((earned ? earned.split(',') : []).filter((id) => !seen?.includes(id))));
  }, [earned, ready]);
  return fresh;
}
