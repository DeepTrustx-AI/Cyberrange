import logoCube from '../../assets/cube/logo-cube.webp';

// The clay cube as a picture, rendered from the same scene (it rests the way the
// live cube does): shown at once, so the space is never empty while the 3D loads,
// on a slow link or when it never starts, and kept for good in light mode.
// `live` fades it out once the 3D cube is drawn over it.
export function CubeStill({ live = false, className = '' }: { live?: boolean; className?: string }) {
  return (
    <img
      src={logoCube}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      className={`pointer-events-none select-none object-contain transition-opacity duration-500 ${live ? 'opacity-0' : 'opacity-100'} ${className}`}
    />
  );
}
