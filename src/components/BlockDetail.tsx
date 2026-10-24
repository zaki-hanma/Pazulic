import { useState } from "react";
import { useStore } from "../lib/store";
import type { Occurrence } from "../lib/types";
import { KIND_COLOR, KIND_LABEL, isStudy } from "../lib/types";
import { fmtMin, hhmm, longDate } from "../lib/dates";
import { learnedForBlock } from "../lib/plan";
import { examName, topicNames } from "../lib/labels";
import BlockForm from "./BlockForm";

export default function BlockDetail({ occ, onClose }: { occ: Occurrence; onClose: () => void }) {
  const { exams, sessions, timer, setTimer, addSession, deleteSession, toggleDone } = useStore();
  const [edit, setEdit] = useState(false);
  const [manual, setManual] = useState("");
  const b = occ.block;
  const exam = exams.find((e) => e.id === b.exam_id);
  const topics = topicNames(b, exams);
  const study = isStudy(b.kind);
  const learned = learnedForBlock(b.id, occ.date, sessions);
  const mySessions = sessions.filter((s) => s.block_id === b.id && s.date === occ.date);

  if (edit) return <BlockForm block={b} date={occ.date} onDone={onClose} />;

  const start = () => {
    if (timer && !window.confirm("Es läuft schon ein Timer. Den alten verwerfen und neu starten?")) return;
    setTimer({
      block_id: b.id, goal_id: null, running: true, started_at: new Date().toISOString(), acc_ms: 0,
      meta: { title: b.title, subject: examName(exam), topic: topics || b.title, exam_id: b.exam_id, date: occ.date },
    });
    onClose();
  };

  const saveManual = async () => {
    const m = parseInt(manual, 10);
    if (!m || m <= 0) return;
    const ok = await addSession({ block_id: b.id, goal_id: null, exam_id: b.exam_id, subject: examName(exam), lernfeld: null, topic: topics || b.title, date: occ.date, minutes: m, source: "manuell" });
    if (ok) setManual("");
  };

  return (
    <div className="detail">
      <span className="pill" style={{ ["--c" as string]: KIND_COLOR[b.kind] }}>{KIND_LABEL[b.kind]}</span>
      <h3>{b.title}</h3>
      <p className="muted">{longDate(occ.date)} · {hhmm(b.start_time)}–{hhmm(b.end_time)}{b.repeat_weekdays?.length ? " · wöchentlich" : ""}</p>
      {exam && <p>Klausur: <b>{examName(exam)}</b>{topics && <> · {topics}</>}</p>}

      {study && (
        <div className="kpis">
          <div><span className="muted small">Ziel</span><b className="mono">{fmtMin(b.planned_minutes)}</b></div>
          <div><span className="muted small">Gelernt</span><b className="mono">{fmtMin(learned)}</b></div>
        </div>
      )}

      <div className="detail-actions">
        <button className={"btn" + (occ.done ? "" : " primary")} onClick={() => toggleDone(b, occ.date)}>{occ.done ? "✓ Erledigt (rückgängig)" : "✓ Abhaken"}</button>
        {study && <button className="btn primary" onClick={start}>▶ Timer starten</button>}
        <button className="btn ghost" onClick={() => setEdit(true)}>Bearbeiten</button>
      </div>

      {study && (
        <>
          <label className="lbl" htmlFor="man">Zeit manuell eintragen (Minuten)</label>
          <div className="inline">
            <input id="man" type="number" min={1} max={600} inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="z. B. 25" />
            <button className="btn" onClick={saveManual} disabled={!manual}>Eintragen</button>
          </div>
          {mySessions.length > 0 && (
            <ul className="sessions">
              {mySessions.map((s) => (
                <li key={s.id}>
                  <span className="mono">{fmtMin(s.minutes)}</span>
                  <span className="muted small">{s.source === "timer" ? "Timer" : "manuell"}</span>
                  <button className="icon-btn" aria-label="Lernzeit löschen" onClick={() => window.confirm("Diese Lernzeit löschen?") && deleteSession(s.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
