// Label and layout rules for the Skill Area Breakdown on the student lab report.
// Skill areas are the lab's module tracks, so a lab can have one, two or many,
// and their names are slugs such as "unix-programming-environment".

/** Past this many axes the radar's labels crowd each other and get cut to the same words. */
const MAX_RADAR_AXES = 8;

/** A radar only has a shape with three or more axes and stays readable up to eight; anything else reads better as bars. */
export function skillChartKind(labels: readonly string[]): 'radar' | 'bars' {
  return labels.length >= 3 && labels.length <= MAX_RADAR_AXES ? 'radar' : 'bars';
}

/** "unix-programming-environment" -> "Unix programming environment". Names that already have capitals are kept. */
export function formatSkillLabel(raw: string): string {
  const words = raw.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!words) return 'General';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Splits a label into at most `maxLines` lines of at most `maxChars` characters, ending in "…" when cut. */
export function wrapSkillLabel(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  const cut = lines.join(' ').length < text.length;
  return lines.slice(0, maxLines).map((line, index, kept) => {
    const last = index === kept.length - 1;
    if (line.length > maxChars) return `${line.slice(0, maxChars - 1)}…`;
    if (last && cut) return line.length < maxChars ? `${line}…` : `${line.slice(0, maxChars - 1)}…`;
    return line;
  });
}
