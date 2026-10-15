import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUp, Check, Circle, Mic, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { runCommand } from "@/lib/ai-agent";
import { cn } from "@/lib/utils";

const EXAMPLES = ["Show me fires in India", "Show potential floods in Maharashtra", "Find landslide candidates in the Himalayas", "Show the strongest deformation"];

export function CommandBar() {
  const [v, setV] = useState("");
  const navigate = useNavigate();
  const active = useApp((s) => s.aiActive);
  const setActive = useApp((s) => s.setAIActive);
  const messages = useApp((s) => s.aiMessages);
  const steps = useApp((s) => s.aiSteps);
  const title = useApp((s) => s.aiTitle);
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => { feed.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [messages, steps]);

  const submit = (t: string) => { if (!t.trim() || steps) return; setV(""); void runCommand(t); };
  const runAction = (action: string) => {
    if (action.startsWith("navigate:")) {
      const destination = action.slice("navigate:".length) as "/" | "/reports/create" | "/analyze" | "/data" | "/datasets" | "/observations" | "/events" | "/discover" | "/methodology" | "/learn";
      void navigate({ to: destination as never });
      setActive(false);
      return;
    }
    submit(action);
  };

  return (
    <div className="w-full max-w-[720px]">
      {active && (messages.length > 0 || steps) && (
        <div className="glass mb-2 animate-fade-up">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-primary"><span className="size-1.5 rounded-full bg-primary animate-ai-pulse" />THIRD EYE</span>
            <button onClick={() => setActive(false)} aria-label="Minimize"><X className="size-3.5 text-subtle hover:text-foreground" /></button>
          </div>
          <div ref={feed} className="scroll-thin max-h-[260px] space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m) => m.role === "user" ? (
              <div key={m.id} className="font-mono text-[11px] text-subtle">› {m.text}</div>
            ) : (
              <div key={m.id} className="border-l border-primary/50 pl-3">
                <p className="text-[13px] leading-relaxed">{m.text}</p>
                {m.actions && (
                  <div className="mt-2 flex gap-1.5">
                    {m.actions.filter((a) => a.run !== "noop").map((a) => (
                      <button key={a.label} onClick={() => runAction(a.run)} className="rounded-md border border-border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase text-muted-foreground hover:border-primary hover:text-primary">{a.label}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {steps && (
              <div className="space-y-1">
                <div className="label-xs mb-1.5 text-primary">{title}</div>
                {steps.map((s) => (
                  <div key={s.label} className={cn("flex items-center gap-2 text-[12px]", s.status === "pending" ? "text-subtle" : "text-foreground")}>
                    {s.status === "done" ? <Check className="size-3 text-ok" /> : s.status === "active" ? <span className="size-2 rounded-full bg-primary animate-ai-pulse" /> : <Circle className="size-2.5" />}
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {!active && messages.length === 0 && (
        <div className="command-examples mb-2 flex flex-wrap justify-center gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => submit(e)} className="glass px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">{e}</button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); submit(v); }}
        className={cn("glass flex items-center gap-3 px-4 py-2.5 transition-shadow", active && "glow-cyan")}>
        <span className={cn("size-2 rounded-full bg-primary", (active || steps) && "animate-ai-pulse")} />
        <input value={v} onChange={(e) => setV(e.target.value)} onFocus={() => setActive(true)} placeholder="Ask or search…" className="flex-1 bg-transparent text-[14px] placeholder:text-subtle focus:outline-none" />
        <button type="button" title="Voice input is not connected in this prototype" aria-label="Voice input unavailable in this prototype" className="cursor-not-allowed text-subtle opacity-50" disabled><Mic className="size-4" strokeWidth={1.5} /></button>
        <button type="submit" disabled={!v.trim()} className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:bg-elevated disabled:text-subtle" aria-label="Send"><ArrowUp className="size-4" /></button>
      </form>
    </div>
  );
}
