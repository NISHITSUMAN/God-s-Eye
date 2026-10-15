export function LogoMark({ size = 22, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden className="text-primary">
      <path d="M4 24 C 12 12, 36 12, 44 24 C 36 36, 12 36, 4 24 Z" stroke="currentColor" strokeWidth="1.6" className={animate ? "animate-draw" : ""} />
      <ellipse cx="24" cy="24" rx="20" ry="7" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" transform="rotate(-24 24 24)" className={animate ? "animate-draw" : ""} />
      <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="24" cy="24" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <span className="wordmark-text font-mono text-[12px] font-medium tracking-[0.32em] text-foreground">THIRD EYE</span>
    </div>
  );
}
