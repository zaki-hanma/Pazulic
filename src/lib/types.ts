export type Kind =
  | "lernen" | "wiederholung" | "essen" | "freizeit" | "schlafen" | "arbeit"
  | "unterwegs" | "termin" | "gespraech" | "nachhilfe" | "sonstiges";

export interface Topic { id: string; name: string; short?: string }

export interface Exam {
  id: string; user_id?: string; subject: string; short_name: string | null;
  date: string; time: string; topics: Topic[]; created_at?: string;
}

export interface Block {
  id: string; user_id?: string; exam_id: string | null; date: string;
  start_time: string; end_time: string; kind: Kind; title: string;
  topic_ids: string[]; planned_minutes: number; done: boolean;
  repeat_weekdays: number[] | null; completed_dates: string[]; created_at?: string;
  custom_kind_id: string | null; repeat_rule: RepeatRule | null; skip_dates: string[];
  remind_minutes?: number | null;
}

/** Wiederholung: täglich / wöchentlich / monatlich / jährlich, jeweils „alle N“. */
export interface RepeatRule {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays?: number[];        // weekly: 1=Mo … 7=So
  monthMode?: "day" | "nth";  // monthly: am X. Tag oder am n-ten Wochentag
  monthDay?: number;          // 1–31
  nth?: number;               // 1–4 oder -1 = letzter
  nthWeekday?: number;        // 1–7
  until?: string | null;
}

export interface GoogleRule { id: string; match: string; kind: Kind | null; custom_kind_id: string | null }
export interface CustomKind { id: string; user_id?: string; name: string; color: string; remind_minutes?: number | null }
export interface GoogleMark {
  id: string; user_id?: string; uid: string; date: string; done: boolean; hidden: boolean;
  minutes: number | null; kind: Kind | null; custom_kind_id: string | null;
}

export interface Session {
  id: string; user_id?: string; block_id: string | null; exam_id: string | null; goal_id: string | null;
  subject: string; lernfeld: string | null; topic: string; date: string; minutes: number;
  source: "timer" | "manuell"; created_at?: string;
}

export interface TimerState {
  user_id?: string; block_id: string | null; goal_id: string | null; running: boolean;
  started_at: string | null; acc_ms: number; meta: Record<string, unknown>;
}

export type GradeKind = "klausur" | "projekt" | "sonstige" | "muendlich";
export interface Grade {
  id: string; user_id?: string; school_year: string; subject: string; title: string; kind: GradeKind;
  date: string | null; points: number | null; max_points: number | null; grade_text: string | null; created_at?: string;
}
export interface ReportGrade { id: string; school_year: string; subject: string; grade: number | null; note: string | null }
export interface SubjectRow {
  id: string; user_id?: string; school_year: string; key: string; name: string; hours: number; written: number;
  area: "ueber" | "bezogen"; merge_into: string | null; sort: number;
}
export interface Settings { google_ical_url: string | null; google_enabled: boolean; remind_defaults?: Record<string, number>; timezone?: string }

export interface Goal { id: string; user_id?: string; title: string; date: string | null; created_at?: string }

/** Ein Plan-Eintrag an einem bestimmten Tag (auch wiederholte Einträge). */
export interface Occurrence { block: Block; date: string; done: boolean }

export const KIND_LABEL: Record<Kind, string> = {
  lernen: "Lernen", wiederholung: "Wiederholung", essen: "Essen", freizeit: "Freizeit",
  schlafen: "Schlafen", arbeit: "Arbeit", unterwegs: "Unterwegs", termin: "Termin",
  gespraech: "Gespräch", nachhilfe: "Nachhilfe", sonstiges: "Sonstiges",
};

export const KIND_COLOR: Record<Kind, string> = {
  lernen: "var(--blue)", wiederholung: "var(--yellow)", essen: "var(--green)", freizeit: "var(--orange)",
  schlafen: "#6B7686", arbeit: "#B69CFF", unterwegs: "#5CC8C8", termin: "#FF9ED2",
  gespraech: "#FF9ED2", nachhilfe: "var(--blue)", sonstiges: "var(--muted)",
};

export const KINDS: Kind[] = ["lernen", "wiederholung", "arbeit", "unterwegs", "termin", "gespraech", "nachhilfe", "essen", "freizeit", "schlafen", "sonstiges"];

export const isStudy = (k: Kind) => k === "lernen" || k === "wiederholung";
