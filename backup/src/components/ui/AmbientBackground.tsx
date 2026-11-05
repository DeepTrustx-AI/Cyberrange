// Soft light behind every page: fields of peach, mint and butter (apricot and mint
// embers in dark), drawn as one still layer of gradients in index.css. Sits behind
// content and ignores the pointer.
export function AmbientBackground({ quiet = false }: { quiet?: boolean }) {
  return <div className={`ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden ${quiet ? 'opacity-50' : ''}`} aria-hidden="true" />;
}
