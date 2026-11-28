export function animateMascotHop(
  el: HTMLElement,
  fromRect: DOMRect,
  toRect: DOMRect,
): Animation | null {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null;
  }
  if (typeof el.animate !== 'function') {
    return null;
  }
  const dx = fromRect.left - toRect.left;
  const dy = fromRect.top - toRect.top;
  const dist = Math.hypot(dx, dy);
  const arcHeight = Math.min(48, Math.max(18, dist * 0.16));

  return el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(1.12, 0.86)`, offset: 0 },
      { transform: `translate(${dx * 0.82}px, ${dy * 0.82 - arcHeight * 0.45}px) scale(0.94, 1.08)`, offset: 0.22 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arcHeight}px) scale(0.97, 1.04)`, offset: 0.5 },
      { transform: 'translate(0px, 0px) scale(1.1, 0.88)', offset: 0.84 },
      { transform: 'translate(0px, 0px) scale(1, 1)', offset: 1 },
    ],
    {
      duration: 420,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'none',
    },
  );
}
