import { useState } from 'react';
import { Feather, MonitorSmartphone, Sparkles } from 'lucide-react';
import { graphicsChoice, setGraphicsChoice, useRichGraphics, webglAvailable, type GraphicsChoice } from '../../utils/webgl';

const OPTIONS: { value: GraphicsChoice; label: string; detail: string; Icon: typeof Sparkles }[] = [
  { value: 'auto', label: 'Automatic', detail: 'Full graphics when this computer has a graphics chip, light mode when it does not. Recommended.', Icon: MonitorSmartphone },
  { value: 'full', label: 'Full graphics', detail: '3D scenes and animations on any computer. Without a graphics chip, pages can be slow.', Icon: Sparkles },
  { value: 'lite', label: 'Light mode', detail: 'No 3D scenes, animations or blurred backgrounds. Fastest on any computer.', Icon: Feather },
];

// The graphics choice for this computer, shared by the student and admin settings.
export function GraphicsSetting() {
  const [choice, setChoice] = useState<GraphicsChoice>(graphicsChoice);
  const rich = useRichGraphics();
  const hasChip = webglAvailable();

  const choose = (value: GraphicsChoice) => {
    setGraphicsChoice(value);
    setChoice(value);
  };

  return (
    <div className="space-y-3">
      <div>
        <p id="graphics-label" className="text-xs font-bold text-slate-700 dark:text-slate-300">Graphics</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Saved for this computer only. {hasChip ? 'A graphics chip was found.' : 'No graphics chip was found.'} Now showing {rich ? 'full graphics' : 'light mode'}.
        </p>
      </div>
      <div role="radiogroup" aria-labelledby="graphics-label" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPTIONS.map(({ value, label, detail, Icon }) => {
          const selected = choice === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(value)}
              className={`flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-colors ${
                selected
                  ? 'border-brand-600 bg-brand-50/60 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-bold">{label}</span>
              <span className="text-xs text-slate-600 dark:text-slate-400">{detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
