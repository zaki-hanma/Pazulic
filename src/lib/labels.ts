import type { Block, Exam } from "./types";

export function examName(e?: Exam | null) { return e ? e.short_name || e.subject : ""; }

export function topicNames(b: Block, exams: Exam[]): string {
  const e = exams.find((x) => x.id === b.exam_id);
  if (!e) return "";
  return b.topic_ids.map((id) => { const t = e.topics.find((x) => x.id === id); return t ? t.short || t.name : ""; }).filter(Boolean).join(" + ");
}
