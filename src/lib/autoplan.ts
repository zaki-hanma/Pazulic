// Auto-Plan: verteilt Lernblöcke (Pomodoro) zwischen heute und der Klausur in die freien Zeiten.
import type { Block, Exam, Session } from "./types";
import { addDays, isoWeekday, minutesBetween, today } from "./dates";
import { learnMinutes, occurrencesOn, examProgress } from "./plan";
import type { GEvent } from "./google";

export interface AutoOptions {
  targetMin: number;        // Ziel-Lernzeit (reine Lernminuten)
  maxPerDayMin: number;     // max. Lernminuten pro Tag
  startWeekday: string;     // z. B. "17:00"
  startWeekend: string;     // z. B. "10:00"
  endTime: string;          // z. B. "21:30"
  freeDays: number[];       // Wochentage ohne Lernen (1=Mo … 7=So)
  startDate: string;        // ab wann geplant wird (z. B. Tag nach der vorherigen Klausur)
  blockMin: number;         // Länge eines Lernblocks inkl. Pausen (60 = 2 Pomodoros)
  gapMin: number;           // Abstand zwischen zwei Lernblöcken (für Alltag/Essen)
}

export interface Proposal { date: string; start: string; end: string; kind: "lernen" | "wiederholung"; title: string; topic_ids: string[]; planned: number }

const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(":").map(Number); return h * 60 + m; };
const toT = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Freie Zeitfenster eines Tages (in Minuten ab 0:00). */
function freeSlots(date: string, blocks: Block[], google: Map<string, GEvent[]>, from: number, to: number, nowMin: number | null) {
  const busy: [number, number][] = [];
  for (const o of occurrencesOn(blocks, date)) { const a = toMin(o.block.start_time), b = toMin(o.block.end_time); busy.push(b > a ? [a - 10, b + 10] : [a - 10, 1440]); }
  // Über Mitternacht vom Vortag (z. B. Schlafen bis 06:00)
  for (const o of occurrencesOn(blocks, addDays(date, -1))) { const a = toMin(o.block.start_time), b = toMin(o.block.end_time); if (b <= a) busy.push([0, b + 10]); }
  for (const g of google.get(date) ?? []) if (!g.allDay) busy.push([toMin(g.start) - 10, toMin(g.end) + 10]);
  busy.sort((a, b) => a[0] - b[0]);
  const slots: [number, number][] = [];
  let cur = Math.max(from, nowMin ?? 0);
  cur = Math.ceil(cur / 5) * 5;
  for (const [s, e] of busy) {
    if (e <= cur) continue;
    if (s > cur) slots.push([cur, Math.min(s, to)]);
    cur = Math.max(cur, e);
    if (cur >= to) break;
  }
  if (cur < to) slots.push([cur, to]);
  return slots.filter(([s, e]) => e - s >= 30);
}

/** Ein Tag mit Nachhilfe = an diesem Tag nicht lernen (Wunsch von Zaki). */
const blockedDay = (date: string, blocks: Block[]) => occurrencesOn(blocks, date).some((o) => o.block.kind === "nachhilfe");

export function makePlan(exam: Exam, blocks: Block[], google: Map<string, GEvent[]>, o: AutoOptions, now = new Date()): { items: Proposal[]; missing: number } {
  const t = today();
  const days: string[] = [];
  for (let d = o.startDate > t ? o.startDate : t; d < exam.date; d = addDays(d, 1)) {
    if (o.freeDays.includes(isoWeekday(d)) || blockedDay(d, blocks)) continue;
    days.push(d);
  }
  const perBlock = learnMinutes("00:00", toT(o.blockMin));
  // Lernminuten pro Tag gleichmäßig verteilen, aber höchstens maxPerDay
  const need = Math.max(0, o.targetMin);
  const raw: { date: string; start: number; end: number }[] = [];
  let left = need;
  // Lieber weniger Tage mit mind. einem ganzen Block (2 Pomodoros) als jeden Tag nur 25 Min.
  const nDays = Math.min(days.length, Math.max(1, Math.ceil(need / perBlock)));
  const chosen = nDays <= 1 ? days.slice(-1) : Array.from({ length: nDays }, (_, i) => days[Math.round((i * (days.length - 1)) / (nDays - 1))]);
  const useDays = [...new Set(chosen)];
  for (let i = 0; i < useDays.length && left > 0; i++) {
    const d = useDays[i];
    const daysLeft = useDays.length - i;
    const quota = Math.min(o.maxPerDayMin, Math.max(Math.min(perBlock, left), Math.ceil(left / daysLeft / 25) * 25));
    const we = isoWeekday(d) >= 6;
    const nowMin = d === t ? now.getHours() * 60 + now.getMinutes() + 15 : null;
    let got = 0;
    for (const [s, e] of freeSlots(d, blocks, google, toMin(we ? o.startWeekend : o.startWeekday), toMin(o.endTime), nowMin)) {
      let c = s;
      while (got < quota && c + 30 <= e) {
        const wantLearn = Math.min(perBlock, quota - got);
        // Dauer inkl. 5-Min.-Pausen: je 25 Min. Lernen = 30 Min.
        let len = Math.ceil(wantLearn / 25) * 30;
        len = Math.min(len, e - c, o.blockMin);
        len = Math.floor(len / 5) * 5;
        if (len < 30) break;
        const lm = learnMinutes(toT(c), toT(c + len));
        raw.push({ date: d, start: c, end: c + len });
        got += lm; left -= lm;
        c += len + o.gapMin;
      }
      if (got >= quota) break;
    }
  }

  // Zweiter Durchgang: Rest auf noch freie Tage verteilen
  if (left > 0) {
    for (const d of days) {
      if (left <= 0) break;
      if (raw.some((r) => r.date === d)) continue;
      const we = isoWeekday(d) >= 6;
      const nowMin = d === t ? now.getHours() * 60 + now.getMinutes() + 15 : null;
      for (const [s, e] of freeSlots(d, blocks, google, toMin(we ? o.startWeekend : o.startWeekday), toMin(o.endTime), nowMin)) {
        if (left <= 0 || e - s < 30) continue;
        const len = Math.min(o.blockMin, Math.floor((e - s) / 5) * 5, Math.ceil(left / 25) * 30);
        if (len < 30) continue;
        raw.push({ date: d, start: s, end: s + len });
        left -= learnMinutes(toT(s), toT(s + len));
        break;
      }
    }
    raw.sort((a, b) => (a.date + toT(a.start)).localeCompare(b.date + toT(b.start)));
  }

  // Themen der Reihe nach verteilen, die letzten ~15 % = Wiederholung aller Themen
  const topics = exam.topics.length ? exam.topics : [{ id: "", name: exam.short_name || exam.subject, short: "" }];
  const total = raw.reduce((a, r) => a + learnMinutes(toT(r.start), toT(r.end)), 0);
  const reviewFrom = total * 0.85;
  const perTopic = reviewFrom / topics.length;
  let acc = 0;
  const items: Proposal[] = raw.map((r) => {
    const lm = learnMinutes(toT(r.start), toT(r.end));
    const mid = acc + lm / 2;
    acc += lm;
    if (mid >= reviewFrom && total > 0) {
      return { date: r.date, start: toT(r.start), end: toT(r.end), kind: "wiederholung", title: "Wiederholung & Lücken schließen", topic_ids: exam.topics.map((x) => x.id), planned: lm };
    }
    const tp = topics[Math.min(topics.length - 1, Math.floor(mid / perTopic))];
    return { date: r.date, start: toT(r.start), end: toT(r.end), kind: "lernen", title: tp.short || tp.name, topic_ids: tp.id ? [tp.id] : [], planned: lm };
  });
  return { items, missing: Math.max(0, need - total) };
}

/** Erster Planungstag: der Tag nach der letzten Klausur, die vor dieser Klausur liegt (sonst heute). */
export function defaultStart(exam: Exam, exams: Exam[]): { date: string; after: Exam | null } {
  const t = today();
  const before = exams.filter((e) => e.id !== exam.id && e.date >= t && e.date < exam.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  return before ? { date: addDays(before.date, 1), after: before } : { date: t, after: null };
}

/** Lerneffekt: Wie viel länger (oder kürzer) brauchst du im Schnitt? Aus vergangenen Klausuren. */
export function learnFactor(exam: Exam, exams: Exam[], blocks: Block[], sessions: Session[]): { factor: number; basis: number; sameSubject: boolean } {
  const past = exams.filter((e) => e.id !== exam.id && e.date < today());
  const ratios = (list: Exam[]) => list.map((e) => examProgress(e, blocks, sessions)).filter((p) => p.planned >= 60 && p.learned > 0).map((p) => p.learned / p.planned);
  const same = ratios(past.filter((e) => e.subject === exam.subject || (e.short_name && e.short_name === exam.short_name)));
  const all = ratios(past);
  const use = same.length ? same : all;
  if (!use.length) return { factor: 1, basis: 0, sameSubject: false };
  const f = use.reduce((a, b) => a + b, 0) / use.length;
  // nur nach oben anpassen: weniger gelernt heißt nicht „schneller fertig“
  return { factor: Math.min(2.5, Math.max(1, f)), basis: use.length, sameSubject: same.length > 0 };
}

export { minutesBetween };
