import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Award, ShieldCheck, SquareTerminal } from 'lucide-react';
import { LogoMark } from '../brand/LogoMark';
import { MASCOT_SEAT, Mascot, type MascotPose } from '../mascot/Mascot';
import { AmbientBackground } from '../ui/AmbientBackground';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useRichGraphics } from '../../utils/webgl';
import { CubeStill } from '../three/CubeStill';

const ClayCube = lazy(() => import('../three/ClayCube'));

interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  audience?: 'student' | 'enterprise';
}

const PROOF = [
  { icon: SquareTerminal, text: 'A live Linux machine in your browser' },
  { icon: ShieldCheck, text: 'Graded on what you actually changed' },
  { icon: Award, text: 'CTF events and verifiable certificates' },
];

const SKY = [
  'radial-gradient(60% 50% at 15% 10%, oklch(0.93 0.05 55 / 0.95), transparent 70%)',
  'radial-gradient(55% 55% at 90% 35%, oklch(0.93 0.06 168 / 0.8), transparent 70%)',
  'radial-gradient(70% 45% at 55% 105%, oklch(0.95 0.07 95 / 0.9), transparent 72%)',
  'linear-gradient(180deg, oklch(0.985 0.01 80), oklch(0.965 0.02 75))',
].join(', ');

function Hero({ audience, cube, live }: { audience: 'student' | 'enterprise'; cube: boolean; live: boolean }) {
  const [drawn, setDrawn] = useState(false);

  return (
    <aside className="relative m-3 hidden overflow-hidden rounded-[2rem] ring-1 ring-slate-900/5 lg:flex lg:flex-col" aria-label="About CyberRange">
      <div className="absolute inset-0" style={{ background: SKY }} aria-hidden="true" />
      <div className="relative flex h-full flex-col p-10 xl:p-14">
        <Link to="/" className="inline-flex w-fit items-center gap-3" aria-label="CyberRange home">
          <LogoMark size={36} />
          <span className="font-display text-2xl font-extrabold tracking-tight text-slate-900">CyberRange</span>
        </Link>

        <div className="rise-in mt-14 max-w-xl xl:mt-16">
          <h2 className="text-balance font-display text-[3.4rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-slate-900 xl:text-[4rem]">
            {audience === 'enterprise' ? (
              <>Run your own <span className="hero-mark">cyber range.</span></>
            ) : (
              <>Learn security by <span className="hero-mark">doing it for real.</span></>
            )}
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-slate-600">
            {audience === 'enterprise'
              ? 'Assign hands-on labs to your groups, schedule them, and see exactly how every student is doing.'
              : 'Hands-on cyber security labs!'}
          </p>
        </div>

        {/* A capped stage, so the cube stays the same modest size on tall screens. */}
        <div className="relative flex min-h-[14rem] flex-1 items-center">
          {cube && (
            <div className="relative h-full max-h-[460px] w-full">
              {/* The picture holds the cube's place until the live one is drawn over it,
                  and stays in light mode. */}
              <CubeStill live={live && drawn} className="absolute inset-x-0 -top-[8%] bottom-0 h-[108%] w-full" />
              {live && (
                <Suspense fallback={null}>
                  {/* The canvas reaches a little above the stage into empty space, so the
                      cube can be larger while its breaking blocks stay inside the canvas. */}
                  <ClayCube mode="logo" loop dark={false} onReady={() => setDrawn(true)} className="absolute inset-x-0 -top-[8%] bottom-0" />
                </Suspense>
              )}
            </div>
          )}
        </div>

        <ul className="rise-in grid gap-x-6 gap-y-3 xl:grid-cols-3" style={{ animationDelay: '160ms' }}>
          {PROOF.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-sm leading-snug text-slate-700">
              <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/80 text-slate-900 shadow-sm ring-1 ring-slate-900/5">
                <Icon className="h-3.5 w-3.5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function isPasswordField(element: Element | null): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false;
  const hints = `${element.autocomplete} ${element.name} ${element.id}`.toLowerCase();
  return element.type === 'password' || hints.includes('password');
}

// What it gets up to now and then when left alone, and for how long.
const ANTICS: { pose: MascotPose; ms: number }[] = [
  { pose: 'wave', ms: 2200 },
  { pose: 'sway', ms: 3900 },
  { pose: 'think', ms: 2400 },
];
const NAP_AFTER_MS = 30_000;
const TEXT_FIELD = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea';

function fieldFocused(form: HTMLElement | null) {
  const active = document.activeElement;
  return Boolean(form && active && form.contains(active) && active.matches(TEXT_FIELD));
}

// The mascot reacts to the form: it watches the pointer, follows the email as it
// is typed, covers its eyes for a password, peeks when the password is shown and
// scratches its head when an error appears. Left alone it waves, hums or wonders
// now and then, and after half a minute without input it nods off until you move.
function useMascotMood(formRef: RefObject<HTMLDivElement | null>, mascotRef: RefObject<HTMLDivElement | null>) {
  const [pose, setPose] = useState<MascotPose>('idle');
  const [look, setLook] = useState({ x: 0, y: 0 });
  const poseRef = useRef<MascotPose>('idle');
  const busy = useRef(false);

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    let lastInput = performance.now();
    let nextAntic = lastInput + 450;
    let antic: MascotPose | null = null;
    let anticEnds = 0;
    let greeted = false;

    const play = (next: MascotPose, ms: number) => {
      antic = next;
      anticEnds = performance.now() + ms;
      setPose(next);
    };
    const finish = () => {
      const done = antic;
      antic = null;
      setPose((current) => (current === done ? 'idle' : current));
    };

    const tick = window.setInterval(() => {
      const now = performance.now();
      if (antic && now >= anticEnds) finish();
      if (antic || poseRef.current !== 'idle') return;
      if (fieldFocused(formRef.current)) {
        nextAntic = Math.max(nextAntic, now + 6000);
        return;
      }
      if (now - lastInput > NAP_AFTER_MS) {
        setPose('sleep');
        return;
      }
      if (now < nextAntic) return;
      const next = greeted ? ANTICS[Math.floor(Math.random() * ANTICS.length)] : ANTICS[0];
      greeted = true;
      play(next.pose, next.ms);
      nextAntic = now + next.ms + 6000 + Math.random() * 6000;
    }, 250);

    // Any input counts as company; it wakes with a wave.
    const onInput = () => {
      lastInput = performance.now();
      if (poseRef.current !== 'sleep') return;
      play('wave', 1600);
      nextAntic = lastInput + 9000;
    };
    window.addEventListener('pointermove', onInput, { passive: true });
    window.addEventListener('pointerdown', onInput, { passive: true });
    window.addEventListener('keydown', onInput);

    // An error message showing up in the form: a puzzled scratch of the head.
    const errors = new MutationObserver((records) => {
      const appeared = records.some((record) =>
        [...record.addedNodes].some((node) => node instanceof Element && (node.matches('[role="alert"]') || node.querySelector('[role="alert"]') !== null)),
      );
      if (appeared && !busy.current) play('think', 2600);
    });
    if (formRef.current) errors.observe(formRef.current, { childList: true, subtree: true });

    return () => {
      window.clearInterval(tick);
      window.removeEventListener('pointermove', onInput);
      window.removeEventListener('pointerdown', onInput);
      window.removeEventListener('keydown', onInput);
      errors.disconnect();
    };
  }, [formRef]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const evaluate = () => {
      const active = document.activeElement;
      let field: Element | null = active;
      if (active instanceof HTMLButtonElement && /password/i.test(active.getAttribute('aria-label') ?? '')) {
        field = active.parentElement?.querySelector('input') ?? null;
      }
      if (field && form.contains(field) && isPasswordField(field)) {
        busy.current = true;
        setPose(field.type === 'password' ? 'cover' : 'peek');
        return;
      }
      busy.current = false;
      if (active instanceof HTMLInputElement && form.contains(active)) {
        setPose('idle');
        setLook({ x: clamp((active.value.length / 26) * 2 - 1, -1, 1), y: 0.8 });
        return;
      }
      setPose((current) => (current === 'cover' || current === 'peek' ? 'idle' : current));
    };
    const later = () => window.setTimeout(evaluate, 0);

    form.addEventListener('focusin', evaluate);
    form.addEventListener('focusout', later);
    form.addEventListener('input', evaluate);
    form.addEventListener('click', later);
    return () => {
      form.removeEventListener('focusin', evaluate);
      form.removeEventListener('focusout', later);
      form.removeEventListener('input', evaluate);
      form.removeEventListener('click', later);
    };
  }, [formRef]);

  // With nothing focused, the eyes follow the pointer around the page.
  useEffect(() => {
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const active = document.activeElement;
        if (active instanceof HTMLInputElement && formRef.current?.contains(active)) return;
        const box = mascotRef.current?.getBoundingClientRect();
        if (!box) return;
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        setLook({ x: clamp((event.clientX - cx) / 260, -1, 1), y: clamp((event.clientY - cy) / 260, -1, 1) });
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [formRef, mascotRef]);

  return { pose, look };
}

// Where the form's first text field starts inside the column, so the mascot can
// sit on it. Measured again whenever the form or column changes size (an error
// appearing above the fields, fonts loading, the window resizing).
function useSeatTop(columnRef: RefObject<HTMLDivElement | null>, formRef: RefObject<HTMLDivElement | null>) {
  const [seatTop, setSeatTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const column = columnRef.current;
    const form = formRef.current;
    if (!column || !form) return;
    const measure = () => {
      const field = form.querySelector(TEXT_FIELD) ?? form;
      setSeatTop(Math.round(field.getBoundingClientRect().top - column.getBoundingClientRect().top));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    observer.observe(form);
    return () => observer.disconnect();
  }, [columnRef, formRef]);
  return seatTop;
}

// Shared frame for sign-in, sign-up and password pages: the CyberRange hero on
// the left, the form on the right with the mascot perched on its first field. On
// small screens a short cube band sits above the form.
export function AuthShell({ title, subtitle, children, footer, audience = 'student' }: AuthShellProps) {
  const webgl = useRichGraphics();
  // One cube per page: the hero's on wide screens, the short band's on narrow ones
  // (lg, where the hero appears). A hidden second cube would double the GPU work.
  const wide = useMediaQuery('(min-width: 64rem)');
  const roomy = useMediaQuery('(min-width: 40rem)');
  const columnRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const { pose, look } = useMascotMood(formRef, mascotRef);
  const seatTop = useSeatTop(columnRef, formRef);
  const mascotSize = roomy ? 92 : 76;
  const [bandDrawn, setBandDrawn] = useState(false);

  return (
    <div className="isolate grid min-h-screen bg-slate-100 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <AmbientBackground />
      <Hero audience={audience} cube={wide} live={webgl} />

      <main className="flex min-h-screen flex-col px-6 py-8 sm:px-10">
        <Link to="/" className="inline-flex items-center gap-2.5 lg:hidden" aria-label="CyberRange home">
          <LogoMark size={30} />
          <span className="font-display text-xl font-extrabold tracking-tight text-slate-900">CyberRange</span>
        </Link>
        <div className="mt-5 lg:hidden">
          <p className="text-balance font-display text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
            {audience === 'enterprise' ? 'Run your own cyber range.' : 'Learn security by doing it for real.'}
          </p>
          {!wide && (
            <div className="relative mt-3 h-48 overflow-hidden rounded-3xl" aria-hidden="true">
              <div className="absolute inset-0" style={{ background: SKY }} />
              <CubeStill live={webgl && bandDrawn} className="absolute inset-0 h-full w-full p-3" />
              {webgl && (
                <Suspense fallback={null}>
                  <ClayCube mode="logo" loop dark={false} onReady={() => setBandDrawn(true)} className="absolute inset-0" />
                </Suspense>
              )}
            </div>
          )}
        </div>
        <div ref={columnRef} className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <div className="pr-16">
            <h1 className="font-display text-[1.6rem] font-bold text-slate-900 sm:text-[1.75rem]">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] text-slate-500">{subtitle}</p>}
          </div>
          <div ref={formRef} className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-slate-500">{footer}</div>}
          {/* Drawn after the form so its legs hang in front of the field it sits on. */}
          {seatTop !== null && (
            <div
              ref={mascotRef}
              className="mascot-perch pointer-events-none absolute right-1"
              style={{ top: seatTop - Math.round(mascotSize * MASCOT_SEAT) }}
            >
              <Mascot pose={pose} size={mascotSize} look={look} seated interactive />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
