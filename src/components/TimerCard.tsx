import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { elapsedMs, fmtClock, POMO_MS } from "../lib/timer";
import { today } from "../lib/dates";

/** Großer Start/Stopp-Timer. Läuft auf allen Geräten gleich (Zustand in der Datenbank). */
export default function TimerCard() {
  const { timer, setTimer, addSession, addActivityLog, googleMarks, saveGoogleMark, blocks, toggleDone } = useStore();
  const [now, setNow] = useState(Date.now());
  const running = !!timer?.running;
  const ms = elapsedMs(timer, now);
  const meta = (timer?.meta ?? {}) as { title?: string; subject?: string; topic?: string; lernfeld?: string; exam_id?: string | null; date?: string; mode?: "study" | "activity" | "google"; uid?: string; kindLabel?: string };
  const mode = meta.mode ?? "study";
  const pomo = mode === "study";

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  if (!timer) return null;

  const inPomo = ms % POMO_MS;
  const pct = (inPomo / POMO_MS) * 100;

  const toggle = () => {
    const t = Date.now();
    const cur = elapsedMs(timer, t);
    setNow(t); // Anzeige sofort aktualisieren – kein Springen
    if (running) setTimer({ ...timer, running: false, started_at: null, acc_ms: cur });
    else setTimer({ ...timer, running: true, started_at: new Date(t).toISOString(), acc_ms: cur, meta: { ...meta, pause: false } });
  };

  const stop = async () => {
    const min = Math.round(ms / 60000);
    const date = meta.date ?? today();
    if (min >= 1 && mode === "activity" && timer.block_id) {
      if (!(await addActivityLog({ block_id: timer.block_id, date, minutes: Math.min(1440, min), source: "timer" }))) return;
      const b = blocks.find((x) => x.id === timer.block_id);
      // automatisch abhaken
      if (b) { const done = b.repeat_rule || b.repeat_weekdays?.length ? b.completed_dates.includes(date) : b.done; if (!done) await toggleDone(b, date); }
    } else if (min >= 1 && mode === "google" && meta.uid) {
      const old = googleMarks.find((x) => x.uid === meta.uid && x.date === date);
      if (!(await saveGoogleMark({ uid: meta.uid, date, minutes: Math.min(1440, (old?.minutes ?? 0) + min), done: true }))) return;
    } else if (min >= 1) {
      const ok = await addSession({
        block_id: timer.block_id, goal_id: timer.goal_id, exam_id: meta.exam_id ?? null,
        subject: meta.subject ?? "", lernfeld: meta.lernfeld || null, topic: meta.topic ?? meta.title ?? "",
        date: meta.date ?? today(), minutes: min, source: "timer",
      });
      if (!ok) return;
    }
    setTimer(null);
  };

  const cancel = () => { if (window.confirm("Timer verwerfen? Die Zeit wird NICHT gespeichert.")) setTimer(null); };


  return (
    <section className="card timer-card">
      <div className="timer-top">
        <span className="pill" style={{ ["--c" as string]: running ? "var(--green)" : "var(--yellow)" }}>{running ? "● Läuft" : "Pausiert"}</span>
        <span className="muted small">{mode === "study" ? <>{meta.subject}{meta.lernfeld ? " · " + meta.lernfeld : ""}</> : <>{mode === "google" ? "Google · " : ""}{meta.kindLabel}</>}</span>
      </div>
      <h3 className="timer-title">{meta.title || meta.topic || (pomo ? "Lernen" : "Aufgabe")}</h3>
      <div className="timer-clock mono">{fmtClock(ms)}</div>
      {pomo ? <>
        <div className="bar"><i style={{ width: `${pct}%`, background: "var(--blue)" }} /></div>
        <p className="muted small">{Math.floor(ms / POMO_MS)} × 25 Min. geschafft · nächste 25 Min. in {fmtClock(POMO_MS - inPomo)}</p>
      </> : <p className="muted small center">Die Zeit wird gespeichert, wenn du auf „Stopp & speichern“ tippst.</p>}
      <div className="timer-actions">
        <button className="btn primary big" onClick={toggle}>{running ? "Pause" : "Weiter"}</button>
        <button className="btn big" onClick={stop}>Stopp & speichern</button>
        <button className="btn ghost small" onClick={cancel}>Verwerfen</button>
      </div>
    </section>
  );
}
