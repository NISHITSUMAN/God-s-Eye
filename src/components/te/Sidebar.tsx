import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  Globe2, Microscope, Satellite, Database, BookOpen,
  Settings, Info, PanelLeftClose, PanelLeftOpen, MoreHorizontal, X,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { LogoMark } from "./Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Explore", icon: Globe2 },
  { to: "/data", label: "NISAR Data", icon: Database },
  { to: "/analyze", label: "Analyze", icon: Microscope },
  { to: "/observations", label: "Observations", icon: Satellite },
] as const;
const BOTTOM = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/about", label: "About", icon: Info },
] as const;
const MOBILE_NAV = NAV.filter((item) => ["/", "/analyze", "/data"].includes(item.to));
const MORE_NAV = [
  ...NAV.filter((item) => !["/", "/analyze", "/data"].includes(item.to)),
  { to: "/reports/create", label: "Reports", icon: BookOpen },
  ...BOTTOM,
] as const;

export function Sidebar() {
  const collapsed = useApp((s) => s.sidebarCollapsed);
  const setSidebar = useApp((s) => s.setSidebar);
  const [moreOpen, setMoreOpen] = useState(false);

  const Item = ({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Globe2 }) => (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      title={label}
      aria-label={label}
      className="group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground data-[status=active]:bg-elevated data-[status=active]:text-foreground"
    >
      <span className="absolute left-0 top-2 bottom-2 w-px bg-primary opacity-0 group-data-[status=active]:opacity-100" />
      <Icon className="size-4 shrink-0" strokeWidth={1.5} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  return (
    <>
      <aside className={cn("desktop-sidebar relative z-30 flex h-full shrink-0 flex-col border-r border-border bg-panel py-3 transition-[width] duration-300", collapsed ? "w-[52px] px-1.5" : "w-[188px] px-2.5")}>
        <Link to="/" className="mb-5 flex h-8 items-center gap-2.5 px-1.5">
          <LogoMark size={22} />
          {!collapsed && <span className="font-mono text-[11px] tracking-[0.3em]">THIRD EYE</span>}
        </Link>
        <nav className="scroll-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Primary navigation">
          {NAV.map((item) => <Item key={item.to} {...item} />)}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5">
          {BOTTOM.map((item) => <Item key={item.to} {...item} />)}
          <Button variant="ghost" onClick={() => setSidebar(!collapsed)} className="flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] text-subtle hover:bg-elevated hover:text-foreground" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen className="size-4" strokeWidth={1.5} /> : <PanelLeftClose className="size-4" strokeWidth={1.5} />}
            {!collapsed && <span>Collapse</span>}
          </Button>
        </div>
      </aside>

      <div className="mobile-sidebar">
        {moreOpen && (
          <>
            <button className="mobile-more-scrim" aria-label="Close more navigation" onClick={() => setMoreOpen(false)} />
            <nav className="mobile-more-menu glass" aria-label="More pages">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="label-xs">MORE PAGES</span>
                <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close more menu" className="rounded p-1 text-muted-foreground hover:bg-elevated"><X className="size-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-1 p-2">
                {MORE_NAV.map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} activeOptions={{ exact: to === "/" }} onClick={() => setMoreOpen(false)}
                    className="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2.5 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground data-[status=active]:bg-elevated data-[status=active]:text-primary">
                    <Icon className="size-4 shrink-0" /><span className="truncate">{label}</span>
                  </Link>
                ))}
              </div>
            </nav>
          </>
        )}
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} activeOptions={{ exact: to === "/" }} onClick={() => setMoreOpen(false)}
              className="mobile-nav-item text-muted-foreground data-[status=active]:text-primary" aria-label={label}>
              <Icon className="size-5" strokeWidth={1.7} />
              <span>{label}</span>
              <span className="mobile-nav-active" />
            </Link>
          ))}
          <button type="button" className={cn("mobile-nav-item", moreOpen ? "text-primary" : "text-muted-foreground")} onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} aria-label="More pages">
            {moreOpen ? <X className="size-5" /> : <MoreHorizontal className="size-5" />}
            <span>More</span>
            <span className="mobile-nav-active" />
          </button>
        </nav>
      </div>
    </>
  );
}
