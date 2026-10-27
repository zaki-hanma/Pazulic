import type { Block, Occurrence, Session, Exam, RepeatRule } from "./types";
import { isStudy } from "./types";
import { at, isoWeekday, minutesBetween, parseYmd, addDays, overnight } from "./dates";

/** Pomodoro: je 30 Min. = 25 Min. Lernen, Rest bis max. 25 Min. */
export function learnMinutes(start: string, end: string): number {
  const d = Math.max(0, minutesBetween(start, end));
  const c = Math.floor(d / 30);
  return c * 25 + Math.min(d - c * 30, 25);
}

export function pomodoros(start: string, end: string): number {
  return Math.max(1, Math.round(minutesBetween(start, end) / 30));
}

export const isRepeating = (b: Block) => !!b.repeat_rule || !!(b.repeat_weekdays && b.repeat_weekdays.length);

const dayDiff = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 864e5);
const mondayOf = (d: string) => addDays(d, 1 - isoWeekday(d));

/** Passt das Datum zur Wiederholungs-Regel (Start = b.date)? */
export function matchesRule(r: RepeatRule, start: string, date: string): boolean {
  if (date < start) return false;
  if (r.until && date > r.until) return false;
  const n = Math.max(1, r.interval || 1);
  const d = parseYmd(date), s = parseYmd(start);
  switch (r.freq) {
    case "daily": return dayDiff(start, date) % n === 0;
    case "weekly": {
      const wds = r.weekdays?.length ? r.weekdays : [isoWeekday(start)];
      if (!wds.includes(isoWeekday(date))) return false;
      return (dayDiff(mondayOf(start), mondayOf(date)) / 7) % n === 0;
    }
    case "monthly": {
      const months = (d.getFullYear() - s.getFullYear()) * 12 + d.getMonth() - s.getMonth();
      if (months % n !== 0) return false;
      if (r.monthMode === "nth") {
        const wd = r.nthWeekday ?? isoWeekday(start);
        if (isoWeekday(date) !== wd) return false;
        const nth = r.nth ?? 1;
        if (nth === -1) return d.getMonth() !== parseYmd(addDays(date, 7)).getMonth();
        return Math.ceil(d.getDate() / 7) === nth;
      }
      const want = r.monthDay ?? s.getDate();
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(want, last);
    }
    case "yearly":
      return d.getMonth() === s.getMonth() && d.getDate() === s.getDate() && (d.getFullYear() - s.getFullYear()) % n === 0;
  }
  return false;
}

/** Alle Einträge eines Tages, inkl. wiederholter, sortiert nach Uhrzeit. */
export function occurrencesOn(blocks: Block[], date: string): Occurrence[] {
  const wd = isoWeekday(date);
  const out: Occurrence[] = [];
  for (const b of blocks) {
    if (b.skip_dates?.includes(date)) continue;
    if (b.repeat_rule) {
      if (matchesRule(b.repeat_rule, b.date, date)) out.push({ block: b, date, done: b.completed_dates.includes(date) });
    } else if (b.repeat_weekdays && b.repeat_weekdays.length) {
      if (date >= b.date && b.repeat_weekdays.includes(wd)) out.push({ block: b, date, done: b.completed_dates.includes(date) });
    } else if (b.date === date) {
      out.push({ block: b, date, done: b.done });
    }
  }
  return out.sort((a, b) => a.block.start_time.localeCompare(b.block.start_time));
}

/** Kurzer Text zur Wiederholung, z. B. „jeden letzten Mi im Monat“. */
export function ruleText(b: Block): string {
  const WD = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const r = b.repeat_rule;
  if (!r) return b.repeat_weekdays?.length ? "jede Woche " + b.repeat_weekdays.map((x) => WD[x]).join(", ") : "";
  const n = Math.max(1, r.interval || 1);
  let t = "";
  if (r.freq === "daily") t = n === 1 ? "jeden Tag" : `alle ${n} Tage`;
  if (r.freq === "weekly") t = (n === 1 ? "jede Woche" : n === 2 ? "alle 14 Tage" : `alle ${n} Wochen`) + " " + (r.weekdays?.length ? r.weekdays : [isoWeekday(b.date)]).map((x) => WD[x]).join(", ");
  if (r.freq === "monthly") {
    const m = n === 1 ? "jeden Monat" : `alle ${n} Monate`;
    t = r.monthMode === "nth" ? `${m} am ${r.nth === -1 ? "letzten" : r.nth + "."} ${WD[r.nthWeekday ?? isoWeekday(b.date)]}` : `${m} am ${r.monthDay ?? parseYmd(b.date).getDate()}.`;
  }
  if (r.freq === "yearly") t = n === 1 ? "jedes Jahr" : `alle ${n} Jahre`;
  if (r.until) t += ` bis ${r.until.split("-").reverse().join(".")}`;
  return t;
}

/** Ende als Datum/Zeit – bei Einträgen über Mitternacht am nächsten Tag. */
export const endAt = (o: Occurrence) => at(overnight(o.block.start_time, o.block.end_time) ? addDays(o.date, 1) : o.date, o.block.end_time);

export function isNow(o: Occurrence, now = new Date()): boolean {
  return at(o.date, o.block.start_time) <= now && now < endAt(o);
}

export function isPast(o: Occurrence, now = new Date()): boolean {
  return endAt(o) <= now;
}

/** Einträge vom Vortag, die über Mitternacht gehen und jetzt noch laufen (z. B. Schlafen). */
export function runningFromYesterday(blocks: Block[], date: string, now = new Date()): Occurrence[] {
  return occurrencesOn(blocks, addDays(date, -1)).filter((o) => overnight(o.block.start_time, o.block.end_time) && isNow(o, now));
}

export function examProgress(exam: Exam, blocks: Block[], sessions: Session[]) {
  const planned = blocks.filter((b) => b.exam_id === exam.id && isStudy(b.kind)).reduce((a, b) => a + b.planned_minutes, 0);
  const learned = sessions.filter((s) => s.exam_id === exam.id).reduce((a, s) => a + s.minutes, 0);
  return { planned, learned, pct: planned > 0 ? Math.round((learned / planned) * 100) : 0 };
}

export function learnedForBlock(blockId: string, date: string, sessions: Session[]): number {
  return sessions.filter((s) => s.block_id === blockId && s.date === date).reduce((a, s) => a + s.minutes, 0);
}
