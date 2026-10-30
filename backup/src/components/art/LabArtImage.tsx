import { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { LabArt } from './LabArt';
import type { LabArtKind } from '../../utils/labArtKind';

// The clay illustrations, rendered ahead of time by scripts/render-lab-art.mjs
// (one per lab kind and theme), so a page full of cards draws no 3D at all.
const PRERENDERED = Object.fromEntries(
  Object.entries(import.meta.glob('../../assets/lab-art/*.webp', { eager: true, query: '?url', import: 'default' })).map(
    ([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url as string],
  ),
);

// Shows the clay illustration for a lab. A kind with no prerendered image yet (a
// new scene, before the script is run again) is rendered in the browser instead,
// with the flat SVG version while it renders or when WebGL is unavailable.
export function LabArtImage({ kind, className = '' }: { kind: LabArtKind; className?: string }) {
  const dark = useTheme().theme === 'dark';
  const prerendered = PRERENDERED[`${kind}-${dark ? 'dark' : 'light'}`];
  if (prerendered) {
    return <img src={prerendered} alt="" aria-hidden="true" draggable={false} loading="lazy" decoding="async" className={`object-contain ${className}`} />;
  }
  return <RenderedLabArt kind={kind} dark={dark} className={className} />;
}

function RenderedLabArt({ kind, dark, className }: { kind: LabArtKind; dark: boolean; className: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('./labArtRenderer')
      .then(({ renderLabArt }) => renderLabArt(kind, dark))
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, dark]);

  if (failed) return <LabArt kind={kind} className={className} />;
  if (!src) return <div className={className} aria-hidden="true" />;
  return <img src={src} alt="" aria-hidden="true" draggable={false} className={`object-contain ${className}`} />;
}
