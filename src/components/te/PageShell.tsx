import type { ReactNode } from "react";

export function PageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-8 py-10">
        <div className="label-xs text-primary">{eyebrow}</div>
        <h1 className="mt-2 text-[26px] font-medium tracking-tight">{title}</h1>
        {intro && <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-muted-foreground">{intro}</p>}
        <div className="mt-8">{children}</div>
        <p className="mt-10 font-mono text-[9px] tracking-wider text-subtle">SCIENTIFIC OVERLAYS AND ANALYSIS RESULTS ARE SAMPLE DATA · LIVE PUBLIC FEEDS ARE SOURCE-ATTRIBUTED</p>
      </div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-panel ${className}`}>{children}</div>;
}
