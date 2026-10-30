import { useId, useRef, type CSSProperties } from 'react';
import { useMascotPlay } from './useMascotPlay';
import './mascot.css';

// The CyberRange mascot: the logo cube as a soft, squishy toy. It keeps the
// logo's three tones (a light top, the front, a darker right side) on a rounded
// body, with a centred face, mitten arms and stubby legs. Navy ink in the light
// theme, apricot in Ember. It does the waiting and the cheering.
//
// Seated, it perches on an edge (a form field, a card) with its legs dangling.
// Interactive, it can be poked and picked up (see useMascotPlay).

export type MascotPose = 'idle' | 'wave' | 'walk' | 'carry' | 'cheer' | 'think' | 'cover' | 'peek' | 'sleep' | 'sway';

/** Where the seat sits in the 120-unit drawing: line this up with the edge it sits on. */
export const MASCOT_SEAT = 92 / 120;

interface MascotProps {
  pose?: MascotPose;
  size?: number;
  /** Where the eyes look, -1 to 1 on each axis. */
  look?: { x: number; y: number };
  className?: string;
  label?: string;
  /** Perched on an edge, legs dangling over it. */
  seated?: boolean;
  /** Can be poked, and picked up and flung. */
  interactive?: boolean;
}

const BODY = 'M60 22 C88 22 99 29 99 57 C99 87 89 96 60 96 C31 96 21 87 21 57 C21 29 32 22 60 22 Z';

export function Mascot({ pose = 'idle', size = 96, look, className = '', label, seated = false, interactive = false }: MascotProps) {
  const id = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const { reaction, onPointerDown } = useMascotPlay(svgRef, interactive);
  const shown = reaction ?? pose;
  const modifiers = `${seated ? ' mascot--seated' : ''}${interactive ? ' mascot--interactive' : ''}`;
  const style = {
    width: size,
    height: size,
    '--look-x': `${(look?.x ?? 0) * 2.4}px`,
    '--look-y': `${(look?.y ?? 0) * 2}px`,
  } as CSSProperties;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 120 120"
      className={`mascot mascot--${shown}${modifiers} ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <clipPath id={`${id}-body`}>
          <path d={BODY} />
        </clipPath>
        <radialGradient id={`${id}-shine`} cx="0.32" cy="0.3" r="0.75">
          <stop offset="0" className="m-shine-in" />
          <stop offset="1" className="m-shine-out" />
        </radialGradient>
        {/* Arms and mittens take the body's top-left light, so they look like the
            same rounded clay instead of flat cut-outs. */}
        <linearGradient id={`${id}-arm-l`} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" className="m-arm-l-lit" />
          <stop offset="0.7" className="m-arm-l-base" />
        </linearGradient>
        <linearGradient id={`${id}-arm-r`} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" className="m-arm-r-base" />
          <stop offset="1" className="m-arm-r-rim" />
        </linearGradient>
        <radialGradient id={`${id}-mitt`} cx="0.36" cy="0.32" r="0.72">
          <stop offset="0" className="m-mitt-lit" />
          <stop offset="1" className="m-mitt-base" />
        </radialGradient>
        <radialGradient id={`${id}-mitt-shade`} cx="0.36" cy="0.32" r="0.72">
          <stop offset="0" className="m-mitt-shade-lit" />
          <stop offset="1" className="m-mitt-shade-base" />
        </radialGradient>
      </defs>

      <ellipse className="m-shadow" cx="60" cy="111" rx="30" ry="4.5" />
      <ellipse className="m-seat" cx="60" cy="92.5" rx="31" ry="2.6" />

      <g className="m-poke">
        <g className="m-rig">
          <g className="m-leg m-leg-l">
            <rect className="m-limb-fill" x="39" y="84" width="14" height="20" rx="7" />
            <ellipse className="m-limb-fill" cx="44" cy="104" rx="9" ry="5.6" />
          </g>
          <g className="m-leg m-leg-r">
            <rect className="m-limb-fill" x="67" y="84" width="14" height="20" rx="7" />
            <ellipse className="m-limb-fill" cx="76" cy="104" rx="9" ry="5.6" />
          </g>

          {/* Each arm is the colour of the face it grows from (front on the left, the
              darker side on the right) and starts inside the body, so it reads as part
              of the same soft cube rather than a piece stuck on. */}
          <g className="m-arm m-arm-l">
            <path fill={`url(#${id}-arm-l)`} d="M19.5 56 C24 56 26.5 58.5 26 63 L24 79 C23.6 82 20.8 83.5 18.5 83.5 C16 83.5 13.4 82 13.2 79 L13 63 C12.8 58.5 15 56 19.5 56 Z" />
            <ellipse fill={`url(#${id}-mitt)`} cx="18" cy="82" rx="7.2" ry="6.6" />
          </g>
          <g className="m-arm m-arm-r">
            <path fill={`url(#${id}-arm-r)`} d="M100.5 56 C96 56 93.5 58.5 94 63 L96 79 C96.4 82 99.2 83.5 101.5 83.5 C104 83.5 106.6 82 106.8 79 L107 63 C107.2 58.5 105 56 100.5 56 Z" />
            <ellipse fill={`url(#${id}-mitt-shade)`} cx="102" cy="82" rx="7.2" ry="6.6" />
          </g>

          <g className="m-carry">
            <rect className="m-carry-block" x="47" y="2" width="26" height="22" rx="7" />
            <rect className="m-carry-cap" x="47" y="2" width="26" height="8" rx="4" />
          </g>

          <g className="m-body">
            <path className="m-front" d={BODY} />
            <g clipPath={`url(#${id}-body)`}>
              <path className="m-top" d="M10 10 H110 V35 C88 41 32 41 10 35 Z" />
              <path className="m-side" d="M89 10 C94 38 94 72 88 104 H110 V10 Z" />
              <path d={BODY} fill={`url(#${id}-shine)`} />
            </g>

            <g className="m-face">
              <g className="m-eyes-open">
                <ellipse className="m-sclera" cx="47" cy="57" rx="8" ry="9.4" />
                <ellipse className="m-sclera" cx="73" cy="57" rx="8" ry="9.4" />
                <g className="m-pupils">
                  <circle className="m-pupil" cx="47.6" cy="58.6" r="5.4" />
                  <circle className="m-pupil" cx="73.6" cy="58.6" r="5.4" />
                  <circle className="m-glint" cx="49.8" cy="55.6" r="2" />
                  <circle className="m-glint" cx="75.8" cy="55.6" r="2" />
                  <circle className="m-glint" cx="45.8" cy="61.6" r="1" />
                  <circle className="m-glint" cx="71.8" cy="61.6" r="1" />
                </g>
              </g>
              <path className="m-eyes-happy" d="M40 59 Q47 50 54 59 M66 59 Q73 50 80 59" />
              <path className="m-eyes-closed" d="M40 57 Q47 63.5 54 57 M66 57 Q73 63.5 80 57" />
              <g className="m-eyes-dizzy">
                <path className="m-spiral m-spiral-l" d="M47 57 a1.2 1.2 0 0 1 2.4 0 a2.4 2.4 0 0 1 -4.8 0 a3.6 3.6 0 0 1 7.2 0 a4.8 4.8 0 0 1 -9.6 0" />
                <path className="m-spiral m-spiral-r" d="M73 57 a1.2 1.2 0 0 1 2.4 0 a2.4 2.4 0 0 1 -4.8 0 a3.6 3.6 0 0 1 7.2 0 a4.8 4.8 0 0 1 -9.6 0" />
              </g>

              <ellipse className="m-cheek" cx="35" cy="69" rx="6" ry="3.4" />
              <ellipse className="m-cheek" cx="85" cy="69" rx="6" ry="3.4" />

              <path className="m-mouth m-mouth-smile" d="M55 69 Q60 74.5 65 69" />
              <g className="m-mouth-open">
                <path className="m-mouth-fill" d="M53 68 Q60 69.6 67 68 Q66.4 78.5 60 78.5 Q53.6 78.5 53 68 Z" />
                <ellipse className="m-tongue" cx="60" cy="75.6" rx="3.6" ry="2.2" />
              </g>
              <path className="m-mouth m-mouth-flat" d="M56 71 Q60 69.6 64 71" />
            </g>
          </g>

          <g className="m-cover">
            <g className="m-cover-l">
              <rect className="m-arm-cover" x="20" y="60" width="12" height="22" rx="6" transform="rotate(-38 26 71)" />
              <ellipse fill={`url(#${id}-mitt)`} cx="46" cy="57" rx="11.4" ry="11.2" />
            </g>
            <g className="m-cover-r">
              <rect className="m-arm-cover" x="88" y="60" width="12" height="22" rx="6" transform="rotate(38 94 71)" />
              <ellipse fill={`url(#${id}-mitt)`} cx="74" cy="57" rx="11.4" ry="11.2" />
            </g>
          </g>

          <g className="m-notes">
            <g className="m-note">
              <ellipse cx="93" cy="22" rx="2.8" ry="2.1" />
              <path d="M95.6 21.6 V11 l4.6 -1.6" />
            </g>
            <g className="m-note">
              <ellipse cx="103" cy="12" rx="2.6" ry="2" />
              <path d="M105.4 11.6 V2 l4.2 -1.4 V9" />
              <ellipse cx="107.2" cy="9.4" rx="2.6" ry="2" />
            </g>
          </g>

          <g className="m-zzz">
            <path d="M94 16 h7 l-7 8 h7" />
            <path d="M104 4 h5 l-5 6 h5" />
          </g>
        </g>
      </g>

      <path className="m-heart" d="M60 18 C54 14 52.5 11.5 52.5 9.5 C52.5 7 54.5 5.5 56.5 5.5 C58 5.5 59.3 6.4 60 7.8 C60.7 6.4 62 5.5 63.5 5.5 C65.5 5.5 67.5 7 67.5 9.5 C67.5 11.5 66 14 60 18 Z" />
    </svg>
  );
}
