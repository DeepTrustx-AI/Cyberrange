import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  CylinderGeometry,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  Light,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  type Object3D,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Shared pieces for every clay scene: the material, shape helpers, and the
// renderer and light rig. The still card illustrations and the live range both
// build from here, so a lab looks the same wherever it appears.

export const PLINTH_TOP = 0.28;

export function clay(color: string, roughness = 0.58) {
  const material = new MeshPhysicalMaterial({
    color,
    roughness,
    clearcoat: 0.25,
    clearcoatRoughness: 0.6,
    sheen: 0.4,
    sheenRoughness: 0.8,
    sheenColor: new Color('#ffffff'),
  });
  return material;
}

export function mesh(geometry: BufferGeometry, color: string, roughness?: number) {
  const m = new Mesh(geometry, clay(color, roughness));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A rounded box whose bottom sits at y.
export function block(w: number, h: number, d: number, color: string, x = 0, y = PLINTH_TOP, z = 0, radius = 0.1) {
  const m = mesh(new RoundedBoxGeometry(w, h, d, 5, Math.min(radius, h / 2, w / 2, d / 2)), color);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function cylinder(r: number, h: number, color: string, x = 0, y = PLINTH_TOP, z = 0) {
  const m = mesh(new CylinderGeometry(r, r, h, 48), color);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function mixHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

// Makes a part glow softly, for LEDs, signal lamps and status lights.
export function glow(target: Mesh, color: string, intensity = 0.8) {
  const material = target.material as MeshPhysicalMaterial;
  material.emissive = new Color(color);
  material.emissiveIntensity = intensity;
  return material;
}

// Frees everything a scene put on the GPU: geometries, materials and their
// textures, and the lights' shadow maps. Renderers outlive their scenes now, so
// nothing may be left for renderer.dispose() to catch.
export function disposeTree(root: Object3D) {
  root.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      const material = object.material as Material | Material[];
      for (const m of Array.isArray(material) ? material : [material]) {
        for (const value of Object.values(m)) if (value instanceof Texture) value.dispose();
        m.dispose();
      }
    } else if (object instanceof Light) {
      object.dispose();
    }
  });
}

type RendererOptions = {
  alpha?: boolean;
  pixelRatio?: number;
  preserve?: boolean;
  /** Draw into this canvas, for example an OffscreenCanvas inside a worker. */
  canvas?: HTMLCanvasElement | OffscreenCanvas;
};

export function createRenderer(options: RendererOptions = {}) {
  const renderer = new WebGLRenderer({
    canvas: options.canvas,
    antialias: true,
    alpha: options.alpha ?? true,
    preserveDrawingBuffer: options.preserve ?? false,
    powerPreference: 'high-performance',
  });
  // A worker has no devicePixelRatio of its own; it is passed in.
  renderer.setPixelRatio(options.pixelRatio ?? Math.min(globalThis.devicePixelRatio ?? 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  // Neutral tone mapping keeps the pastels the same hue as the CSS tokens while
  // still rolling off highlights softly.
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  // three.js r186 renders PCFSoftShadowMap as PCFShadowMap anyway, switching on the
  // first shadow pass; asking for PCF up front keeps precompiled shaders valid.
  renderer.shadowMap.type = PCFShadowMap;
  return renderer;
}

// Compiles the shaders `scene` needs without blocking: three.js compiles in
// parallel (KHR_parallel_shader_compile) and polls until they are done. Nothing
// flushes WebGL commands on its own inside a worker, so without the flushes here
// the GPU may never be asked to compile and the wait never ends.
export async function compileInParallel(renderer: WebGLRenderer, scene: Object3D, camera: Camera) {
  const gl = renderer.getContext();
  const pending = renderer.compileAsync(scene, camera);
  gl.flush();
  const flusher = setInterval(() => gl.flush(), 8);
  try {
    await pending;
  } finally {
    clearInterval(flusher);
  }
}

// The blurred studio room every clay scene reflects, built once per renderer.
// Its shaders are heavy (the generator's GGX filter takes 256 samples), and
// compiling them on first use froze the page for seconds on a cold GPU. So they
// are compiled in parallel first (KHR_parallel_shader_compile) and the room is
// only rendered once they are ready. Callers await this before their first frame.
const environments = new WeakMap<WebGLRenderer, Promise<WebGLRenderTarget | null>>();
const retired = new WeakSet<WebGLRenderer>();

export function studioEnvironment(renderer: WebGLRenderer) {
  let environment = environments.get(renderer);
  if (!environment) {
    environment = buildEnvironment(renderer);
    environments.set(renderer, environment);
  }
  return environment;
}

async function buildEnvironment(renderer: WebGLRenderer) {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  try {
    await precompileEnvironment(renderer, pmrem, room);
    return retired.has(renderer) ? null : pmrem.fromScene(room, 0.04);
  } finally {
    pmrem.dispose();
    room.dispose();
  }
}

// PMREMGenerator has no asynchronous path, so its filter materials are created
// ahead of time (through its internals, guarded in case a three.js update renames
// them) and compiled with the room's own materials and the plain background box
// it draws behind the room. Each is compiled in the state the generator renders
// in (a linear render target, no lights for the filters and the box) and on a
// geometry with only a position attribute like its own, because these all count
// toward the program key: a different key means a second, blocking compile.
// Anything missed here still works; it just compiles on first use.
async function precompileEnvironment(renderer: WebGLRenderer, pmrem: PMREMGenerator, room: Scene) {
  const generator = pmrem as unknown as {
    _setSize?: (size: number) => void;
    _allocateTargets?: () => WebGLRenderTarget;
    _blurMaterial?: Material | null;
    _ggxMaterial?: Material | null;
  };
  const previous = renderer.getRenderTarget();
  const target = new WebGLRenderTarget(16, 16, { type: HalfFloatType });
  const backdrop = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ side: BackSide, depthWrite: false, depthTest: false }));
  const positionsOnly = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
  const pending: Promise<unknown>[] = [];
  try {
    renderer.setRenderTarget(target);
    pending.push(compileInParallel(renderer, room, new PerspectiveCamera()));
    pending.push(compileInParallel(renderer, backdrop, new PerspectiveCamera()));
    if (generator._setSize && generator._allocateTargets) {
      generator._setSize(256);
      generator._allocateTargets().dispose();
      const filters = new Scene();
      for (const material of [generator._blurMaterial, generator._ggxMaterial]) {
        if (material) filters.add(new Mesh(positionsOnly, material));
      }
      pending.push(compileInParallel(renderer, filters, new OrthographicCamera()));
    }
  } finally {
    renderer.setRenderTarget(previous);
  }
  await Promise.all(pending);
  target.dispose();
  positionsOnly.dispose();
  backdrop.geometry.dispose();
  backdrop.material.dispose();
}

// One renderer per kind of view ("cube", "live"), kept for the whole visit. A
// new WebGL context cost up to a second of blocked main thread when another was
// still being torn down (signing out from the dashboard's cube to the sign-in
// cube), so a view borrows the kept renderer, with its context and studio
// environment, and hands it back when it unmounts. A second view of the same kind
// on screen at once gets a renderer of its own, retired when it is done.
const kept = new Map<string, { renderer: WebGLRenderer; inUse: boolean }>();

export function borrowRenderer(kind: string, options: RendererOptions = {}) {
  let entry = kept.get(kind);
  if (entry && entry.renderer.getContext().isContextLost()) {
    retireRenderer(entry.renderer);
    kept.delete(kind);
    entry = undefined;
  }
  if (entry?.inUse) {
    const renderer = createRenderer(options);
    return { renderer, giveBack: () => retireRenderer(renderer, true) };
  }
  if (!entry) {
    entry = { renderer: createRenderer(options), inUse: false };
    kept.set(kind, entry);
  }
  const borrowed = entry;
  borrowed.inUse = true;
  return { renderer: borrowed.renderer, giveBack: () => { borrowed.inUse = false; } };
}

// Frees a renderer and its studio environment, even one still being built.
function retireRenderer(renderer: WebGLRenderer, loseContext = false) {
  retired.add(renderer);
  environments.get(renderer)?.then((environment) => environment?.dispose());
  environments.delete(renderer);
  renderer.dispose();
  if (loseContext) renderer.forceContextLoss();
}

// Soft studio lighting: the blurred room (from studioEnvironment) for ambient
// light and reflections, a sky fill, and one warm key light that casts the shadows.
export function lightScene(scene: Scene, environment: WebGLRenderTarget | null, dark: boolean, shadowExtent = 6) {
  scene.environment = environment?.texture ?? null;
  scene.environmentIntensity = dark ? 0.32 : 0.55;

  scene.add(new HemisphereLight(dark ? '#FFE9D4' : '#FFFFFF', dark ? '#2B241F' : '#F1E6D8', dark ? 0.9 : 1.15));

  const key = new DirectionalLight(dark ? '#FFE2C4' : '#FFF4E8', dark ? 1.7 : 1.9);
  key.position.set(-4, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -shadowExtent;
  key.shadow.camera.right = shadowExtent;
  key.shadow.camera.top = shadowExtent;
  key.shadow.camera.bottom = -shadowExtent;
  key.shadow.camera.far = 40;
  key.shadow.radius = 7;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const rim = new DirectionalLight(dark ? '#FFC9A0' : '#FFE3CC', dark ? 0.55 : 0.4);
  rim.position.set(6, 3, -4);
  scene.add(rim);
}
