// Urlaub und Frei (Überstunden): aus Google, aus Plan-Einträgen dieser Art und selbst eingetragen (🌴).
import { useMemo } from "react";
import { useStore } from "./store";
import { useGoogle } from "./google";
import { addDays, today } from "./dates";
import { isRepeating, occurrencesOn } from "./plan";
import { googleKind } from "./labels";
import type { Block } from "./types";
import { isOff } from "./types";

export { URL_RE, FREI_RE } from "./labels";

export type OffType = "urlaub" | "frei";
export const OFF_LABEL: Record<OffType, string> = { urlaub: "Urlaub", frei: "Frei (Überstunden)" };
export const OFF_ICON: Record<OffType, string> = { urlaub: "🌴", frei: "☀️" };

export interface Period { key: string; start: string; end: string; name: string; type: OffType; source: "google" | "app" }
export interface OffDay { name: string; type: OffType }

export function useVacations() {
  const { settings, blocks, googleMarks, googleRules } = useStore();
  const google = useGoogle().byDate;

  return useMemo(() => {
    const day = new Map<string, OffDay>();
    const found: { d: string; name: string; type: OffType; source: "google" | "app" }[] = [];

    // 1) Google-Termine (Name enthält „Urlaub“ / „Überstunden“ … oder Art von Hand gewählt)
    for (const [d, evs] of google) {
      for (const g of evs) {
        const k = googleKind(g.title, googleMarks.find((m) => m.uid === g.uid && m.date === d), googleRules).kind;
        if (isOff(k)) { found.push({ d, name: g.title, type: k as OffType, source: "google" }); break; }
      }
    }
    // 2) Plan-Einträge mit Art „Urlaub“ oder „Frei“ (nicht wiederholt)
    for (const b of blocks) if (isOff(b.kind) && !isRepeating(b) && !b.skip_dates?.includes(b.date)) found.push({ d: b.date, name: b.title, type: b.kind as OffType, source: "app" });
    // 3) Selbst eingetragene Zeiträume
    const periods: Period[] = [];
    for (const v of settings.vacations ?? []) {
      const type = v.type ?? "urlaub";
      periods.push({ key: "", start: v.start, end: v.end, name: v.name || OFF_LABEL[type], type, source: "app" });
      for (let d = v.start; d <= v.end; d = addDays(d, 1)) if (!day.has(d)) day.set(d, { name: v.name || OFF_LABEL[type], type });
    }

    // Einzelne Tage zu Zeiträumen zusammenfassen (gleiche Art, aufeinanderfolgend)
    found.sort((a, b) => a.type.localeCompare(b.type) || a.d.localeCompare(b.d));
    let cur: Period | null = null;
    for (const f of found) {
      if (!day.has(f.d) || day.get(f.d)!.type === "frei") day.set(f.d, { name: f.name, type: f.type });
      if (cur && cur.type === f.type && (cur.end === f.d || addDays(cur.end, 1) === f.d)) { cur.end = f.d; continue; }
      cur = { key: "", start: f.d, end: f.d, name: f.name, type: f.type, source: f.source };
      periods.push(cur);
    }
    for (const p of periods) p.key = `${p.type === "frei" ? "frei:" : ""}${p.start}_${p.end}`;
    periods.sort((a, b) => a.start.localeCompare(b.start));
    return { off: (d: string) => day.get(d) ?? null, periods };
  }, [google, settings.vacations, blocks, googleMarks, googleRules]);
}

export interface Affected { b: Block; dates: string[] }

/** Wiederholte Einträge (Alltag), die im Urlaub/Frei (ab heute) noch im Plan stehen. */
export function affectedBy(p: Period, blocks: Block[]): Affected[] {
  const from = p.start > today() ? p.start : today();
  const map = new Map<string, Affected>();
  for (let d = from; d <= p.end; d = addDays(d, 1)) {
    for (const o of occurrencesOn(blocks, d)) {
      if (!isRepeating(o.block) || isOff(o.block.kind)) continue;
      const a = map.get(o.block.id) ?? { b: o.block, dates: [] };
      a.dates.push(d);
      map.set(o.block.id, a);
    }
  }
  return [...map.values()];
}
