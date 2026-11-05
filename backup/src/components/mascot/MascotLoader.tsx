import { useEffect, useState } from 'react';
import { Mascot } from './Mascot';

interface MascotLoaderProps {
  label?: string;
  /** "page" fills the screen; "inline" sits in the content area of a layout. */
  variant?: 'page' | 'inline';
  /** Wait this long before showing anything, so quick loads never flash. */
  delay?: number;
}

const GROUND = ['#F6C6A6', '#9BE3C8', '#FFE08A', '#B7DCF5', '#F7C9D6'];

// The mascot walks along a row of clay blocks while something loads. Under
// reduced motion it simply stands there with the label.
export function MascotLoader({ label = 'Loading', variant = 'inline', delay = 180 }: MascotLoaderProps) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  const body = (
    <div className={`flex flex-col items-center ${visible ? 'fade-in' : 'invisible'}`} role="status" aria-live="polite">
      <div className="relative">
        <Mascot pose="carry" size={variant === 'page' ? 92 : 76} />
      </div>
      <div className="loader-ground mt-1 flex w-44 gap-1.5 overflow-hidden" aria-hidden="true">
        <div className="loader-ground-track flex shrink-0 gap-1.5">
          {[...GROUND, ...GROUND, ...GROUND].map((color, i) => (
            <span key={i} className="h-2.5 w-5 shrink-0 rounded-[4px]" style={{ background: color }} />
          ))}
        </div>
      </div>
      <p className="mt-4 flex items-baseline text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
        <span className="loader-dots ml-0.5" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
      </p>
    </div>
  );

  if (variant === 'page') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">{body}</div>;
  }
  return <div className="flex min-h-[55vh] items-center justify-center">{body}</div>;
}
