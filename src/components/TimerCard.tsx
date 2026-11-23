import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { elapsedMs, fmtClock, POMO_MS } from "../lib/timer";
import { today, ymd } from "../lib/dates";

/** Großer Start/Stopp-Timer. Läuft auf allen Geräten gleich (Zustand in der Datenbank). */
export default function TimerCard() {
  const { timer, setTimer, addSession, addLearnBlock, addActivityLog, googleMarks, saveGoogleMark, blocks, toggleDone } = useStore();
  const [now, setNow] = useState(Date.now());
  const running = !!timer?.running;
  const ms = elapsedMs(timer, now);
  const meta = (timer?.meta ?? {}) as { title?: string; subject?: string; topic?: string; lernfeld?: string; exam_id?: string | null; date?: string; mode?: "study" | "activity" | "google"; uid?: string; kindLabel?: string; first_start?: string };
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
    let min = Math.round(ms / 60000);
    if (min > 180) {
      // Timer lief sehr lange – vielleicht vergessen? Echte Zeit nachfragen.
      const a = window.prompt(`Der Timer lief ${fmtClock(ms)} Stunden. Hast du ihn vielleicht vergessen?\n\nWie viele MINUTEN hast du wirklich gemacht?`, String(min));
      if (a === null) return;
      const n = parseInt(a, 10);
      if (!Number.isFinite(n) || n < 0) return;
      min = Math.min(n, 1440);
    }
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
      // Lernen ohne Plan-Eintrag (z. B. Langfristig): automatisch als erledigten Eintrag in den Plan schreiben
      let blockId = timer.block_id;
      if (!blockId) {
        const startD = meta.first_start ? new Date(meta.first_start) : new Date(Date.now() - ms);
        const endD = new Date(startD.getTime() + min * 60000);
        const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        const title = [...new Set([meta.subject, meta.lernfeld, meta.topic].filter(Boolean))].join(" – ") || meta.title || "Lernen";
        blockId = await addLearnBlock({ date: ymd(startD), start: hm(startD), end: hm(endD) === hm(startD) ? hm(new Date(endD.getTime() + 60000)) : hm(endD), title, minutes: min });
      }
      const ok = await addSession({
        block_id: blockId, goal_id: timer.goal_id, exam_id: meta.exam_id ?? null,
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
      {ms > 3 * 3600_000 && <p className="err small center">⏱️ Läuft der Timer noch? Beim Speichern kannst du die echte Zeit eintragen.</p>}
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
