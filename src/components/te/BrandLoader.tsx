import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

function hasSeenIntro() {
  try { return sessionStorage.getItem("te-intro") === "1"; } catch { return false; }
}
function markIntroSeen() {
  try { sessionStorage.setItem("te-intro", "1"); } catch { /* session storage can be unavailable */ }
}

export function BrandLoader() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  useEffect(() => {
    if (hasSeenIntro() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("gone");
      return;
    }
    const a = setTimeout(() => setPhase("fade"), 2400);
    const b = setTimeout(() => { setPhase("gone"); markIntroSeen(); }, 3200);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === "gone") return null;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Skip Third Eye introduction"
      onClick={() => { setPhase("gone"); markIntroSeen(); }}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setPhase("gone");
          markIntroSeen();
        }
      }}
      className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-6 bg-background transition-opacity duration-700 ${phase === "fade" ? "opacity-0" : "opacity-100"}`}
    >
      <LogoMark size={72} animate />
      <div className="animate-fade-up font-mono text-[13px] tracking-[0.5em] text-foreground" style={{ animationDelay: "1s" }}>THIRD EYE</div>
      <div className="animate-fade-up label-xs" style={{ animationDelay: "1.4s" }}>SEE · DETECT · UNDERSTAND</div>
      <div className="absolute bottom-8 label-xs">Click to skip</div>
    </div>
  );
}
