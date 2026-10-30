import { lazy, Suspense, useMemo, useState } from 'react';
import { LabArtImage } from './LabArtImage';
import type { LabArtKind } from '../../utils/labArtKind';
import { webglAvailable } from '../../utils/webgl';
import { useTheme } from '../../context/ThemeContext';

const LiveDiorama = lazy(() => import('./LiveDiorama'));

// A lab's clay illustration: the still image, swapped for the live scene while
// `live` is on. The swap happens on the live scene's first frame, which matches
// the still exactly, and the still stays hidden while the live scene turns toward
// the pointer, so no second copy ever shows behind it.
export function LabScene({ kind, live, className = '' }: { kind: LabArtKind; live: boolean; className?: string }) {
  const [liveShown, setLiveShown] = useState(false);
  const webgl = useMemo(webglAvailable, []);
  const dark = useTheme().theme === 'dark';
  const showLive = live && webgl;

  return (
    <div className={`relative ${className}`}>
      <LabArtImage kind={kind} className={`absolute inset-0 h-full w-full ${showLive && liveShown ? 'invisible' : ''}`} />
      {showLive && (
        <Suspense fallback={null}>
          <LiveDiorama kind={kind} dark={dark} onReady={setLiveShown} className="absolute inset-0" />
        </Suspense>
      )}
    </div>
  );
}
