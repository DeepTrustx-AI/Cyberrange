import { Mascot, type MascotPointDir, type MascotPose } from '../../components/mascot/Mascot';

// Development-only sheet of every mascot pose in both themes (route /__mascot).
const POSES: Array<{ pose: MascotPose; dir?: MascotPointDir; label: string }> = [
  { pose: 'idle', label: 'idle' },
  { pose: 'wave', label: 'wave' },
  { pose: 'walk', label: 'walk' },
  { pose: 'carry', label: 'carry' },
  { pose: 'cheer', label: 'cheer' },
  { pose: 'think', label: 'think' },
  { pose: 'cover', label: 'cover' },
  { pose: 'peek', label: 'peek' },
  { pose: 'sleep', label: 'sleep' },
  { pose: 'sway', label: 'sway' },
  { pose: 'point', dir: 'left', label: 'point (left)' },
  { pose: 'point', dir: 'right', label: 'point (right)' },
  { pose: 'point', dir: 'up', label: 'point (up)' },
  { pose: 'point', dir: 'down', label: 'point (down)' },
  { pose: 'hop', label: 'hop' },
  { pose: 'nod', label: 'nod' },
  { pose: 'phone', label: 'phone' },
];

export function MascotGallery() {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      {[false, true].map((dark) => (
        <section key={String(dark)} className={`${dark ? 'dark bg-slate-950' : 'bg-white'} mb-6 rounded-3xl p-6`}>
          <div className="grid grid-cols-6 gap-4 sm:grid-cols-9">
            {POSES.map((item) => (
              <figure key={item.label} className="flex flex-col items-center gap-2">
                <Mascot pose={item.pose} dir={item.dir} size={120} />
                <figcaption className={`text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{item.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
