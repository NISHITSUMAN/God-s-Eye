import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Globe2, Compass, Microscope, Hourglass, Siren, Satellite, Database, BookOpen, Settings, Info, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useApp } from "@/lib/store";
import { LogoMark } from "./Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Explore", icon: Globe2 },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/analyze", label: "Analyze", icon: Microscope },
  { to: "/timeline", label: "Timeline", icon: Hourglass },
  { to: "/events", label: "Events", icon: Siren },
  { to: "/observations", label: "Observations", icon: Satellite },
  { to: "/data", label: "Data", icon: Database },
  { to: "/intelligence", label: "Intelligence", icon: Microscope },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/methodology", label: "Methodology", icon: Microscope },
  { to: "/reports/create", label: "Reports", icon: BookOpen },
  { to: "/learn", label: "Learn", icon: BookOpen },
] as const;
const BOTTOM = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/about", label: "About", icon: Info },
] as const;

export function Sidebar() {
  const collapsed = useApp((s) => s.sidebarCollapsed);
  const setSidebar = useApp((s) => s.setSidebar);
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
    <aside className={cn("relative z-30 flex h-full shrink-0 flex-col border-r border-border bg-panel py-3 transition-[width] duration-300", collapsed ? "w-[52px] px-1.5" : "w-[188px] px-2.5")}>
      <Link to="/" className="mb-5 flex h-8 items-center gap-2.5 px-1.5">
        <LogoMark size={22} />
        {!collapsed && <span className="font-mono text-[11px] tracking-[0.3em]">THIRD EYE</span>}
      </Link>
      <nav className="scroll-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">{NAV.map((n) => <Item key={n.to} {...n} />)}</nav>
      <div className="mt-auto flex flex-col gap-0.5">
        {BOTTOM.map((n) => <Item key={n.to} {...n} />)}
        <Button variant="ghost" onClick={() => setSidebar(!collapsed)} className="flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] text-subtle hover:bg-elevated hover:text-foreground" aria-label="Toggle sidebar">
          {collapsed ? <PanelLeftOpen className="size-4" strokeWidth={1.5} /> : <PanelLeftClose className="size-4" strokeWidth={1.5} />}
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
