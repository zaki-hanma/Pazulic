import type { Block, Exam } from "./types";
import type { CustomKind, GoogleMark, GoogleRule, Kind } from "./types";
import { KIND_COLOR, KIND_LABEL } from "./types";

export function examName(e?: Exam | null) { return e ? e.short_name || e.subject : ""; }

export function topicNames(b: Block, exams: Exam[]): string {
  const e = exams.find((x) => x.id === b.exam_id);
  if (!e) return "";
  return b.topic_ids.map((id) => { const t = e.topics.find((x) => x.id === id); return t ? t.short || t.name : ""; }).filter(Boolean).join(" + ");
}


/** Name und Farbe der Art – eigene Art (falls gewählt) oder Standard-Art. */
export function kindInfo(kind: Kind, customId: string | null | undefined, custom: CustomKind[]): { label: string; color: string } {
  const c = customId ? custom.find((x) => x.id === customId) : undefined;
  return c ? { label: c.name, color: c.color } : { label: KIND_LABEL[kind], color: KIND_COLOR[kind] };
}

/** Art eines Google-Termins: eigene Auswahl für diesen Tag > Regel nach Name > „Termin“. */
export function googleKind(title: string, mark: GoogleMark | undefined, rules: GoogleRule[]): { kind: Kind; custom: string | null; rule: GoogleRule | null } {
  if (mark && (mark.kind || mark.custom_kind_id)) return { kind: mark.kind ?? "sonstiges", custom: mark.custom_kind_id, rule: null };
  const t = title.toLowerCase();
  const r = [...rules].sort((a, b) => b.match.length - a.match.length).find((x) => t.includes(x.match));
  if (r) return { kind: r.kind ?? "sonstiges", custom: r.custom_kind_id, rule: r };
  return { kind: "termin", custom: null, rule: null };
}
