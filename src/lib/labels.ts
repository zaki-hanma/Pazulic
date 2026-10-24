import type { Block, Exam } from "./types";
import type { CustomKind, Kind } from "./types";
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
