import { useState } from "react";
import { useStore } from "../lib/store";
import type { Block, Kind } from "../lib/types";
import { KINDS, KIND_COLOR, KIND_LABEL, isStudy } from "../lib/types";
import { hhmm, minutesBetween, fmtMin } from "../lib/dates";
import { learnMinutes } from "../lib/plan";

const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

interface Props { block?: Block; date: string; onDone: () => void }

export default function BlockForm({ block, date, onDone }: Props) {
  const { exams, saveBlock, deleteBlock } = useStore();
  const [kind, setKind] = useState<Kind>(block?.kind ?? "lernen");
  const [title, setTitle] = useState(block?.title ?? "");
  const [examId, setExamId] = useState<string>(block?.exam_id ?? exams.find((e) => e.date >= date)?.id ?? "");
  const [topics, setTopics] = useState<string[]>(block?.topic_ids ?? []);
  const [d, setD] = useState(block?.date ?? date);
  const [start, setStart] = useState(hhmm(block?.start_time ?? "17:00"));
  const [end, setEnd] = useState(hhmm(block?.end_time ?? "17:30"));
  const [repeat, setRepeat] = useState<number[]>(block?.repeat_weekdays ?? []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const study = isStudy(kind);
  const exam = exams.find((e) => e.id === examId);
  const dur = minutesBetween(start, end);
  const planned = study ? learnMinutes(start, end) : 0;

  const toggleTopic = (id: string) => setTopics((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const toggleWd = (n: number) => setRepeat((r) => (r.includes(n) ? r.filter((x) => x !== n) : [...r, n].sort()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (dur <= 0) { setMsg("Die End-Zeit muss nach der Start-Zeit sein."); return; }
    let t = title.trim();
    if (!t && study && exam) t = topics.map((id) => exam.topics.find((x) => x.id === id)?.short || exam.topics.find((x) => x.id === id)?.name).filter(Boolean).join(" + ");
    if (!t) t = KIND_LABEL[kind];
    setBusy(true);
    const ok = await saveBlock({
      id: block?.id, kind, title: t, date: d, start_time: start, end_time: end,
      exam_id: study ? examId || null : null, topic_ids: study ? topics : [], planned_minutes: planned, repeat_weekdays: repeat,
    });
    setBusy(false);
    if (ok) onDone();
  }

  async function remove() {
    if (!block) return;
    if (!window.confirm(block.repeat_weekdays?.length ? "Diesen Eintrag an ALLEN Wochentagen löschen?" : "Diesen Eintrag löschen?")) return;
    if (await deleteBlock(block.id)) onDone();
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="lbl">Art</label>
      <div className="chips">
        {KINDS.map((k) => (
          <button type="button" key={k} className={"chip" + (kind === k ? " on" : "")} style={{ ["--c" as string]: KIND_COLOR[k] }} onClick={() => setKind(k)}>
            <i className="dot" />{KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {study && (
        <>
          <label className="lbl" htmlFor="f-exam">Klausur</label>
          <select id="f-exam" value={examId} onChange={(e) => { setExamId(e.target.value); setTopics([]); }}>
            <option value="">– keine Klausur –</option>
            {exams.map((x) => <option key={x.id} value={x.id}>{x.short_name || x.subject} ({x.date.split("-").reverse().join(".")})</option>)}
          </select>
          {exam && exam.topics.length > 0 && (
            <>
              <label className="lbl">Themen</label>
              <div className="chips">
                {exam.topics.map((t) => (
                  <button type="button" key={t.id} className={"chip" + (topics.includes(t.id) ? " on" : "")} style={{ ["--c" as string]: "var(--blue)" }} onClick={() => toggleTopic(t.id)}>
                    {t.short || t.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <label className="lbl" htmlFor="f-title">Titel {study ? "(leer = Themen-Namen)" : "(optional)"}</label>
      <input id="f-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={study ? "z. B. Karteikarten" : KIND_LABEL[kind]} maxLength={80} />

      <div className="row3">
        <div><label className="lbl" htmlFor="f-date">{repeat.length ? "Ab Datum" : "Datum"}</label><input id="f-date" type="date" value={d} onChange={(e) => setD(e.target.value)} required /></div>
        <div><label className="lbl" htmlFor="f-start">Von</label><input id="f-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
        <div><label className="lbl" htmlFor="f-end">Bis</label><input id="f-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
      </div>
      <p className="muted small">
        Dauer: {dur > 0 ? fmtMin(dur) : "–"}
        {study && dur > 0 && <> · Ziel-Lernzeit: <b className="mono">{fmtMin(planned)}</b> (Pomodoro 25 + 5)</>}
      </p>

      <label className="lbl">Jede Woche wiederholen (optional)</label>
      <div className="chips">
        {WD.map((w, i) => (
          <button type="button" key={w} className={"chip sq" + (repeat.includes(i + 1) ? " on" : "")} style={{ ["--c" as string]: "var(--yellow)" }} onClick={() => toggleWd(i + 1)}>{w}</button>
        ))}
      </div>

      {msg && <p className="err">{msg}</p>}
      <div className="form-actions">
        {block && <button type="button" className="btn danger" onClick={remove}>Löschen</button>}
        <button className="btn primary" disabled={busy}>{busy ? "Speichert …" : "Speichern"}</button>
      </div>
    </form>
  );
}
