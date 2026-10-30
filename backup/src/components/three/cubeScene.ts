import {
  BoxGeometry,
  CanvasTexture,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  type WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CLAY, CUBE_BLOCKS } from './clay';
import { clay, compileInParallel, disposeTree, lightScene, studioEnvironment } from './world/kit';

// The CyberRange cube in clay: 27 blocks in a 3 x 3 x 3 stack.
// Logo mode (sign-in): the blocks start scattered and tumbling, snap into place
// layer by layer, and the finished cube settles with a soft squash; after that
// it breathes, a block hops now and then, and with `loop` the cube keeps
// breaking apart and joining back together. Progress mode (dashboard): one
// block per cleared module, the rest are crisp outlines of the blocks still to
// earn; blocks placed since the last visit drop in. When those new blocks finish
// a cube (a level up), the finished cube fills, spins once with a warm glow and
// lifts away, and the next level's cube builds in its place.
//
// This file knows nothing about the page, so the same scene runs in a worker
// (on an OffscreenCanvas, the usual case) or on the page itself.

export interface CubeOptions {
  mode: 'logo' | 'progress';
  filled: number;
  fresh: number;
  dark: boolean;
  /** Logo mode: "full" on the first open of a session, "quick" afterwards. */
  intro: 'full' | 'quick';
  /** Logo mode: keep breaking apart and joining back together. */
  loop: boolean;
  /** prefers-reduced-motion, read by the page (a worker cannot). */
  reduced: boolean;
  /** Progress mode: the new blocks finished a cube; `previous` blocks of it were already there. */
  levelUp: { previous: number } | null;
}

export interface CubeEvents {
  /** Every shader is compiled and the first frame is drawn. */
  ready(): void;
  assembled(): void;
  hover(over: boolean): void;
  /** The finished cube starts its celebration (fired at once under reduced motion). */
  levelUp(): void;
}

export interface CubeControl {
  /** The canvas size in CSS pixels. */
  resize(width: number, height: number): void;
  /** The pointer over the canvas, from -1 to 1 on each axis. */
  pointer(x: number, y: number): void;
  leave(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

const PALETTE = [CLAY.peach, CLAY.mint, CLAY.butter, CLAY.sky, CLAY.blush, CLAY.cream, CLAY.peach, CLAY.mint, CLAY.butter];
// Earned blocks on the dashboard skip cream, which would vanish into the plinth.
const EARNED = [CLAY.peach, CLAY.mint, CLAY.butter, CLAY.sky, CLAY.blush];
const SPACING = 1.04;

// Bottom layer first, starting from the corner nearest the camera, so every
// new block is in view as the cube is built.
function slot(index: number) {
  const y = Math.floor(index / 9);
  const inLayer = 8 - (index % 9);
  const z = Math.floor(inLayer / 3);
  const x = inLayer % 3;
  return { x: (x - 1) * SPACING, y: y * SPACING + 0.5, z: (z - 1) * SPACING };
}

function colorFor(index: number, logo: boolean) {
  // A fixed shuffle so neighbours rarely share a colour.
  const palette = logo ? PALETTE : EARNED;
  return palette[(index * 7 + Math.floor(index / 3)) % palette.length];
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp01(t), 5);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);
const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

function blobShadow(dark: boolean) {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(128, 128) : Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    // Falls off well before the rim, so the shadow never reaches the canvas edge.
    const ink = dark ? '0,0,0' : '90,60,30';
    const strength = dark ? 0.55 : 0.28;
    gradient.addColorStop(0, `rgba(${ink},${strength})`);
    gradient.addColorStop(0.45, `rgba(${ink},${strength * 0.45})`);
    gradient.addColorStop(0.8, `rgba(${ink},${strength * 0.08})`);
    gradient.addColorStop(1, `rgba(${ink},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const shadow = new Mesh(new PlaneGeometry(6.4, 6.4), new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.62;
  return shadow;
}

interface Vec { x: number; y: number; z: number }
interface Block {
  mesh: Mesh;
  home: Vec;
  from: Vec;
  spin: Vec;
  delay: number;
  duration: number;
  animate: boolean;
  /** Its place on the plate when the cube spreads out into a range of columns. */
  tile: { x: number; z: number };
  /** Column height on the plate, in block heights, and its distance from the plate's middle. */
  height: number;
  centre: number;
  spreadDelay: number;
  joinDelay: number;
}

// The cube-and-range loop, in seconds from the moment the cube is whole: the cube
// holds, its blocks spread onto a wider plate as clay columns that rise and fall
// in a slow wave, then gather back into the cube, bottom layer first.
const HOLD = 4.2;
const SPREAD = 1.25;
const RANGE = 4.6;
const GATHER = 1.25;
// On the plate each column rises out of it, rippling out from the middle,
// breathes up and down in a wave that runs outward, then sinks back to a block.
const RISE = 0.6;
const SINK = 0.5;
const WAVE = 0.6;
const SETTLE = 0.5;
const CYCLE = HOLD + SPREAD + RANGE + GATHER + SETTLE;
const GRID = 6;
const PLATE_TOP = -0.28;
const PLATE_GROWTH = 0.62;

// The plate tiles the cube's blocks land on, matched by angle so each block
// travels outward without crossing the cube.
function rangeTiles(homes: Vec[]) {
  const tiles: { x: number; z: number }[] = [];
  for (let k = 0; k < GRID * GRID; k++) {
    const cell = (k * 23 + 7) % (GRID * GRID);
    tiles.push({ x: ((cell % GRID) - (GRID - 1) / 2) * SPACING, z: (Math.floor(cell / GRID) - (GRID - 1) / 2) * SPACING });
  }
  const angle = (x: number, z: number, seed: number) => Math.atan2(z, x) + seed * 1e-3;
  const chosen = tiles.slice(0, homes.length).sort((a, b) => angle(a.x, a.z, 0) - angle(b.x, b.z, 0));
  const order = homes.map((home, i) => ({ i, a: angle(home.x, home.z, i) })).sort((a, b) => a.a - b.a);
  const assigned: { x: number; z: number }[] = new Array(homes.length);
  order.forEach(({ i }, rank) => { assigned[i] = chosen[rank]; });
  return assigned;
}

// The frame scheduler of whichever thread the cube runs on, with a timer where a
// worker has none.
const nextFrame: (callback: (now: number) => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (callback) => requestAnimationFrame(callback)
    : (callback) => setTimeout(() => callback(performance.now()), 16) as unknown as number;
const cancelFrame: (id: number) => void = typeof cancelAnimationFrame === 'function' ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

// Builds the cube on `renderer` and runs it. Nothing is drawn until every shader
// is compiled (in parallel) and the studio light is ready; then the first frame
// is drawn, `ready` fires, and the assembly starts from its first block.
export function runCubeScene(renderer: WebGLRenderer, { mode, filled, fresh, dark, intro, loop, reduced, levelUp }: CubeOptions, events: CubeEvents): CubeControl {
  let disposed = false;
  let ready = false;

  const logo = mode === 'logo';
  const quick = intro === 'quick';
  const count = logo ? CUBE_BLOCKS : Math.max(0, Math.min(CUBE_BLOCKS, filled));
  const looping = logo && loop && !reduced;
  // A level up rebuilds the whole new level, so every block of it is new.
  const celebrate = !logo && levelUp !== null && !reduced;
  const firstFresh = logo || celebrate ? 0 : Math.max(0, count - fresh);

  const scene = new Scene();
  const root = new Group();
  scene.add(root);
  const shadow = blobShadow(dark);
  root.add(shadow);

  const plinth = new Mesh(new RoundedBoxGeometry(4.1, 0.34, 4.1, 5, 0.16), clay(dark ? '#3A3029' : '#F2E9DC', 0.85));
  plinth.position.y = -0.45;
  plinth.receiveShadow = true;
  root.add(plinth);

  const cube = new Group();
  root.add(cube);
  const geometry = new RoundedBoxGeometry(0.94, 0.94, 0.94, 5, 0.16);

  const blocks: Block[] = [];
  let assembledAt = 0;

  // Level up, in seconds from the start: the finished cube's last blocks land
  // (A), it spins once with a hop and a warm glow (B to C), lifts away (C), and
  // the next level's outlines and blocks arrive (from D).
  const oldCube = new Group();
  const oldMaterials: MeshPhysicalMaterial[] = [];
  let sequence: { tB: number; tC: number; tD: number; fired: boolean } | null = null;
  if (celebrate && levelUp) {
    root.add(oldCube);
    const previous = Math.max(0, Math.min(CUBE_BLOCKS, levelUp.previous));
    const landing = CUBE_BLOCKS - previous;
    const step = Math.min(0.16, 1.6 / Math.max(1, landing));
    for (let i = 0; i < CUBE_BLOCKS; i++) {
      const home = slot(i);
      const material = clay(colorFor(i, false));
      oldMaterials.push(material);
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const animate = i >= previous;
      const from = { x: home.x, y: home.y + 3.2, z: home.z };
      const delay = 0.3 + (i - previous) * step;
      if (animate) assembledAt = Math.max(assembledAt, delay + 0.7);
      mesh.position.set(home.x, animate ? from.y : home.y, home.z);
      if (animate) mesh.scale.setScalar(0.001);
      oldCube.add(mesh);
      blocks.push({ mesh, home, from, spin: { x: 0, y: 0.6, z: 0 }, delay, duration: 0.7, animate, tile: home, height: 1, centre: 0, spreadDelay: 0, joinDelay: 0 });
    }
    const tB = (landing > 0 ? 0.3 + (landing - 1) * step + 0.7 : 0.3) + 0.15;
    const tC = tB + 1.7;
    sequence = { tB, tC, tD: tC + 0.35, fired: false };
    cube.visible = false;
  } else if (levelUp && !logo) {
    events.levelUp();
  }

  const tiles = rangeTiles(Array.from({ length: count }, (_, i) => slot(i)));
  for (let i = 0; i < count; i++) {
    const home = slot(i);
    const mesh = new Mesh(geometry, clay(colorFor(i, logo)));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const animate = !reduced && (logo || i >= firstFresh);
    const layer = Math.floor(i / 9);
    const inLayer = i % 9;
    let from: Vec;
    let spin: Vec;
    let delay: number;
    let duration: number;
    if (logo) {
      // Scattered on a wide shell around the cube, tumbling as they come in.
      const angle = i * 2.399 + layer * 0.7;
      const radius = (quick ? 4.2 : 6.5) + (i % 4) * 0.6;
      from = { x: Math.cos(angle) * radius, y: home.y + (quick ? 1.5 : 2.4) + ((i * 37) % 7) * 0.35 - 1, z: Math.sin(angle) * radius };
      spin = { x: ((i % 3) - 1) * Math.PI, y: (i % 2 ? 1 : -1) * Math.PI * 1.5, z: ((i % 5) - 2) * 0.6 };
      delay = quick ? 0.05 + layer * 0.08 + inLayer * 0.012 : 0.15 + layer * 0.28 + inLayer * 0.032;
      duration = quick ? 0.6 : 0.95;
    } else {
      from = { x: home.x, y: home.y + 3.2, z: home.z };
      spin = { x: 0, y: 0.6, z: 0 };
      delay = (sequence ? sequence.tD + 0.25 : 0.35) + (i - firstFresh) * 0.22;
      duration = 0.85;
    }
    if (animate) assembledAt = Math.max(assembledAt, delay + duration);
    mesh.position.set(animate ? from.x : home.x, animate ? from.y : home.y, animate ? from.z : home.z);
    if (animate) mesh.scale.setScalar(logo ? 0.85 : 0.001);
    cube.add(mesh);
    // On the plate the columns stand taller towards the middle, like a skyline.
    const tile = tiles[i];
    const centre = Math.hypot(tile.x, tile.z);
    // Heights come in half-block steps, so the skyline reads as built, not random.
    const height = Math.round((0.9 + 1.8 * Math.max(0, 1 - centre / 3.6) + ((i * 37) % 5) * 0.1) * 2) / 2;
    const spreadDelay = (2 - layer) * 0.1 + inLayer * 0.014;
    const joinDelay = layer * 0.09 + inLayer * 0.022;
    blocks.push({ mesh, home, from, spin, delay, duration, animate, tile, height, centre, spreadDelay, joinDelay });
  }

  // The blocks still to place: crisp clay-ink outlines with a whisper of fill,
  // so the cube to build reads as a shape, not as fog.
  const slotEdges = new EdgesGeometry(new BoxGeometry(0.9, 0.9, 0.9));
  const slotLines = new LineBasicMaterial({ color: dark ? '#E9DCCB' : '#A8927A', transparent: true, opacity: dark ? 0.34 : 0.42 });
  const ghostOpacity = dark ? 0.05 : 0.12;
  const lineOpacity = slotLines.opacity;
  let ghost: MeshPhysicalMaterial | null = null;
  if (!logo) {
    ghost = new MeshPhysicalMaterial({
      color: dark ? '#E9DCCB' : '#E2D5C3',
      transparent: true,
      opacity: ghostOpacity,
      roughness: 0.2,
      depthWrite: false,
    });
    if (sequence) {
      ghost.opacity = 0;
      slotLines.opacity = 0;
    }
    for (let i = count; i < CUBE_BLOCKS; i++) {
      const home = slot(i);
      const mesh = new Mesh(geometry, ghost);
      mesh.position.set(home.x, home.y, home.z);
      mesh.scale.setScalar(0.88);
      cube.add(mesh);
      const outline = new LineSegments(slotEdges, slotLines);
      outline.position.set(home.x, home.y, home.z);
      cube.add(outline);
    }
  }

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  let size = { w: 0, h: 0 };
  // How far the scene has spread into the range, 0 (cube) to 1 (range); the
  // camera eases out to keep the wider plate in frame.
  let spread = 0;
  const frameCamera = () => {
    const { w, h } = size;
    if (!w || !h) return;
    // The dashboard shows the cube smaller so the level card has room beside it.
    // The looping logo is framed on the cube and plate, and eases out for the range.
    const extent = logo ? (looping ? 2.98 + 0.82 * spread : 2.75) : 3.9;
    const look = looping ? 1.05 - 0.48 * spread : 1.05;
    const aspect = w / h;
    camera.left = aspect >= 1 ? -extent * aspect : -extent;
    camera.right = aspect >= 1 ? extent * aspect : extent;
    camera.top = aspect >= 1 ? extent : extent / aspect;
    camera.bottom = aspect >= 1 ? -extent : -extent / aspect;
    camera.position.set(10, 7.15 + look, 10);
    camera.lookAt(0, look, 0);
    camera.updateProjectionMatrix();
  };
  frameCamera();

  const resize = (w: number, h: number) => {
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    size = { w, h };
    frameCamera();
    if (ready) renderer.render(scene, camera);
  };

  const pointer = { x: 0, y: 0, inside: false };
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  let hovering = false;

  if (reduced || assembledAt === 0) events.assembled();
  let announced = reduced || assembledAt === 0;

  // Set when the cube is ready to draw, so the assembly plays from its start.
  let start = 0;
  let frame = 0;
  let running = false;
  let visible = true;
  let yaw = 0;
  let pitch = 0;
  let hop = { index: -1, at: -10 };
  // Only top-layer blocks hop; a lower block would jump into the one above it.
  const hoppers = [18, 19, 20, 21, 22, 23, 24, 25, 26];

  const tick = (now: number) => {
    const t = (now - start) / 1000;
    let busy = !reduced;

    blocks.forEach((block, i) => {
      const p = block.animate ? Math.min(1, Math.max(0, (t - block.delay) / block.duration)) : 1;
      if (p < 1) busy = true;
      const e = block.animate ? easeOutQuint(p) : 1;
      const settle = easeOutCubic(p * 1.15);
      let y = block.from.y + (block.home.y - block.from.y) * e;
      let spinY = block.animate ? block.spin.y * (1 - settle) : 0;
      if (i === hop.index) {
        const h = (t - hop.at) / 0.7;
        if (h < 1) {
          y += Math.sin(h * Math.PI) * 0.45;
          spinY = h * Math.PI * 0.5;
        }
      }
      block.mesh.position.set(
        block.from.x + (block.home.x - block.from.x) * e,
        y,
        block.from.z + (block.home.z - block.from.z) * e,
      );
      block.mesh.rotation.set(block.animate ? block.spin.x * (1 - settle) : 0, spinY, block.animate ? block.spin.z * (1 - settle) : 0);
      if (block.animate) {
        block.mesh.scale.setScalar(logo ? 0.85 + 0.15 * settle : Math.max(0.001, Math.min(1, p * 2.2)));
      }

      // Spread onto the plate as a column, rise and fall with the wave, then gather back.
      if (looping && p >= 1 && t > assembledAt) {
        const c = (t - assembledAt) % CYCLE;
        let k = 0;
        if (c >= HOLD && c < HOLD + SPREAD) k = easeInOutCubic((c - HOLD - block.spreadDelay) / (SPREAD - 0.35));
        else if (c >= HOLD + SPREAD && c < HOLD + SPREAD + RANGE) k = 1;
        else if (c >= HOLD + SPREAD + RANGE && c < HOLD + SPREAD + RANGE + GATHER) {
          k = 1 - easeInOutCubic((c - HOLD - SPREAD - RANGE - block.joinDelay) / (GATHER - 0.4));
        }
        if (k > 0) {
          // Flying, the block stays a block; landed, it rises into its column.
          let rise = 0;
          const onPlate = c - HOLD - SPREAD;
          if (onPlate >= 0 && onPlate < RANGE) {
            const up = easeOutCubic((onPlate - block.centre * 0.12) / RISE);
            const down = 1 - easeInOutCubic((onPlate - (RANGE - SINK - 0.25) - block.centre * 0.05) / SINK);
            rise = Math.min(up, down);
          }
          const wave = WAVE * (0.5 + 0.5 * Math.sin(t * 1.7 - block.centre * 1.2));
          const columnHeight = 1 + (block.height + wave - 1) * rise;
          const arc = Math.sin(k * Math.PI) * 0.75;
          block.mesh.position.set(
            block.home.x + (block.tile.x - block.home.x) * k,
            block.home.y + (PLATE_TOP + 0.47 - block.home.y) * k + 0.47 * (columnHeight - 1) + arc,
            block.home.z + (block.tile.z - block.home.z) * k,
          );
          block.mesh.rotation.set(0, Math.sin(k * Math.PI) * 0.5, 0);
          block.mesh.scale.set(1, columnHeight, 1);
        } else {
          block.mesh.scale.setScalar(1);
        }
      }
    });

    if (sequence) {
      const { tB, tC, tD } = sequence;
      if (t >= tB && !sequence.fired) {
        sequence.fired = true;
        events.levelUp();
      }
      if (t >= tB && t < tC) {
        const u = (t - tB) / (tC - tB);
        oldCube.rotation.y = Math.PI * 2 * easeInOutCubic(u);
        oldCube.position.y = Math.sin(u * Math.PI) * 0.5;
        const glowAmount = Math.sin(u * Math.PI) * 0.45;
        oldMaterials.forEach((material) => {
          material.emissive.copy(material.color);
          material.emissiveIntensity = glowAmount;
        });
      } else if (t >= tC && oldCube.visible) {
        const v = easeInCubic((t - tC) / 0.7);
        oldCube.position.y = v * 1.1;
        oldCube.scale.setScalar(Math.max(0.001, 1 - v));
        oldMaterials.forEach((material) => {
          material.emissiveIntensity = 0;
        });
        if (v >= 1) oldCube.visible = false;
      }
      if (t >= tD) {
        cube.visible = true;
        const w = clamp01((t - tD) / 0.5);
        if (ghost) ghost.opacity = ghostOpacity * w;
        slotLines.opacity = lineOpacity * w;
      }
      if (t < assembledAt + 0.6) busy = true;
    }

    // The plate widens under the range and narrows back as the cube gathers.
    if (looping && t > assembledAt) {
      const c = (t - assembledAt) % CYCLE;
      let next = 0;
      if (c >= HOLD && c < HOLD + SPREAD) next = easeInOutCubic((c - HOLD) / SPREAD);
      else if (c >= HOLD + SPREAD && c < HOLD + SPREAD + RANGE) next = 1;
      else if (c >= HOLD + SPREAD + RANGE && c < HOLD + SPREAD + RANGE + GATHER) {
        next = 1 - easeInOutCubic((c - HOLD - SPREAD - RANGE) / GATHER);
      }
      if (next !== spread) {
        spread = next;
        plinth.scale.set(1 + PLATE_GROWTH * spread, 1, 1 + PLATE_GROWTH * spread);
        shadow.scale.setScalar(1 + 0.3 * spread);
        frameCamera();
      }
    }

    // Each join lands with the same soft squash as the first assembly.
    if (looping && t > assembledAt) {
      const c = (t - assembledAt) % CYCLE;
      const land = HOLD + SPREAD + RANGE + GATHER;
      if (c >= land && c < land + SETTLE) {
        const u = (c - land) / SETTLE;
        const squash = Math.sin(u * Math.PI * 2) * (1 - u) * 0.06;
        cube.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      }
    }

    // The finished cube lands with a soft squash, then tells the page.
    if (!reduced && assembledAt > 0 && t >= assembledAt) {
      const u = (t - assembledAt) / 0.5;
      if (u < 1) {
        const squash = Math.sin(u * Math.PI * 2) * (1 - u) * 0.07;
        cube.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
        busy = true;
      }
      if (!announced) {
        announced = true;
        events.assembled();
      }
    }

    // Once assembled, a visible block hops every few seconds.
    const inHold = !looping || (t - assembledAt) % CYCLE < HOLD - 0.9;
    if (!reduced && logo && inHold && t > assembledAt + 1.2 && t - hop.at > 3.4) {
      hop = { index: hoppers[Math.floor((t * 13.7) % hoppers.length)], at: t };
    }

    const breathe = reduced ? 0 : Math.sin(t * 0.9) * 0.05;
    cube.position.y = breathe;
    const targetYaw = reduced ? 0 : pointer.inside ? pointer.x * 0.35 : Math.sin(t * 0.25) * 0.22;
    const targetPitch = reduced ? 0 : pointer.inside ? pointer.y * 0.06 : 0;
    yaw += (targetYaw - yaw) * 0.05;
    pitch += (targetPitch - pitch) * 0.05;
    root.rotation.y = yaw;
    root.rotation.x = pitch;
    const settling = looping && t > assembledAt && (t - assembledAt) % CYCLE >= HOLD + SPREAD + RANGE + GATHER;
    if ((t > assembledAt + 0.5 || reduced) && !settling) {
      const targetScale = hovering ? 1.035 : 1;
      cube.scale.setScalar(cube.scale.x + (targetScale - cube.scale.x) * 0.15);
    }

    renderer.render(scene, camera);
    if (busy && visible) frame = nextFrame(tick);
    else running = false;
  };

  function wake() {
    if (!ready || running || !visible) return;
    running = true;
    frame = nextFrame(tick);
  }

  // Light the scene and compile every shader without blocking, then draw the
  // first frame and start.
  void (async () => {
    const environment = await studioEnvironment(renderer);
    if (disposed) return;
    lightScene(scene, environment, dark, 6);
    await compileInParallel(renderer, scene, camera);
    if (disposed) return;
    ready = true;
    start = performance.now();
    running = true;
    tick(start);
    events.ready();
  })();

  return {
    resize,
    pointer(x, y) {
      pointer.x = x;
      pointer.y = y;
      pointer.inside = true;
      ndc.set(x, -y);
      raycaster.setFromCamera(ndc, camera);
      const over = raycaster.intersectObject(cube, true).length > 0;
      if (over !== hovering) {
        hovering = over;
        events.hover(over);
      }
      wake();
    },
    leave() {
      pointer.inside = false;
      if (hovering) events.hover(false);
      hovering = false;
    },
    setVisible(next) {
      visible = next;
      if (visible) wake();
    },
    dispose() {
      disposed = true;
      cancelFrame(frame);
      geometry.dispose();
      slotEdges.dispose();
      slotLines.dispose();
      disposeTree(scene);
    },
  };
}
