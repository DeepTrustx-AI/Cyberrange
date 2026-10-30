import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShadowMaterial, type WebGLRenderer } from 'three';
import type { LabArtKind } from '../../utils/labArtKind';
import { buildDiorama } from '../three/world/dioramas';
import { compileInParallel, createRenderer, disposeTree, lightScene, studioEnvironment } from '../three/world/kit';

// Renders each lab illustration once, as a real 3D clay scene, into a PNG data URL.
// Every scene shares one plinth size, one camera and one light rig, so the cards
// read as a set. One WebGL context and one studio environment serve all of them,
// and shaders compile in parallel, so a page full of cards never stalls.

export const ART_WIDTH = 440;
export const ART_HEIGHT = 300;
// The moment of each scene's animation the still frame shows.
export const POSE_TIME = 0.35;

let renderer: WebGLRenderer | null = null;
const cache = new Map<string, Promise<string>>();

function getRenderer() {
  if (renderer) return renderer;
  renderer = createRenderer({ pixelRatio: 2, preserve: true });
  renderer.setSize(ART_WIDTH, ART_HEIGHT, false);
  return renderer;
}

// The camera every lab scene is framed with, still or live.
export function artCamera(width = ART_WIDTH, height = ART_HEIGHT) {
  const halfH = 2.4;
  const halfW = halfH * (width / height);
  const camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100);
  camera.position.set(10, 8.4, 10);
  camera.lookAt(0, 1.3, 0);
  return camera;
}

export function artFloor(dark: boolean) {
  const floor = new Mesh(new PlaneGeometry(30, 30), new ShadowMaterial({ opacity: dark ? 0.35 : 0.12 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}

export function renderLabArt(kind: LabArtKind, dark = false): Promise<string> {
  const cacheKey = `${kind}:${dark ? 'dark' : 'light'}`;
  let url = cache.get(cacheKey);
  if (!url) {
    url = paint(kind, dark);
    cache.set(cacheKey, url);
    // A failed render may succeed later (for example after a lost context).
    url.catch(() => cache.delete(cacheKey));
  }
  return url;
}

async function paint(kind: LabArtKind, dark: boolean) {
  const r = getRenderer();
  const environment = await studioEnvironment(r);
  const scene = new Scene();
  lightScene(scene, environment, dark, 5);
  scene.add(artFloor(dark));
  const diorama = buildDiorama(kind, dark);
  diorama.animate(POSE_TIME);
  scene.add(diorama.group);
  const camera = artCamera();
  try {
    await compileInParallel(r, scene, camera);
    // Render and read back in one go, so scenes painted at the same time never mix.
    r.render(scene, camera);
    return r.domElement.toDataURL('image/png');
  } finally {
    disposeTree(scene);
  }
}
