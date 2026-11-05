import { Mascot, type MascotPose } from '../../components/mascot/Mascot';

// Development-only sheet of every mascot pose in both themes (route /__mascot).
const POSES: MascotPose[] = ['idle', 'wave', 'walk', 'carry', 'cheer', 'think', 'cover', 'peek', 'sleep', 'sway'];

export function MascotGallery() {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      {[false, true].map((dark) => (
        <section key={String(dark)} className={`${dark ? 'dark bg-slate-950' : 'bg-white'} mb-6 rounded-3xl p-6`}>
          <div className="grid grid-cols-9 gap-4">
            {POSES.map((pose) => (
              <figure key={pose} className="flex flex-col items-center gap-2">
                <Mascot pose={pose} size={120} />
                <figcaption className={`text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{pose}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
