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
