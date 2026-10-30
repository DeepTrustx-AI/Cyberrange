import type { ReactNode } from 'react';
import type { LabArtKind } from '../../utils/labArtKind';

// Small isometric illustrations, one per kind of lab, drawn in the same clay
// palette and light direction as the 3D range: light tops, mid fronts, dark sides.


const COS = 0.866;

const C = {
  cream: '#F6F1E9',
  peach: '#F6C6A6',
  mint: '#9BE3C8',
  butter: '#FFE08A',
  sky: '#B7DCF5',
  blush: '#F7C9D6',
  ink: '#2A2F3D',
  white: '#FFFFFF',
};

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * (1 - amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function p(x: number, y: number, z: number) {
  return `${((x - y) * COS).toFixed(1)},${((x + y) * 0.5 - z).toFixed(1)}`;
}

function poly(points: [number, number, number][]) {
  return points.map(([x, y, z]) => p(x, y, z)).join(' ');
}

function Box({ x, y, z, w, d, h, color }: { x: number; y: number; z: number; w: number; d: number; h: number; color: string }) {
  return (
    <g>
      <polygon points={poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])} fill={shade(color, 0.08)} />
      <polygon points={poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])} fill={shade(color, 0.2)} />
      <polygon points={poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])} fill={color} />
    </g>
  );
}

// A panel lying on the front (+y) face of a box, for screens and labels.
function FrontPanel({ x, y, z, w, h, color }: { x: number; y: number; z: number; w: number; h: number; color: string }) {
  return <polygon points={poly([[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]])} fill={color} />;
}

function FrontLine({ x, y, z, length, color, width = 2 }: { x: number; y: number; z: number; length: number; color: string; width?: number }) {
  const [x1, y1] = p(x, y, z).split(',');
  const [x2, y2] = p(x + length, y, z).split(',');
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />;
}

function Cylinder({ x, y, z, r, h, color }: { x: number; y: number; z: number; r: number; h: number; color: string }) {
  const [cx, cy] = p(x, y, z).split(',').map(Number);
  const rx = r * COS * 1.414;
  const ry = rx * 0.5;
  return (
    <g>
      <path d={`M${cx - rx},${cy} L${cx - rx},${cy - h} A${rx},${ry} 0 0 0 ${cx + rx},${cy - h} L${cx + rx},${cy} A${rx},${ry} 0 0 1 ${cx - rx},${cy} Z`} fill={shade(color, 0.12)} />
      <path d={`M${cx},${cy + ry} A${rx},${ry} 0 0 0 ${cx + rx},${cy} L${cx + rx},${cy - h} A${rx},${ry} 0 0 1 ${cx},${cy - h + ry} Z`} fill={shade(color, 0.22)} />
      <ellipse cx={cx} cy={cy - h} rx={rx} ry={ry} fill={color} />
    </g>
  );
}

function Plinth({ size = 64, color = C.cream }: { size?: number; color?: string }) {
  const half = size / 2;
  return <Box x={-half} y={-half} z={0} w={size} d={size} h={5} color={color} />;
}

function Server() {
  return (
    <>
      <Plinth color={C.peach} />
      <Box x={-14} y={-14} z={5} w={28} d={28} h={48} color={C.cream} />
      <FrontPanel x={-10} y={14} z={22} w={20} h={26} color={C.ink} />
      <FrontLine x={-7} y={14} z={35} length={8} color={C.mint} />
      <FrontLine x={-7} y={14} z={30} length={13} color={C.white} width={1.6} />
      <FrontLine x={-7} y={14} z={25.5} length={5} color={C.peach} />
      <FrontLine x={-10} y={14} z={14} length={20} color={shade(C.cream, 0.25)} width={1.4} />
      <FrontLine x={-10} y={14} z={10} length={20} color={shade(C.cream, 0.25)} width={1.4} />
      <Box x={18} y={-24} z={30} w={9} d={9} h={9} color={C.mint} />
    </>
  );
}

function Cloud() {
  return (
    <>
      <Plinth color={C.mint} />
      <Box x={-24} y={-6} z={5} w={18} d={18} h={22} color={C.cream} />
      <Box x={4} y={-20} z={5} w={18} d={18} h={30} color={C.cream} />
      <FrontLine x={-21} y={12} z={18} length={12} color={C.mint} />
      <FrontLine x={7} y={-2} z={26} length={12} color={C.mint} />
      <g transform="translate(2,-56)">
        <ellipse cx={0} cy={10} rx={30} ry={7} fill={shade(C.sky, 0.25)} opacity={0.35} />
        <circle cx={-14} cy={2} r={11} fill={C.sky} />
        <circle cx={2} cy={-5} r={15} fill={C.white} />
        <circle cx={17} cy={3} r={10} fill={C.sky} />
        <rect x={-25} y={2} width={52} height={10} rx={5} fill={C.white} />
      </g>
    </>
  );
}

function Lock() {
  return (
    <>
      <Plinth color={C.butter} />
      <path d="M-15,-28 L-15,-44 A15,15 0 0 1 15,-44 L15,-28" fill="none" stroke={shade(C.cream, 0.32)} strokeWidth={7} strokeLinecap="round" />
      <path d="M-15,-28 L-15,-44 A15,15 0 0 1 15,-44 L15,-28" fill="none" stroke={C.cream} strokeWidth={4} strokeLinecap="round" />
      <Box x={-16} y={-6} z={5} w={30} d={14} h={30} color={C.butter} />
      <FrontPanel x={-3.5} y={8} z={15} w={5} h={12} color={C.ink} />
      <Box x={18} y={-26} z={6} w={6} d={20} h={4} color={C.peach} />
    </>
  );
}

function Radar() {
  const rings = [30, 21, 12];
  return (
    <>
      <Plinth size={70} color={C.cream} />
      {rings.map((r, i) => (
        <ellipse key={r} cx={0} cy={-5} rx={r * 1.2} ry={r * 0.6} fill="none" stroke={i === 0 ? shade(C.mint, 0.35) : shade(C.mint, 0.2)} strokeWidth={1.5} />
      ))}
      <path d="M0,-5 L33,-14 A36,18 0 0 0 20,-22 Z" fill={C.mint} opacity={0.75} />
      <line x1={-26} y1={-12} x2={0} y2={-5} stroke={shade(C.cream, 0.35)} strokeWidth={1.2} />
      <line x1={14} y1={3} x2={0} y2={-5} stroke={shade(C.cream, 0.35)} strokeWidth={1.2} />
      <g transform="translate(-26,-12)"><Box x={-3} y={-3} z={0} w={6} d={6} h={8} color={C.peach} /></g>
      <g transform="translate(14,3)"><Box x={-3} y={-3} z={0} w={6} d={6} h={6} color={C.butter} /></g>
      <g transform="translate(22,-22)"><Box x={-3} y={-3} z={0} w={6} d={6} h={10} color={C.blush} /></g>
      <Cylinder x={0} y={0} z={10} r={4} h={14} color={C.ink} />
    </>
  );
}

function Industrial() {
  return (
    <>
      <Plinth size={70} color={C.cream} />
      <Cylinder x={-12} y={8} z={5} r={13} h={40} color={C.sky} />
      <Box x={8} y={-22} z={5} w={20} d={20} h={22} color={C.peach} />
      <path d="M2,-42 C12,-42 14,-36 22,-34" fill="none" stroke={shade(C.cream, 0.3)} strokeWidth={6} strokeLinecap="round" />
      <path d="M2,-42 C12,-42 14,-36 22,-34" fill="none" stroke={C.cream} strokeWidth={3} strokeLinecap="round" />
      <circle cx={22} cy={-36} r={5} fill={C.butter} stroke={shade(C.butter, 0.3)} strokeWidth={1.5} />
      <FrontLine x={-22} y={8} z={30} length={6} color={C.white} width={1.6} />
    </>
  );
}

function Race() {
  return (
    <>
      <Box x={-34} y={-14} z={0} w={68} d={12} h={5} color={C.cream} />
      <Box x={-34} y={2} z={0} w={68} d={12} h={5} color={C.cream} />
      <Box x={6} y={-13} z={5} w={10} d={10} h={10} color={C.peach} />
      <Box x={-12} y={3} z={5} w={10} d={10} h={10} color={C.mint} />
      <g transform="translate(-8,-52)">
        <circle cx={0} cy={0} r={15} fill={shade(C.butter, 0.18)} />
        <circle cx={-1} cy={-1} r={13} fill={C.white} />
        <rect x={-3} y={-21} width={6} height={5} rx={1.5} fill={C.ink} />
        <line x1={-1} y1={-1} x2={-1} y2={-9} stroke={C.ink} strokeWidth={2} strokeLinecap="round" />
        <line x1={-1} y1={-1} x2={5} y2={2} stroke={C.peach} strokeWidth={2} strokeLinecap="round" />
      </g>
    </>
  );
}

function Checklist() {
  return (
    <>
      <Plinth color={C.blush} />
      <Box x={-16} y={-2} z={5} w={32} d={6} h={46} color={C.cream} />
      <Box x={-6} y={-1} z={48} w={12} d={4} h={5} color={C.ink} />
      {[38, 28, 18].map((z, i) => (
        <g key={z}>
          <FrontPanel x={-12} y={4} z={z} w={5} h={5} color={i < 2 ? C.mint : shade(C.cream, 0.2)} />
          <FrontLine x={-4} y={4} z={z + 2.5} length={14} color={shade(C.cream, 0.3)} width={1.6} />
        </g>
      ))}
    </>
  );
}

function Shield() {
  return (
    <>
      <Plinth color={C.sky} />
      <g transform="translate(0,-34)">
        <path d="M0,-24 L20,-16 L20,2 C20,14 10,22 0,26 C-10,22 -20,14 -20,2 L-20,-16 Z" fill={shade(C.peach, 0.2)} />
        <path d="M0,-24 L-20,-16 L-20,2 C-20,14 -10,22 0,26 Z" fill={C.peach} />
        <path d="M-7,1 L-2,6 L8,-5" fill="none" stroke={C.white} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  );
}

function Puzzle() {
  return (
    <>
      <Plinth color={C.cream} />
      <Box x={-18} y={-6} z={5} w={16} d={16} h={16} color={C.butter} />
      <Box x={2} y={-6} z={5} w={16} d={16} h={16} color={C.mint} />
      <Box x={-8} y={-6} z={21} w={16} d={16} h={16} color={C.peach} />
      <Box x={10} y={-26} z={5} w={12} d={12} h={12} color={C.blush} />
    </>
  );
}

function Blocks() {
  return (
    <>
      <Plinth color={C.cream} />
      <Box x={-20} y={-20} z={5} w={16} d={16} h={30} color={C.peach} />
      <Box x={4} y={-20} z={5} w={16} d={16} h={18} color={C.mint} />
      <Box x={-20} y={4} z={5} w={16} d={16} h={12} color={C.butter} />
      <Box x={4} y={4} z={5} w={16} d={16} h={22} color={C.cream} />
    </>
  );
}

const SCENES: Record<LabArtKind, () => ReactNode> = {
  server: Server,
  cloud: Cloud,
  lock: Lock,
  radar: Radar,
  industrial: Industrial,
  race: Race,
  checklist: Checklist,
  shield: Shield,
  puzzle: Puzzle,
  blocks: Blocks,
  flag: Blocks,
  rack: Server,
  railway: Industrial,
  water: Industrial,
};

export function LabArt({ kind, className }: { kind: LabArtKind; className?: string }) {
  const Scene = SCENES[kind];
  return (
    <svg viewBox="-62 -82 124 112" className={className} aria-hidden="true">
      <ellipse cx={0} cy={22} rx={52} ry={9} fill="#000" opacity={0.06} />
      <Scene />
    </svg>
  );
}
