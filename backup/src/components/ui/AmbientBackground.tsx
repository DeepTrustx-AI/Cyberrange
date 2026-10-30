// Slow light behind every page: three soft fields of peach, mint and butter
// (apricot and mint embers in dark) drifting on long, offset loops so the
// canvas never looks static. Sits behind content, ignores the pointer, and
// holds still under reduced motion.
export function AmbientBackground({ quiet = false }: { quiet?: boolean }) {
  return (
    <div className={`ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden ${quiet ? 'opacity-50' : ''}`} aria-hidden="true">
      <span className="ambient-field ambient-a" />
      <span className="ambient-field ambient-b" />
      <span className="ambient-field ambient-c" />
    </div>
  );
}
