import { CLAY, CUBE_BLOCKS } from '../three/clay';

// The student's cube drawn flat (an isometric SVG): the same blocks, colours and fill
// order as the 3D cube in cubeScene.ts, at no drawing cost. Light mode keeps it for
// good and full graphics shows it while the 3D loads, so the count on screen is
// always the student's real one.

const EARNED = [CLAY.peach, CLAY.mint, CLAY.butter, CLAY.sky, CLAY.blush];
const colorFor = (index: number) => EARNED[(index * 7 + Math.floor(index / 3)) % EARNED.length];

// Same order as slot() in cubeScene.ts: bottom layer first, nearest corner first.
function cell(index: number) {
  const inLayer = 8 - (index % 9);
  return { x: inLayer % 3, y: Math.floor(index / 9), z: Math.floor(inLayer / 3) };
}

const COS30 = Math.cos(Math.PI / 6);
const point = (x: number, y: number, z: number) => `${((x - z) * COS30).toFixed(3)},${((x + z) * 0.5 - y).toFixed(3)}`;
const poly = (...corners: [number, number, number][]) => corners.map((c) => point(...c)).join(' ');

// Darker below 1, toward white above 1.
function shade(hex: string, amount: number) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mixed = channels.map((c) => Math.round(amount <= 1 ? c * amount : c + (255 - c) * (amount - 1)));
  return `rgb(${mixed.join(',')})`;
}

// The three faces a viewer above the nearest corner sees, with a small gap between blocks.
const GAP = 0.05;
function faces(x: number, y: number, z: number) {
  const [x0, x1, y0, y1, z0, z1] = [x + GAP, x + 1 - GAP, y + GAP, y + 1 - GAP, z + GAP, z + 1 - GAP];
  return {
    top: poly([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]),
    right: poly([x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [x1, y0, z0]),
    left: poly([x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]),
  };
}

// Back to front, so nearer blocks cover farther ones.
const DRAW_ORDER = Array.from({ length: CUBE_BLOCKS }, (_, i) => ({ i, ...cell(i) })).sort(
  (a, b) => a.x + a.y + a.z - (b.x + b.y + b.z) || a.y - b.y,
);

const EDGE = 0.35;
const SLAB = 0.24;

// The empty cube as one grid on its three visible outer faces (top, right, left),
// drawn over the blocks so blocks inside still show through it.
const line = (a: [number, number, number], b: [number, number, number]) => `M${point(...a)}L${point(...b)}`;
const GRID = [0, 1, 2, 3]
  .flatMap((k) => [
    line([k, 3, 0], [k, 3, 3]),
    line([0, 3, k], [3, 3, k]),
    line([3, k, 0], [3, k, 3]),
    line([3, 0, k], [3, 3, k]),
    line([0, k, 3], [3, k, 3]),
    line([k, 0, 3], [k, 3, 3]),
  ])
  .join('');

export function FlatCube({ filled, dark, className = '' }: { filled: number; dark: boolean; className?: string }) {
  const count = Math.max(0, Math.min(CUBE_BLOCKS, filled));
  const plinth = dark ? '#3A3029' : '#F2E9DC';
  const slot = dark ? 'rgba(233,220,203,0.3)' : 'rgba(168,146,122,0.42)';
  const [lo, hi] = [-EDGE, 3 + EDGE];

  return (
    <svg viewBox="-3.35 -3.2 6.7 6.95" className={className} aria-hidden="true">
      <polygon points={poly([lo, 0, lo], [hi, 0, lo], [hi, 0, hi], [lo, 0, hi])} fill={plinth} />
      <polygon points={poly([hi, 0, lo], [hi, 0, hi], [hi, -SLAB, hi], [hi, -SLAB, lo])} fill={shade(plinth, 0.86)} />
      <polygon points={poly([lo, 0, hi], [hi, 0, hi], [hi, -SLAB, hi], [lo, -SLAB, hi])} fill={shade(plinth, 0.93)} />
      {DRAW_ORDER.filter(({ i }) => i < count).map(({ i, x, y, z }) => {
        const face = faces(x, y, z);
        const color = colorFor(i);
        const top = shade(color, 1.1);
        const left = shade(color, 0.95);
        const right = shade(color, 0.84);
        // A stroke in each face's own colour rounds the corners, like the clay blocks.
        return (
          <g key={i} strokeWidth={0.07} strokeLinejoin="round">
            <polygon points={face.left} fill={left} stroke={left} />
            <polygon points={face.right} fill={right} stroke={right} />
            <polygon points={face.top} fill={top} stroke={top} />
          </g>
        );
      })}
      {count < CUBE_BLOCKS && <path d={GRID} fill="none" stroke={slot} strokeWidth={0.022} strokeLinecap="round" />}
    </svg>
  );
}
