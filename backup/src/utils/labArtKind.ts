// Every illustration a lab card can show (scripts/render-lab-art.mjs renders each one).
export const LAB_ART_KINDS = [
  'server',
  'rack',
  'railway',
  'water',
  'cloud',
  'lock',
  'radar',
  'industrial',
  'race',
  'checklist',
  'shield',
  'puzzle',
  'blocks',
  'flag',
] as const;

// Which illustration a lab card shows, from its id and category.
export type LabArtKind = (typeof LAB_ART_KINDS)[number];

export function labArtKind(labId: string, category: string): LabArtKind {
  const id = labId.toLowerCase();
  const cat = category.toLowerCase();
  if (id.includes('sysadmin')) return 'rack';
  if (id.includes('rail')) return 'railway';
  if (id.includes('water')) return 'water';
  if (id.includes('crypt')) return 'lock';
  if (id.includes('command-line')) return 'server';
  if (id.includes('race')) return 'race';
  if (id.includes('workshop') || id.includes('security-workshop')) return 'shield';
  if (id.includes('compliance') || cat.includes('compliance')) return 'checklist';
  if (id.includes('puzzle') || cat.includes('puzzle')) return 'puzzle';
  if (cat.includes('cloud') || id.includes('cloud')) return 'cloud';
  if (cat.includes('crypt')) return 'lock';
  if (cat.includes('recon') || cat.includes('network')) return 'radar';
  if (/\bot\b/.test(cat) || id.includes('ot-') || id.includes('scada') || id.includes('rail') || id.includes('water')) return 'industrial';
  if (cat.includes('linux') || cat.includes('sysadmin')) return 'server';
  return 'blocks';
}
