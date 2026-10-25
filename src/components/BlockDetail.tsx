import { useState } from "react";
import { useStore } from "../lib/store";
import type { Occurrence } from "../lib/types";
import { isStudy } from "../lib/types";
import { fmtMin, hhmm, longDate } from "../lib/dates";
import { isRepeating, learnedForBlock, ruleText } from "../lib/plan";
import { examName, kindInfo, topicNames } from "../lib/labels";
import BlockForm from "./BlockForm";
import NoteBox from "./NoteBox";
import { timerForBlock } from "../lib/startTimer";

export default function BlockDetail({ occ, onClose }: { occ: Occurrence; onClose: () => void }) {
  const { exams, sessions, timer, setTimer, addSession, deleteSession, toggleDone, customKinds, skipOccurrence, deleteBlock, activityLogs, addActivityLog, deleteActivityLog, saveDayNote } = useStore();
  const [edit, setEdit] = useState(false);
  const [manual, setManual] = useState("");
  const b = occ.block;
  const exam = exams.find((e) => e.id === b.exam_id);
  const topics = topicNames(b, exams);
  const study = isStudy(b.kind);
  const learned = learnedForBlock(b.id, occ.date, sessions);
  const mySessions = sessions.filter((s) => s.block_id === b.id && s.date === occ.date);
  const myLogs = activityLogs.filter((l) => l.block_id === b.id && l.date === occ.date);
  const k = kindInfo(b.kind, b.custom_kind_id, customKinds);

  if (edit) return <BlockForm block={b} date={occ.date} onDone={onClose} />;

  const start = () => {
    if (timer && !window.confirm("Es läuft schon ein Timer. Den alten verwerfen und neu starten?")) return;
    setTimer(timerForBlock(b, occ.date, exams, customKinds));
    onClose();
  };

  const saveManual = async () => {
    const m = parseInt(manual, 10);
    if (!m || m <= 0) return;
    if (!study) { if (await addActivityLog({ block_id: b.id, date: occ.date, minutes: Math.min(1440, m), source: "manuell" })) setManual(""); return; }
    const ok = await addSession({ block_id: b.id, goal_id: null, exam_id: b.exam_id, subject: examName(exam), lernfeld: null, topic: topics || b.title, date: occ.date, minutes: m, source: "manuell" });
    if (ok) setManual("");
  };

  return (
    <div className="detail">
      <span className="pill" style={{ ["--c" as string]: k.color }}>{k.label}</span>
      <h3>{b.title}</h3>
      <p className="muted">{longDate(occ.date)} · {hhmm(b.start_time)}–{hhmm(b.end_time)}</p>
      {isRepeating(b) && <p className="muted small">↻ {ruleText(b)}</p>}
      {exam && <p>Klausur: <b>{examName(exam)}</b>{topics && <> · {topics}</>}</p>}

      {!study && myLogs.length > 0 && <div className="kpis"><div><span className="muted small">Gebraucht</span><b className="mono">{fmtMin(myLogs.reduce((a, l) => a + l.minutes, 0))}</b></div><div><span className="muted small">Geplant</span><b className="mono">{fmtMin(Math.max(0, (Number(b.end_time.slice(0, 2)) * 60 + Number(b.end_time.slice(3, 5))) - (Number(b.start_time.slice(0, 2)) * 60 + Number(b.start_time.slice(3, 5)))))}</b></div></div>}
      {study && (
        <div className="kpis">
          <div><span className="muted small">Ziel</span><b className="mono">{fmtMin(b.planned_minutes)}</b></div>
          <div><span className="muted small">Gelernt</span><b className="mono">{fmtMin(learned)}</b></div>
        </div>
      )}

      <div className="detail-actions">
        <button className={"btn" + (occ.done ? "" : " primary")} onClick={() => toggleDone(b, occ.date)}>{occ.done ? "✓ Erledigt (rückgängig)" : "✓ Abhaken"}</button>
        <button className="btn primary" onClick={start}>▶ Start</button>
        <button className="btn ghost" onClick={() => setEdit(true)}>Bearbeiten</button>
        {isRepeating(b) ? (
          <button className="btn danger" onClick={async () => { if (window.confirm("Nur diesen einen Termin am " + longDate(occ.date) + " löschen? Die anderen Wiederholungen bleiben.") && (await skipOccurrence(b, occ.date))) onClose(); }}>Nur diesen Tag löschen</button>
        ) : (
          <button className="btn danger" onClick={async () => { if (window.confirm("Diesen Eintrag löschen?") && (await deleteBlock(b.id))) onClose(); }}>Löschen</button>
        )}
      </div>

      <NoteBox value={b.day_notes?.[occ.date] ?? ""} onSave={(t) => saveDayNote(b, occ.date, t)} />

      {(
        <>
          <label className="lbl" htmlFor="man">Zeit von Hand eintragen (Minuten)</label>
          <div className="inline">
            <input id="man" type="number" min={1} max={600} inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="z. B. 25" />
            <button className="btn" onClick={saveManual} disabled={!manual}>Eintragen</button>
          </div>
          {myLogs.length > 0 && (
            <ul className="sessions">
              {myLogs.map((l) => (
                <li key={l.id}>
                  <span className="mono">{fmtMin(l.minutes)}</span>
                  <span className="muted small">{l.source === "timer" ? "Timer" : "manuell"}</span>
                  <button className="icon-btn" aria-label="Zeit löschen" onClick={() => window.confirm("Diese Zeit löschen?") && deleteActivityLog(l.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
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
