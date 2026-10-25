import type { Block, CustomKind, Exam, TimerState } from "./types";
import { isStudy } from "./types";
import { examName, kindInfo, topicNames } from "./labels";

/** Timer-Daten für einen Plan-Eintrag (Lernen = Pomodoro, alles andere = normale Stoppuhr). */
export function timerForBlock(b: Block, date: string, exams: Exam[], kinds: CustomKind[]): TimerState {
  const exam = exams.find((e) => e.id === b.exam_id);
  const topics = topicNames(b, exams);
  return {
    block_id: b.id, goal_id: null, running: true, started_at: new Date().toISOString(), acc_ms: 0,
    meta: isStudy(b.kind)
      ? { mode: "study", title: b.title, subject: examName(exam), topic: topics || b.title, exam_id: b.exam_id, date }
      : { mode: "activity", title: b.title, kindLabel: kindInfo(b.kind, b.custom_kind_id, kinds).label, date },
  };
}
