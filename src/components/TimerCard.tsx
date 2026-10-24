import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { elapsedMs, fmtClock, POMO_MS, signal } from "../lib/timer";
import { today } from "../lib/dates";

/** Großer Start/Stopp-Timer. Läuft auf allen Geräten gleich (Zustand in der Datenbank). */
export default function TimerCard() {
  const { timer, setTimer, addSession } = useStore();
  const [now, setNow] = useState(Date.now());
  const lastPomo = useRef<number>(-1);
  const running = !!timer?.running;
  const ms = elapsedMs(timer, now);
  const meta = (timer?.meta ?? {}) as { title?: string; subject?: string; topic?: string; exam_id?: string | null; date?: string };

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  // Nach je 25 Min. Lernzeit: Ton + Vibration + automatisch Pause.
  useEffect(() => {
    if (!running) return;
    const n = Math.floor(ms / POMO_MS);
    if (lastPomo.current === -1) { lastPomo.current = n; return; }
    if (n > lastPomo.current) {
      lastPomo.current = n;
      signal();
      setTimer({ ...timer!, running: false, started_at: null, acc_ms: ms, meta: { ...meta, pause: true } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, running]);

  if (!timer) return null;

  const inPomo = ms % POMO_MS;
  const pct = (inPomo / POMO_MS) * 100;

  const toggle = () => {
    if (running) setTimer({ ...timer, running: false, started_at: null, acc_ms: ms });
    else { lastPomo.current = Math.floor(ms / POMO_MS); setTimer({ ...timer, running: true, started_at: new Date().toISOString(), acc_ms: ms, meta: { ...meta, pause: false } }); }
  };

  const stop = async () => {
    const min = Math.round(ms / 60000);
    if (min >= 1) {
      const ok = await addSession({
        block_id: timer.block_id, goal_id: timer.goal_id, exam_id: meta.exam_id ?? null,
        subject: meta.subject ?? "", lernfeld: null, topic: meta.topic ?? meta.title ?? "",
        date: meta.date ?? today(), minutes: min, source: "timer",
      });
      if (!ok) return;
    }
    setTimer(null);
  };

  const cancel = () => { if (window.confirm("Timer verwerfen? Die Zeit wird NICHT gespeichert.")) setTimer(null); };
  const isPause = !running && (meta as { pause?: boolean }).pause;

  return (
    <section className="card timer-card">
      <div className="timer-top">
        <span className="pill" style={{ ["--c" as string]: running ? "var(--green)" : "var(--yellow)" }}>{running ? "● Läuft" : isPause ? "Pause! 5 Min. Wasser trinken 💧" : "Pausiert"}</span>
        <span className="muted small">{meta.subject}</span>
      </div>
      <h3 className="timer-title">{meta.title || meta.topic || "Lernen"}</h3>
      <div className="timer-clock mono">{fmtClock(ms)}</div>
      <div className="bar"><i style={{ width: `${pct}%`, background: "var(--blue)" }} /></div>
      <p className="muted small">Pomodoro: {fmtClock(POMO_MS - inPomo)} bis zur Pause</p>
      <div className="timer-actions">
        <button className="btn primary big" onClick={toggle}>{running ? "Pause" : "Weiter"}</button>
        <button className="btn big" onClick={stop}>Stopp & speichern</button>
        <button className="btn ghost small" onClick={cancel}>Verwerfen</button>
      </div>
    </section>
  );
}
