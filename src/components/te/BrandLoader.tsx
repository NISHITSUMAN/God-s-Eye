import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

export function BrandLoader() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  useEffect(() => {
    if (sessionStorage.getItem("te-intro") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("gone");
      return;
    }
    const a = setTimeout(() => setPhase("fade"), 2400);
    const b = setTimeout(() => { setPhase("gone"); sessionStorage.setItem("te-intro", "1"); }, 3200);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === "gone") return null;
  return (
    <div
      onClick={() => { setPhase("gone"); sessionStorage.setItem("te-intro", "1"); }}
      className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-6 bg-background transition-opacity duration-700 ${phase === "fade" ? "opacity-0" : "opacity-100"}`}
    >
      <LogoMark size={72} animate />
      <div className="animate-fade-up font-mono text-[13px] tracking-[0.5em] text-foreground" style={{ animationDelay: "1s" }}>THIRD EYE</div>
      <div className="animate-fade-up label-xs" style={{ animationDelay: "1.4s" }}>SEE · DETECT · UNDERSTAND</div>
      <div className="absolute bottom-8 label-xs">Click to skip</div>
    </div>
  );
}
