interface LogoMarkProps {
  size?: number;
  className?: string;
}

// The CyberRange mark: one isometric block from the range, lit from the top left.
export function LogoMark({ size = 28, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M16 2.5 28 9.25 16 16 4 9.25Z" fill="var(--color-brand-400)" />
      <path d="M4 9.25 16 16v13.5L4 22.75Z" fill="var(--color-brand-600)" />
      <path d="M28 9.25 16 16v13.5l12-6.75Z" fill="var(--color-brand-800)" />
      <path d="M16 16 28 9.25" stroke="white" strokeOpacity="0.35" strokeWidth="0.75" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="font-display text-[17px] font-bold tracking-tight text-slate-900 dark:text-white">
        CyberRange
      </span>
    </span>
  );
}
