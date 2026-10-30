import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { LabArtKind } from '../../../utils/labArtKind';
import { CLAY } from '../clay';
import { PLINTH_TOP as PT, block, cylinder, glow, mesh, mixHex } from './kit';

// One small clay scene per kind of lab, each standing on a 4 x 4 plinth. Every
// scene also knows how to move: LEDs blink, the train runs, water drips. The
// still card art renders a scene at t = 0; the live range calls animate().

export interface Diorama {
  group: Group;
  animate: (t: number) => void;
}

interface Build {
  group: Group;
  dark: boolean;
  add: (...objects: Object3D[]) => void;
  on: (step: (t: number) => void) => void;
}

const wave = (t: number, speed = 1, phase = 0) => Math.sin(t * speed + phase);

function plinth(b: Build, color: string) {
  const m = block(4, PT, 4, b.dark ? mixHex(color, '#2B241F', 0.62) : color, 0, 0, 0, 0.14);
  m.castShadow = false;
  b.add(m);
}

function server(b: Build) {
  plinth(b, CLAY.peach);
  b.add(block(1.5, 2.6, 1.5, CLAY.cream, -0.2, PT, 0.1, 0.14));
  const front = 0.1 + 0.75 + 0.02;
  b.add(block(1.08, 1.05, 0.05, CLAY.ink, -0.2, PT + 1.35, front, 0.03));
  const lines: [number, string, number][] = [[0.55, CLAY.mint, 2.15], [0.8, CLAY.white, 1.95], [0.35, CLAY.peach, 1.75]];
  lines.forEach(([w, color, y]) => b.add(block(w, 0.07, 0.03, color, -0.2 - (0.8 - w) / 2, PT + y - 0.04, front + 0.03, 0.02)));
  const cursor = block(0.1, 0.09, 0.03, CLAY.mint, 0.12, PT + 1.71, front + 0.03, 0.02);
  glow(cursor, CLAY.mint, 0.6);
  b.add(cursor);
  [0.55, 0.8].forEach((y) => b.add(block(1.08, 0.07, 0.03, '#E3DCD0', -0.2, PT + y, front, 0.02)));
  const cube = block(0.5, 0.5, 0.5, CLAY.mint, 1.25, 1.9, -1.0, 0.1);
  b.add(cube);
  b.on((t) => {
    cursor.visible = Math.floor(t * 1.6) % 2 === 0;
    cube.position.y = 2.15 + wave(t, 1.6) * 0.12;
    cube.rotation.y = t * 0.6;
  });
}

function rack(b: Build) {
  plinth(b, CLAY.sky);
  b.add(block(1.7, 2.9, 1.5, '#E9E2D6', 0, PT, 0, 0.14));
  const front = 0.75 + 0.02;
  const leds: { material: MeshStandardMaterial; phase: number; fast: boolean }[] = [];
  [0.45, 1.15, 1.85].forEach((y, i) => {
    b.add(block(1.45, 0.55, 0.06, CLAY.cream, 0, PT + y, front, 0.05));
    b.add(block(0.75, 0.07, 0.03, '#D9D0C2', -0.2, PT + y + 0.24, front + 0.05, 0.02));
    [0, 1].forEach((j) => {
      const fast = i === 1 && j === 0;
      const led = mesh(new SphereGeometry(0.06, 16, 12), fast ? CLAY.peach : CLAY.mint, 0.3);
      led.position.set(0.5 - j * 0.18, PT + y + 0.28, front + 0.07);
      leds.push({ material: glow(led, fast ? '#FF9C66' : '#5FD3A8', 0.7), phase: i * 1.7 + j, fast });
      b.add(led);
    });
  });
  b.add(block(1.45, 0.3, 0.06, CLAY.ink, 0, PT + 2.5, front, 0.04));
  b.add(block(0.55, 0.55, 0.55, CLAY.butter, 1.35, PT, -1.2, 0.1));
  b.on((t) => {
    leds.forEach((led) => {
      led.material.emissiveIntensity = led.fast
        ? (Math.floor(t * 5 + led.phase) % 3 === 0 ? 0.05 : 1.1)
        : 0.45 + 0.45 * Math.max(0, wave(t, 2.2, led.phase));
    });
  });
}

function railway(b: Build) {
  plinth(b, CLAY.cream);
  for (let i = -3; i <= 3; i++) b.add(block(0.32, 0.08, 1.6, '#D9C7B0', i * 0.52, PT, 0.4, 0.03));
  b.add(block(3.6, 0.1, 0.1, '#BFC5CF', 0, PT + 0.08, -0.05, 0.03));
  b.add(block(3.6, 0.1, 0.1, '#BFC5CF', 0, PT + 0.08, 0.85, 0.03));
  b.add(cylinder(0.07, 1.45, CLAY.ink, -1.2, PT, -1.1));
  b.add(block(0.5, 0.85, 0.32, CLAY.ink, -1.2, PT + 1.35, -1.1, 0.08));
  const lamps = ([[CLAY.peach, 1.98, '#FF8A5C'], [CLAY.mint, 1.65, '#4FD39E']] as const).map(([color, y, light]) => {
    const lamp = mesh(new SphereGeometry(0.11, 18, 12), color, 0.25);
    lamp.position.set(-1.2, PT + y, -0.92);
    b.add(lamp);
    return glow(lamp, light, 0.2);
  });
  const train = new Group();
  train.add(block(0.9, 0.55, 0.55, CLAY.butter, 0.45, PT + 0.18, 0, 0.14));
  train.add(block(0.55, 0.45, 0.55, CLAY.blush, -0.4, PT + 0.18, 0, 0.14));
  train.add(block(0.3, 0.12, 0.42, CLAY.ink, 0.62, PT + 0.73, 0, 0.05));
  train.position.z = 0.4;
  b.add(train);
  b.on((t) => {
    const s = wave(t, 0.55);
    train.position.x = s * 1.05;
    const heading = Math.cos(t * 0.55) > 0;
    lamps[0].emissiveIntensity = heading ? 0.15 : 1.0;
    lamps[1].emissiveIntensity = heading ? 1.0 : 0.15;
  });
}

function water(b: Build) {
  plinth(b, CLAY.sky);
  b.add(cylinder(0.7, 1.7, CLAY.cream, -0.8, PT, -0.5));
  const lid = mesh(new SphereGeometry(0.7, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), CLAY.cream);
  lid.position.set(-0.8, PT + 1.7, -0.5);
  b.add(lid);
  const basin = mesh(new CylinderGeometry(0.95, 0.95, 0.45, 48), '#E9E2D6');
  basin.position.set(0.75, PT + 0.225, 0.6);
  b.add(basin);
  const surface = mesh(new CylinderGeometry(0.82, 0.82, 0.04, 48), '#8FCBEA', 0.15);
  surface.position.set(0.75, PT + 0.44, 0.6);
  b.add(surface);
  const pipe = mesh(new CylinderGeometry(0.09, 0.09, 1.3, 20), '#E9E2D6', 0.35);
  pipe.rotation.set(Math.PI / 2, 0, -0.85);
  pipe.position.set(0.0, PT + 0.75, 0.05);
  b.add(pipe);
  const drop = mesh(new SphereGeometry(0.14, 20, 16), '#8FCBEA', 0.2);
  drop.scale.y = 1.25;
  drop.position.set(0.75, PT + 1.25, 0.6);
  b.add(drop);
  const rippleMaterial = new MeshStandardMaterial({ color: '#E8F5FC', transparent: true, opacity: 0 });
  const ripple = new Mesh(new TorusGeometry(0.2, 0.025, 8, 48), rippleMaterial);
  ripple.rotation.x = Math.PI / 2;
  ripple.position.set(0.75, PT + 0.47, 0.6);
  b.add(ripple);
  b.on((t) => {
    const cycle = (t % 1.8) / 1.8;
    const fall = Math.min(1, cycle / 0.55);
    drop.position.y = PT + 1.25 - fall * fall * 0.8;
    drop.visible = cycle < 0.55;
    const spread = Math.max(0, (cycle - 0.55) / 0.45);
    ripple.scale.setScalar(1 + spread * 2.6);
    rippleMaterial.opacity = cycle >= 0.55 ? 0.7 * (1 - spread) : 0;
  });
}

function cloud(b: Build) {
  plinth(b, CLAY.mint);
  b.add(block(1.0, 1.2, 1.0, CLAY.cream, -0.85, PT, 0.75));
  b.add(block(1.0, 1.7, 1.0, CLAY.cream, 0.75, PT, -0.75));
  b.add(block(0.6, 0.07, 0.03, CLAY.mint, -0.85, PT + 0.85, 1.27, 0.02));
  b.add(block(0.6, 0.07, 0.03, CLAY.mint, 0.75, PT + 1.3, -0.23, 0.02));
  const puffs = new Group();
  const shapes: [number, number, number, number][] = [
    [-0.55, 2.75, 0.1, 0.48], [0.1, 3.0, -0.05, 0.62], [0.75, 2.78, 0.05, 0.45], [0.15, 2.65, 0.42, 0.44], [-0.1, 2.68, -0.45, 0.42],
  ];
  shapes.forEach(([x, y, z, r]) => {
    const puff = mesh(new SphereGeometry(r, 32, 24), CLAY.white, 0.75);
    puff.position.set(x, y, z);
    puff.scale.y = 0.85;
    puffs.add(puff);
  });
  b.add(puffs);
  const packet = block(0.18, 0.18, 0.18, CLAY.peach, -0.85, PT + 1.2, 0.75, 0.05);
  glow(packet, '#FFB088', 0.5);
  b.add(packet);
  b.on((t) => {
    puffs.position.y = wave(t, 0.9) * 0.08;
    puffs.rotation.y = wave(t, 0.3) * 0.08;
    const p = (t % 2.2) / 2.2;
    packet.position.set(-0.85 + p * 0.8, PT + 1.3 + p * 1.25, 0.75 - p * 0.75);
    packet.scale.setScalar(p > 0.85 ? (1 - p) / 0.15 : 1);
    packet.rotation.y = t * 2;
  });
}

function lock(b: Build) {
  plinth(b, CLAY.butter);
  const top = new Group();
  const shackle = mesh(new TorusGeometry(0.55, 0.14, 20, 48, Math.PI), '#E9E2D6', 0.35);
  shackle.position.set(0, PT + 1.65, 0);
  top.add(shackle, cylinder(0.14, 0.5, '#E9E2D6', -0.55, PT + 1.2), cylinder(0.14, 0.5, '#E9E2D6', 0.55, PT + 1.2));
  b.add(top);
  b.add(block(1.9, 1.45, 1.0, CLAY.butter, 0, PT, 0, 0.16));
  const keyhole = mesh(new CylinderGeometry(0.13, 0.13, 0.05, 32), CLAY.ink);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(0, PT + 0.85, 0.52);
  const keyGlow = glow(keyhole, '#FFC94D', 0);
  b.add(keyhole, block(0.1, 0.3, 0.05, CLAY.ink, 0, PT + 0.5, 0.52, 0.02));
  b.on((t) => {
    const open = Math.max(0, wave(t, 0.8));
    top.position.y = open * 0.28;
    top.rotation.y = open * 0.5;
    keyGlow.emissiveIntensity = open * 0.9;
  });
}

function radar(b: Build) {
  plinth(b, CLAY.cream);
  [1.55, 1.05, 0.55].forEach((r) => {
    const ring = mesh(new TorusGeometry(r, 0.035, 12, 96), '#7FCDB0');
    ring.rotation.x = Math.PI / 2;
    ring.position.y = PT + 0.02;
    ring.castShadow = false;
    b.add(ring);
  });
  const sweep = new Mesh(
    new CircleGeometry(1.55, 48, 0, 0.9),
    new MeshStandardMaterial({ color: CLAY.mint, transparent: true, opacity: 0.6, side: DoubleSide }),
  );
  sweep.rotation.x = -Math.PI / 2;
  sweep.position.y = PT + 0.015;
  b.add(sweep);
  b.add(cylinder(0.32, 0.22, '#E9E2D6'));
  const head = new Group();
  head.add(cylinder(0.1, 0.75, CLAY.ink, 0, PT + 0.22));
  const dish = mesh(new SphereGeometry(0.85, 48, 24, 0, Math.PI * 2, 0, Math.PI / 3.2), CLAY.white, 0.35);
  (dish.material as MeshStandardMaterial).side = DoubleSide;
  dish.rotation.set(Math.PI * 0.78, 0, -0.5);
  dish.position.set(0, PT + 1.2, 0);
  const feed = mesh(new SphereGeometry(0.1, 20, 12), CLAY.peach);
  feed.position.set(0.25, PT + 1.55, 0.3);
  head.add(dish, feed);
  b.add(head);
  const blips = ([[1.0, 0.75, CLAY.peach, 0.32], [-1.25, -0.35, CLAY.butter, 0.45], [0.35, -1.45, CLAY.blush, 0.25]] as const).map(
    ([x, z, color, h]) => {
      const blip = block(0.32, h, 0.32, color, x, PT, z);
      b.add(blip);
      return { blip, angle: Math.atan2(-z, x), h };
    },
  );
  b.on((t) => {
    const angle = t * 1.1;
    sweep.rotation.z = angle - 0.3;
    head.rotation.y = -angle * 0.5;
    blips.forEach(({ blip, angle: at, h }) => {
      const lag = (((angle - at) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const ping = Math.max(0, 1 - lag / 1.2);
      blip.scale.y = 1 + ping * 0.8;
      blip.position.y = PT + (h * blip.scale.y) / 2;
    });
  });
}

function industrial(b: Build) {
  plinth(b, CLAY.cream);
  b.add(cylinder(0.75, 2.0, CLAY.sky, -0.7, PT, 0.35));
  const dome = mesh(new SphereGeometry(0.75, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), CLAY.sky);
  dome.position.set(-0.7, PT + 2.0, 0.35);
  b.add(dome);
  [0.6, 1.4].forEach((y) => {
    const band = mesh(new TorusGeometry(0.76, 0.04, 12, 64), '#9CC9EA');
    band.rotation.x = Math.PI / 2;
    band.position.set(-0.7, PT + y, 0.35);
    b.add(band);
  });
  b.add(block(1.1, 1.1, 1.1, CLAY.peach, 1.05, PT, 0.35, 0.12));
  const pipe = mesh(new CylinderGeometry(0.11, 0.11, 0.6, 24), '#E9E2D6', 0.35);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0.25, PT + 0.75, 0.35);
  b.add(pipe);
  const pivot = new Group();
  pivot.position.set(0.25, PT + 1.02, 0.35);
  pivot.rotation.y = Math.PI / 2;
  const valve = mesh(new TorusGeometry(0.2, 0.05, 12, 32), CLAY.butter, 0.4);
  valve.add(block(0.36, 0.05, 0.05, CLAY.butter, 0, -0.025, 0, 0.02));
  pivot.add(valve);
  b.add(pivot, cylinder(0.04, 0.2, CLAY.butter, 0.25, PT + 0.82, 0.35));
  const steam = mesh(new SphereGeometry(0.16, 20, 14), CLAY.white, 0.8);
  b.add(steam);
  b.on((t) => {
    valve.rotation.z = t * 1.4;
    const p = (t % 2.4) / 2.4;
    steam.position.set(-0.7 + p * 0.3, PT + 2.7 + p * 0.9, 0.35);
    steam.scale.setScalar(0.6 + p * 0.9);
    steam.visible = p < 0.92;
  });
}

function race(b: Build) {
  plinth(b, CLAY.cream);
  b.add(block(3.6, 0.1, 1.0, '#E9DFD0', 0, PT, -0.65, 0.04));
  b.add(block(3.6, 0.1, 1.0, '#E9DFD0', 0, PT, 0.65, 0.04));
  b.add(block(0.14, 0.12, 2.3, CLAY.ink, 1.5, PT, 0, 0.03));
  const runnerA = block(0.75, 0.75, 0.75, CLAY.peach, 0.85, PT + 0.1, -0.65, 0.14);
  const runnerB = block(0.75, 0.75, 0.75, CLAY.mint, -0.35, PT + 0.1, 0.65, 0.14);
  b.add(runnerA, runnerB);
  const watch = new Group();
  const rim = mesh(new CylinderGeometry(0.62, 0.62, 0.2, 48), CLAY.butter, 0.4);
  rim.rotation.x = Math.PI / 2;
  const face = mesh(new CylinderGeometry(0.52, 0.52, 0.06, 48), CLAY.white, 0.5);
  face.rotation.x = Math.PI / 2;
  face.position.z = 0.09;
  const crown = mesh(new CylinderGeometry(0.1, 0.1, 0.2, 20), CLAY.ink);
  crown.position.y = 0.72;
  const minute = new Group();
  const hand = mesh(new RoundedBoxGeometry(0.06, 0.38, 0.03, 2, 0.015), CLAY.ink);
  hand.position.set(0, 0.16, 0.13);
  minute.add(hand);
  const second = new Group();
  const hand2 = mesh(new RoundedBoxGeometry(0.05, 0.3, 0.03, 2, 0.015), CLAY.peach);
  hand2.position.set(0, 0.12, 0.15);
  second.add(hand2);
  second.rotation.z = -1.1;
  watch.add(rim, face, crown, minute, second);
  watch.scale.setScalar(1.25);
  watch.position.set(-0.9, 2.15, -0.9);
  watch.rotation.y = Math.PI / 4;
  b.add(watch);
  b.on((t) => {
    second.rotation.z = -t * 2.4;
    minute.rotation.z = -t * 0.2;
    runnerA.position.x = 0.3 + wave(t, 1.3) * 0.55;
    runnerB.position.x = 0.1 + wave(t, 1.3, 1.4) * 0.55;
    watch.position.y = 2.15 + wave(t, 1.1) * 0.06;
  });
}

function checklist(b: Build) {
  plinth(b, CLAY.blush);
  b.add(block(1.9, 2.5, 0.16, CLAY.cream, 0, PT, 0, 0.06));
  b.add(block(0.75, 0.28, 0.24, CLAY.ink, 0, PT + 2.38, 0, 0.06));
  const boxes = ([[1.85, CLAY.mint], [1.3, CLAY.mint], [0.75, '#E3DCD0']] as const).map(([y, color]) => {
    const box = block(0.26, 0.26, 0.06, color, -0.55, PT + y, 0.1, 0.04);
    b.add(box, block(0.75, 0.08, 0.03, '#E3DCD0', 0.15, PT + y + 0.09, 0.09, 0.02));
    return box;
  });
  b.on((t) => {
    boxes.forEach((box, i) => {
      const p = ((t * 0.8 - i * 0.35) % 2.4 + 2.4) % 2.4;
      box.scale.setScalar(p < 0.3 ? 1 + Math.sin((p / 0.3) * Math.PI) * 0.35 : 1);
    });
  });
}

function shield(b: Build) {
  plinth(b, CLAY.sky);
  const shape = new Shape();
  shape.moveTo(0, 1.25);
  shape.lineTo(0.95, 0.9);
  shape.lineTo(0.95, 0.1);
  shape.bezierCurveTo(0.95, -0.55, 0.45, -0.95, 0, -1.2);
  shape.bezierCurveTo(-0.45, -0.95, -0.95, -0.55, -0.95, 0.1);
  shape.lineTo(-0.95, 0.9);
  shape.closePath();
  const crest = new Group();
  const body = mesh(
    new ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 8, curveSegments: 40 }),
    CLAY.peach,
  );
  body.position.set(0, 0, -0.15);
  const tickA = mesh(new RoundedBoxGeometry(0.16, 0.42, 0.1, 2, 0.05), CLAY.white);
  tickA.rotation.z = 0.75;
  tickA.position.set(-0.17, -0.1, 0.27);
  const tickB = mesh(new RoundedBoxGeometry(0.16, 0.75, 0.1, 2, 0.05), CLAY.white);
  tickB.rotation.z = -0.65;
  tickB.position.set(0.15, 0.07, 0.27);
  crest.add(body, tickA, tickB);
  crest.position.y = PT + 1.65;
  b.add(crest, block(0.9, 0.18, 0.6, '#9CC9EA', 0, PT, 0, 0.06));
  b.on((t) => {
    crest.position.y = PT + 1.65 + wave(t, 1.2) * 0.1;
    crest.rotation.y = wave(t, 0.6) * 0.35;
  });
}

function puzzle(b: Build) {
  plinth(b, CLAY.cream);
  b.add(block(0.95, 0.95, 0.95, CLAY.butter, -0.55, PT, 0.5));
  b.add(block(0.95, 0.95, 0.95, CLAY.mint, 0.5, PT, 0.5));
  b.add(block(0.95, 0.95, 0.95, CLAY.sky, 0.5, PT, -0.55));
  const topper = block(0.95, 0.95, 0.95, CLAY.peach, 0, PT + 0.95, 0.0);
  b.add(topper, block(0.6, 0.6, 0.6, CLAY.blush, -1.1, PT, -1.1));
  b.on((t) => {
    const hop = Math.abs(wave(t, 1.6));
    topper.position.y = PT + 0.95 + 0.475 + hop * 0.35;
    topper.rotation.y = Math.floor(t * 1.6 / Math.PI) * (Math.PI / 2);
  });
}

function blocks(b: Build) {
  plinth(b, CLAY.cream);
  const columns = ([[1.9, CLAY.peach, -0.6, -0.6], [1.2, CLAY.mint, 0.6, -0.6], [0.8, CLAY.butter, -0.6, 0.6], [1.45, CLAY.cream, 0.6, 0.6]] as const).map(
    ([h, color, x, z]) => {
      const column = block(0.95, h, 0.95, color, x, PT, z);
      b.add(column);
      return { column, h };
    },
  );
  b.on((t) => {
    columns.forEach(({ column, h }, i) => {
      const s = 1 + wave(t, 1.1, i * 1.3) * 0.12;
      column.scale.y = s;
      column.position.y = PT + (h * s) / 2;
    });
  });
}

function flag(b: Build) {
  plinth(b, CLAY.mint);
  b.add(block(3.0, 0.45, 3.0, CLAY.cream, 0, PT, 0, 0.1));
  b.add(block(2.1, 0.45, 2.1, '#EFE7DB', 0, PT + 0.45, 0, 0.1));
  b.add(block(1.2, 0.45, 1.2, CLAY.cream, 0, PT + 0.9, 0, 0.1));
  b.add(cylinder(0.05, 1.45, CLAY.ink, 0, PT + 1.35));
  const banner = new Shape();
  banner.moveTo(0, 0);
  banner.lineTo(1.05, -0.28);
  banner.lineTo(0, -0.58);
  banner.closePath();
  const cloth = mesh(new ExtrudeGeometry(banner, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), CLAY.peach);
  cloth.rotation.y = Math.PI / 4;
  cloth.position.set(0, PT + 2.75, 0);
  const top = mesh(new SphereGeometry(0.09, 16, 12), CLAY.butter);
  top.position.set(0, PT + 2.83, 0);
  b.add(cloth, top);
  b.add(block(0.35, 0.35, 0.35, CLAY.butter, 1.25, PT, 1.25));
  b.add(block(0.3, 0.3, 0.3, CLAY.blush, -1.35, PT, 0.9));
  b.on((t) => {
    cloth.rotation.y = Math.PI / 4 + wave(t, 2.2) * 0.3;
    cloth.scale.x = 1 + wave(t, 3.1) * 0.06;
  });
}

const BUILDERS: Record<LabArtKind, (b: Build) => void> = {
  server, rack, railway, water, cloud, lock, radar, industrial, race, checklist, shield, puzzle, blocks, flag,
};

export function buildDiorama(kind: LabArtKind, dark: boolean): Diorama {
  const group = new Group();
  const steps: ((t: number) => void)[] = [];
  BUILDERS[kind]({
    group,
    dark,
    add: (...objects) => objects.forEach((object) => group.add(object)),
    on: (step) => steps.push(step),
  });
  return { group, animate: (t) => steps.forEach((step) => step(t)) };
}
