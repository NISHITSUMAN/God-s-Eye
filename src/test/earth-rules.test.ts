import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER, useApp, visibleEvents } from "../lib/store";
import { EARTH_EVENTS, eventOpacity, lodForAltitude } from "../lib/earth-data";
const state = () => ({ layers:new Set(EARTH_EVENTS.map(e => e.type)), filter:{...DEFAULT_FILTER}, time:{start:"2026-01-01",end:"2026-12-31",current:"2026-12-31"},lod:"global" as const });
describe("Earth scientific visibility", () => {
 it("keeps low-confidence candidates discoverable by default", () => { expect(visibleEvents(state()).some(e => e.confidence === "Low")).toBe(true); });
 it("high significance requires high severity and confidence", () => { const s=state();s.filter.significance="high";expect(visibleEvents(s).map(e=>e.id)).toEqual(["EV-0355","EV-0330","EV-0276"]); });
 it("moderate+ confidence excludes low candidates", () => { const s=state();s.filter.confidence="moderate+";expect(visibleEvents(s).some(e=>e.confidence==="Low")).toBe(false); });
 it("time cursor excludes future observations", () => { const s=state();s.time.current="2026-06-01";expect(visibleEvents(s).some(e=>e.id==="EV-0412")).toBe(false); });
 it("opacity uses 100%, 68%, and 38% confidence intensity", () => { for(const [confidence,alpha] of [["High",1],["Moderate",.68],["Low",.38]] as const){const e=EARTH_EVENTS.find(e=>e.confidence===confidence);expect(e && eventOpacity(e)).toBe(alpha);} });
 it("camera detail changes from global through analysis", () => {expect([2.4,1,.4,.1].map(lodForAltitude)).toEqual(["global","regional","local","analysis"]);});
 it("switching Earth mode preserves camera and selected object",()=>{useApp.getState().select("EV-0412");const before=useApp.getState().view;useApp.getState().setEarthMode("2d");expect(useApp.getState().selectedId).toBe("EV-0412");expect(useApp.getState().view).toEqual(before);});
 it("comparison keeps the investigation geography",()=>{useApp.getState().setFilter({region:"Maharashtra",types:["flood"]});useApp.getState().setInvestigation({comparison:"historical"});expect(useApp.getState().investigation.region).toBe("Maharashtra");expect(useApp.getState().investigation.types).toEqual(["flood"]);});
});
