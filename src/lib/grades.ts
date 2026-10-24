// Noten-Rechnung nach den Bewertungsgrundsätzen der BBS Buxtehude (Stand Juli 2025).
import type { Grade } from "./types";

export interface Subject { key: string; name: string; hours: number; written: number; area: "ueber" | "bezogen" }

export const SUBJECTS: Subject[] = [
  { key: "Deutsch", name: "Deutsch/Kommunikation", hours: 3, written: 50, area: "ueber" },
  { key: "Englisch", name: "Englisch/Kommunikation", hours: 2, written: 50, area: "ueber" },
  { key: "Politik", name: "Politik", hours: 4, written: 50, area: "ueber" },
  { key: "Sport", name: "Sport", hours: 1, written: 0, area: "ueber" },
  { key: "Religion", name: "Religion", hours: 1, written: 40, area: "ueber" },
  { key: "LF0", name: "LF0 Praktische Umsetzung Webshop", hours: 2, written: 0, area: "bezogen" },
  { key: "LF1", name: "LF1 Das Unternehmen präsentieren", hours: 2, written: 50, area: "bezogen" },
  { key: "LF2", name: "LF2 Online-Sortimente & Beschaffung", hours: 2, written: 50, area: "bezogen" },
  { key: "LF3", name: "LF3 Verträge im Online-Vertrieb", hours: 3, written: 50, area: "bezogen" },
  { key: "LF4", name: "LF4 Werteströme erfassen", hours: 1, written: 60, area: "bezogen" },
  { key: "LF5", name: "LF5 Rückabwicklung & Leistungsstörungen", hours: 1, written: 50, area: "bezogen" },
  { key: "LF6", name: "LF6 Servicekommunikation", hours: 1.5, written: 50, area: "bezogen" },
  { key: "LF7", name: "LF7 Online-Marketing", hours: 3, written: 50, area: "bezogen" },
  { key: "LF8", name: "LF8 Wertschöpfungsprozesse", hours: 1.5, written: 60, area: "bezogen" },
  { key: "LF9", name: "LF9 Online-Vertriebskanäle", hours: 2, written: 50, area: "bezogen" },
  { key: "LF10", name: "LF10 Online-Vertrieb kennzahlengestützt", hours: 2, written: 60, area: "bezogen" },
  { key: "LF11", name: "LF11 Gesamtwirtschaftliche Einflüsse", hours: 1, written: 60, area: "bezogen" },
  { key: "LF12", name: "LF12 Berufsbezogene Projekte", hours: 1, written: 60, area: "bezogen" },
];
export const subjectOf = (k: string) => SUBJECTS.find((s) => s.key === k);

export const KIND_NAME: Record<Grade["kind"], string> = { klausur: "Klausur", projekt: "Projekt", sonstige: "sonstige Note", muendlich: "mündlich" };

export const WORD = ["", "sehr gut", "gut", "befriedigend", "ausreichend", "mangelhaft", "ungenügend"];

/** „3−“ → 3,3 · „2+“ → 1,7 · „2,6“ → 2,6 */
export function parseGrade(t: string | null | undefined): number | null {
  if (!t) return null;
  const s = t.trim().replace(/[–—−]/g, "-").replace(",", ".");
  const m = s.match(/^([1-6](?:\.\d+)?)\s*([+-])?$/);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (m[2] === "+") v -= 0.3;
  if (m[2] === "-") v += 0.3;
  return Math.min(6, Math.max(1, Math.round(v * 100) / 100));
}

export function pct(g: Grade): number | null {
  return g.points != null && g.max_points ? (g.points / g.max_points) * 100 : null;
}

export function gradeFromPct(p: number): number {
  return p >= 92 ? 1 : p >= 81 ? 2 : p >= 67 ? 3 : p >= 50 ? 4 : p >= 30 ? 5 : 6;
}

/** Note einer Leistung: Lehrkraft-Note zählt immer, sonst aus Prozent. */
export function gradeValue(g: Grade): number | null {
  const t = parseGrade(g.grade_text);
  if (t != null) return t;
  const p = pct(g);
  return p == null ? null : gradeFromPct(p);
}

/** Kaufmännisch runden: bis x,49 ab, ab x,50 auf. */
export const roundGrade = (v: number) => Math.min(6, Math.max(1, Math.floor(Math.round(v * 100) / 100 + 0.5)));
export const one = (v: number) => Math.round(v * 10) / 10;
export const fmt1 = (v: number | null) => (v == null ? "–" : one(v).toFixed(1).replace(".", ","));
export const fmtNum = (v: number | null) => (v == null ? "–" : String(Math.round(v * 100) / 100).replace(".", ","));

export function gradeColor(v: number | null): string {
  if (v == null) return "var(--muted)";
  if (v < 2.5) return "var(--green)";
  if (v < 3.5) return "#4FD1C5";
  if (v < 4.5) return "var(--orange)";
  return "var(--red)";
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export interface SubjectResult {
  key: string; subject: Subject; count: number; written: number | null; oral: number | null; note: number | null;
}

function rawNote(list: Grade[], sub: Subject) {
  const w = avg(list.filter((g) => g.kind !== "muendlich").map(gradeValue).filter((x): x is number => x != null));
  const o = avg(list.filter((g) => g.kind === "muendlich").map(gradeValue).filter((x): x is number => x != null));
  let note: number | null = null;
  if (w != null && o != null) note = (w * sub.written + o * (100 - sub.written)) / 100;
  else note = w ?? o; // fehlt ein Teil, zählt der andere zu 100 %
  return { w, o, note };
}

export function subjectResults(grades: Grade[], year: string): SubjectResult[] {
  const yg = grades.filter((g) => g.school_year === year);
  const out: SubjectResult[] = [];
  for (const sub of SUBJECTS) {
    const list = yg.filter((g) => g.subject === sub.key);
    if (!list.length) continue;
    const r = rawNote(list, sub);
    out.push({ key: sub.key, subject: sub, count: list.length, written: r.w, oral: r.o, note: r.note });
  }
  // Andere (eigene) Fächer
  for (const k of [...new Set(yg.map((g) => g.subject))].filter((k) => !subjectOf(k))) {
    const sub: Subject = { key: k, name: k, hours: 1, written: 50, area: "bezogen" };
    const list = yg.filter((g) => g.subject === k);
    const r = rawNote(list, sub);
    out.push({ key: k, subject: sub, count: list.length, written: r.w, oral: r.o, note: r.note });
  }
  return out;
}

/** Zeugnis: LF0 wird 1:1 mit LF2 verrechnet und erscheint nicht eigenständig. */
export function reportSubjects(results: SubjectResult[]): SubjectResult[] {
  const lf0 = results.find((r) => r.key === "LF0");
  return results.filter((r) => r.key !== "LF0").map((r) => {
    if (r.key === "LF2" && lf0?.note != null && r.note != null) return { ...r, note: (r.note + lf0.note) / 2 };
    return r;
  }).concat(lf0 && !results.find((r) => r.key === "LF2") ? [{ ...lf0, key: "LF2", subject: subjectOf("LF2")! }] : []);
}

/** Bereichsnote: Fachnoten mit 1 Kommastelle, gewichtet nach Sollstunden. */
export function areaNote(list: SubjectResult[]): number | null {
  const v = list.filter((r) => r.note != null);
  const h = v.reduce((a, r) => a + r.subject.hours, 0);
  return h ? v.reduce((a, r) => a + one(r.note!) * r.subject.hours, 0) / h : null;
}

/** Aktuelles Schuljahr (Wechsel am 1. August), z. B. „2026/27“. */
export function currentYear(d = new Date()): string {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${String(y + 1).slice(2)}`;
}
export const yearLabel = (y: string) => { const a = parseInt(y.slice(0, 4), 10); return `${a} & ${a + 1}`; };
