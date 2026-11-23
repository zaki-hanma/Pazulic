// Führerschein: Fahrstunden aus Plan und Google zählen, Sonderfahrten Klasse B.
import type { Block, CustomKind, DriveType, Driving, GoogleMark, GoogleRule } from "./types";
import type { GEvent } from "./google";
import { googleKind } from "./labels";
import { at, minutesBetween } from "./dates";
import { isRepeating, occurrencesOn } from "./plan";

export const FAHR_RE = /fahrstunde|fahrschule|sonderfahrt|autobahnfahrt|nachtfahrt|überland|ueberland|fahrprüfung|fahrpruefung|prüfungsfahrt/i;

export const DRIVE_LABEL: Record<DriveType, string> = {
  normal: "Normale Fahrstunde", ueberland: "Überland", autobahn: "Autobahn", nacht: "Nacht (Dunkelheit)", pruefung: "Prüfung", keine: "Keine Fahrstunde",
};
/** Pflicht-Sonderfahrten Klasse B (je 45 Min.) */
export const SPECIAL_NEED: Partial<Record<DriveType, number>> = { ueberland: 5, autobahn: 4, nacht: 3 };

export interface Lesson { key: string; date: string; start: string; end: string; title: string; min: number; type: DriveType; past: boolean; source: "google" | "plan" }

function guess(title: string): DriveType {
  if (/autobahn/i.test(title)) return "autobahn";
  if (/nacht|dunkel/i.test(title)) return "nacht";
  if (/überland|ueberland|landstra/i.test(title)) return "ueberland";
  if (/prüfung|pruefung/i.test(title)) return "pruefung";
  return "normal";
}

export function collectLessons(blocks: Block[], google: Map<string, GEvent[]>, marks: GoogleMark[], rules: GoogleRule[], kinds: CustomKind[], driving: Driving | undefined, now = new Date()): Lesson[] {
  const types = driving?.types ?? {};
  const isFahrKind = (id: string | null) => !!id && /fahr/i.test(kinds.find((k) => k.id === id)?.name ?? "");
  const out: Lesson[] = [];
  for (const [date, evs] of google) {
    for (const ev of evs) {
      if (ev.allDay) continue;
      const gk = googleKind(ev.title, marks.find((m) => m.uid === ev.uid && m.date === date), rules);
      if (!FAHR_RE.test(ev.title) && !isFahrKind(gk.custom)) continue;
      const key = `g|${ev.uid}|${date}`;
      out.push({ key, date, start: ev.start, end: ev.end, title: ev.title, min: Math.max(0, minutesBetween(ev.start, ev.end)), type: types[key] ?? guess(ev.title), past: at(date, ev.end) <= now, source: "google" });
    }
  }
  // Plan-Einträge (nur einzelne, keine Serien)
  const dates = new Set(blocks.filter((b) => !isRepeating(b) && (FAHR_RE.test(b.title) || isFahrKind(b.custom_kind_id))).map((b) => b.date));
  for (const d of dates) for (const o of occurrencesOn(blocks, d)) {
    const b = o.block;
    if (isRepeating(b) || !(FAHR_RE.test(b.title) || isFahrKind(b.custom_kind_id))) continue;
    const key = `b|${b.id}|${d}`;
    const s = b.start_time.slice(0, 5), e = b.end_time.slice(0, 5);
    // gleicher Termin schon aus Google? (gleiches Datum + gleiche Startzeit) → nicht doppelt zählen
    if (out.some((l) => l.date === d && l.start === s)) continue;
    out.push({ key, date: d, start: s, end: e, title: b.title, min: Math.max(0, minutesBetween(s, e)), type: types[key] ?? guess(b.title), past: at(d, e) <= now, source: "plan" });
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

/** Fahrstunden à 45 Minuten (auf halbe Stunden gerundet) */
export const units = (min: number) => Math.round((min / 45) * 2) / 2;
