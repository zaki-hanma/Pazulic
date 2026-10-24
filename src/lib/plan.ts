import type { Block, Occurrence, Session, Exam } from "./types";
import { isStudy } from "./types";
import { at, isoWeekday, minutesBetween } from "./dates";

/** Pomodoro: je 30 Min. = 25 Min. Lernen, Rest bis max. 25 Min. */
export function learnMinutes(start: string, end: string): number {
  const d = Math.max(0, minutesBetween(start, end));
  const c = Math.floor(d / 30);
  return c * 25 + Math.min(d - c * 30, 25);
}

export function pomodoros(start: string, end: string): number {
  return Math.max(1, Math.round(minutesBetween(start, end) / 30));
}

/** Alle Einträge eines Tages, inkl. wöchentlich wiederholter, sortiert nach Uhrzeit. */
export function occurrencesOn(blocks: Block[], date: string): Occurrence[] {
  const wd = isoWeekday(date);
  const out: Occurrence[] = [];
  for (const b of blocks) {
    if (b.repeat_weekdays && b.repeat_weekdays.length) {
      if (date >= b.date && b.repeat_weekdays.includes(wd)) out.push({ block: b, date, done: b.completed_dates.includes(date) });
    } else if (b.date === date) {
      out.push({ block: b, date, done: b.done });
    }
  }
  return out.sort((a, b) => a.block.start_time.localeCompare(b.block.start_time));
}

export function isNow(o: Occurrence, now = new Date()): boolean {
  return at(o.date, o.block.start_time) <= now && now < at(o.date, o.block.end_time);
}

export function isPast(o: Occurrence, now = new Date()): boolean {
  return at(o.date, o.block.end_time) <= now;
}

export function examProgress(exam: Exam, blocks: Block[], sessions: Session[]) {
  const planned = blocks.filter((b) => b.exam_id === exam.id && isStudy(b.kind)).reduce((a, b) => a + b.planned_minutes, 0);
  const learned = sessions.filter((s) => s.exam_id === exam.id).reduce((a, s) => a + s.minutes, 0);
  return { planned, learned, pct: planned > 0 ? Math.round((learned / planned) * 100) : 0 };
}

export function learnedForBlock(blockId: string, date: string, sessions: Session[]): number {
  return sessions.filter((s) => s.block_id === blockId && s.date === date).reduce((a, s) => a + s.minutes, 0);
}
