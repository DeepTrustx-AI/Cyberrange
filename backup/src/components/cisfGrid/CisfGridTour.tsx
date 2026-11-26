import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, HelpCircle, X } from 'lucide-react';
import { Mascot, type MascotPointDir, type MascotPose } from '../mascot/Mascot';
import { animateMascotHop } from '../mascot/mascotHop';

interface TourStep {
  id: string;
  title: string;
  body: string;
  pose: MascotPose;
  dir?: MascotPointDir;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to SN-220-MAIN Suryanagar',
    body: 'Hospital and water works called in power loss while the control room screen still looks calm. Work step by step across five acts from passive forensics through restoration and Zeek detection.',
    pose: 'wave',
  },
  {
    id: 'stage',
    title: 'Living Lab Stage',
    body: 'Switch between Substation, City Grid, and Network views to watch live SCADA telemetry update over your private session WebSocket.',
    pose: 'point',
    dir: 'up',
  },
  {
    id: 'dispatch',
    title: 'Field Dispatch and Controls',
    body: 'Read incoming callouts from Raghav Menon and request physical switchyard bay checks from Devika Nair before trusting the HMI.',
    pose: 'phone',
  },
  {
    id: 'workspace',
    title: 'Terminal and Workspace Editor',
    body: 'Use the responder terminal on the right for tshark, iec104-observe, fwctl, sbo, and zeek-test, or flip to Workspace Editor to edit JSON, YAML, and Zeek artifacts directly.',
    pose: 'point',
    dir: 'right',
  },
  {
    id: 'grading',
    title: 'Practice, Submit, and Case Board',
    body: 'Use Practice for zero-risk format checks, then Submit for graded verification. Passed modules lock into your Case Board and unlock the Shift Report after Module 10.',
    pose: 'nod',
  },
];

interface CisfGridTourProps {
  open: boolean;
  onFinish: () => void;
  onDismiss: () => void;
}

/**
 * First-run lab tour and Guide card scoped strictly inside the mission column
 * (Decision 6 eighth allowed place: size <= 72px, interactive={false}, never
 * overlays or overlaps the right-hand terminal pane).
 */
export const CisfGridTour: React.FC<CisfGridTourProps> = ({ open, onFinish, onDismiss }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [hopping, setHopping] = useState(false);
  const mascotWrapRef = useRef<HTMLDivElement>(null);
  const prevRectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const animRef = useRef<Animation | null>(null);

  const cancelHop = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (animRef.current) {
      animRef.current.cancel();
      animRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      cancelHop();
      setStepIdx(0);
      setHopping(false);
    }
    return cancelHop;
  }, [open]);

  if (!open) return null;

  const step = TOUR_STEPS[stepIdx];
  const isLast = stepIdx === TOUR_STEPS.length - 1;

  const moveStep = (nextIdx: number) => {
    cancelHop();
    const el = mascotWrapRef.current;
    if (el) {
      prevRectRef.current = el.getBoundingClientRect();
    }
    setHopping(true);
    setStepIdx(nextIdx);
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const targetEl = mascotWrapRef.current;
      const fromRect = prevRectRef.current;
      if (targetEl && fromRect) {
        const toRect = targetEl.getBoundingClientRect();
        const anim = animateMascotHop(targetEl, fromRect, toRect);
        if (anim) {
          animRef.current = anim;
          const finish = () => {
            if (animRef.current === anim) {
              animRef.current = null;
              setHopping(false);
            }
          };
          anim.onfinish = finish;
          anim.oncancel = finish;
          return;
        }
      }
      setHopping(false);
    });
  };

  return (
    <aside
      aria-label="CISF OT Grid guided tour"
      className="rise-in rounded-[28px] border border-brand-200 bg-brand-50/70 p-4 shadow-sm dark:border-brand-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-4">
        <div ref={mascotWrapRef} className="shrink-0">
          <Mascot
            pose={hopping ? 'hop' : step.pose}
            dir={step.dir}
            size={64}
            interactive={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
              <HelpCircle className="h-3.5 w-3.5" />
              Guide step {stepIdx + 1} of {TOUR_STEPS.length}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close guide"
              className="rounded-full p-1 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            {step.title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {step.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveStep(Math.max(0, stepIdx - 1))}
              disabled={stepIdx === 0}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Skip
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={onFinish}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-700"
                >
                  Finish tour
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => moveStep(stepIdx + 1)}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-700"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
