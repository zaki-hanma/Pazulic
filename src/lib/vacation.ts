// Urlaub: aus Google (ganztägige Termine mit „Urlaub“) und selbst eingetragen in der App.
import { useMemo } from "react";
import { useStore } from "./store";
import { useGoogle } from "./google";
import { addDays, today } from "./dates";
import { isRepeating, occurrencesOn } from "./plan";
import type { Block } from "./types";

export const URL_RE = /urlaub|vacation|betriebsferien/i;

export interface Period { key: string; start: string; end: string; name: string; source: "google" | "app" }

export function useVacations() {
  const { settings } = useStore();
  const google = useGoogle().byDate;

  return useMemo(() => {
    const day = new Map<string, string>(); // Datum → Name
    // 1) Google: zusammenhängende Tage zu einem Zeitraum zusammenfassen
    const gDays = [...google.entries()]
      .map(([d, evs]) => [d, evs.find((g) => g.allDay && URL_RE.test(g.title))?.title] as const)
      .filter((x): x is readonly [string, string] => !!x[1])
      .sort((a, b) => a[0].localeCompare(b[0]));
    const periods: Period[] = [];
    for (const [d, name] of gDays) {
      day.set(d, name);
      const last = periods[periods.length - 1];
      if (last && last.source === "google" && addDays(last.end, 1) === d) last.end = d;
      else periods.push({ key: "", start: d, end: d, name, source: "google" });
    }
    // 2) In der App eingetragen
    for (const v of settings.vacations ?? []) {
      periods.push({ key: "", start: v.start, end: v.end, name: v.name || "Urlaub", source: "app" });
      for (let d = v.start; d <= v.end; d = addDays(d, 1)) if (!day.has(d)) day.set(d, v.name || "Urlaub");
    }
    for (const p of periods) p.key = `${p.start}_${p.end}`;
    periods.sort((a, b) => a.start.localeCompare(b.start));
    return { name: (d: string) => day.get(d) ?? null, periods };
  }, [google, settings.vacations]);
}

export interface Affected { b: Block; dates: string[] }

/** Wiederholte Einträge (Alltag), die im Urlaub (ab heute) noch im Plan stehen. */
export function affectedBy(p: Period, blocks: Block[]): Affected[] {
  const from = p.start > today() ? p.start : today();
  const map = new Map<string, Affected>();
  for (let d = from; d <= p.end; d = addDays(d, 1)) {
    for (const o of occurrencesOn(blocks, d)) {
      if (!isRepeating(o.block)) continue;
      const a = map.get(o.block.id) ?? { b: o.block, dates: [] };
      a.dates.push(d);
      map.set(o.block.id, a);
    }
  }
  return [...map.values()];
}
