import {
  ClipboardCheck,
  Cloud,
  FlaskConical,
  KeyRound,
  Puzzle,
  Radar,
  ShieldHalf,
  TerminalSquare,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
}

const CATEGORIES: Record<string, CategoryMeta> = {
  linux: { label: 'Linux', icon: TerminalSquare },
  sysadmin: { label: 'Linux', icon: TerminalSquare },
  recon: { label: 'Reconnaissance', icon: Radar },
  network: { label: 'Network', icon: Radar },
  cloud: { label: 'Cloud', icon: Cloud },
  crypto: { label: 'Cryptography', icon: KeyRound },
  cryptography: { label: 'Cryptography', icon: KeyRound },
  compliance: { label: 'Compliance', icon: ClipboardCheck },
  puzzle: { label: 'Puzzle', icon: Puzzle },
  ot: { label: 'OT / ICS', icon: Workflow },
  security: { label: 'Security', icon: ShieldHalf },
};

export function categoryMeta(category?: string | null): CategoryMeta {
  const key = (category ?? '').toLowerCase().trim();
  if (CATEGORIES[key]) return CATEGORIES[key];
  const match = Object.keys(CATEGORIES).find((name) => key.includes(name));
  if (match) return CATEGORIES[match];
  return { label: category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Lab', icon: FlaskConical };
}
