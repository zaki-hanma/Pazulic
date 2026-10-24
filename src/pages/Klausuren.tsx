import { useState } from "react";
import { useStore } from "../lib/store";
import { useNow } from "../lib/useNow";
import { at, countdown, fmtMin, longDate } from "../lib/dates";
import { examProgress } from "../lib/plan";
import type { Exam, Topic } from "../lib/types";
import Sheet from "../components/Sheet";
import KlausurTabs from "../components/KlausurTabs";

const uid = () => Math.random().toString(36).slice(2, 10);

function ExamForm({ exam, onDone }: { exam?: Exam; onDone: () => void }) {
  const { saveExam, deleteExam } = useStore();
  const [subject, setSubject] = useState(exam?.subject ?? "");
  const [short, setShort] = useState(exam?.short_name ?? "");
  const [date, setDate] = useState(exam?.date ?? "");
  const [time, setTime] = useState((exam?.time ?? "08:00").slice(0, 5));
  const [topics, setTopics] = useState<Topic[]>(exam?.topics ?? []);
  const [busy, setBusy] = useState(false);

  const upd = (i: number, k: keyof Topic, v: string) => setTopics((t) => t.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await saveExam({ id: exam?.id, subject: subject.trim(), short_name: short.trim() || null, date, time, topics: topics.filter((t) => t.name.trim()) });
    setBusy(false);
    if (ok) onDone();
  }

  async function remove() {
    if (exam && window.confirm(`Klausur „${exam.subject}“ löschen? Die Lernzeiten bleiben gespeichert.`) && (await deleteExam(exam.id))) onDone();
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="lbl" htmlFor="x-s">Fach</label>
      <input id="x-s" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="z. B. Kosten- und Leistungsrechnung" />
      <div className="row3">
        <div><label className="lbl" htmlFor="x-k">Kurzname</label><input id="x-k" value={short} onChange={(e) => setShort(e.target.value)} placeholder="KLR" maxLength={12} /></div>
        <div><label className="lbl" htmlFor="x-d">Datum</label><input id="x-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
        <div><label className="lbl" htmlFor="x-t">Uhrzeit</label><input id="x-t" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      <label className="lbl">Themen</label>
      <ol className="topic-edit">
        {topics.map((t, i) => (
          <li key={t.id}>
            <input value={t.name} onChange={(e) => upd(i, "name", e.target.value)} placeholder="Thema" aria-label={`Thema ${i + 1}`} />
            <input value={t.short ?? ""} onChange={(e) => upd(i, "short", e.target.value)} placeholder="Kurz" aria-label={`Kurzname Thema ${i + 1}`} className="short" />
            <button type="button" className="icon-btn" onClick={() => setTopics((x) => x.filter((_, j) => j !== i))} aria-label="Thema entfernen">✕</button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn ghost small" onClick={() => setTopics((t) => [...t, { id: uid(), name: "", short: "" }])}>+ Thema</button>
      <div className="form-actions">
        {exam && <button type="button" className="btn danger" onClick={remove}>Löschen</button>}
        <button className="btn primary" disabled={busy}>{busy ? "Speichert …" : "Speichern"}</button>
      </div>
    </form>
  );
}

export default function Klausuren() {
  const { exams, blocks, sessions } = useStore();
  const now = useNow(60000);
  const [edit, setEdit] = useState<Exam | "new" | null>(null);
  const [showPast, setShowPast] = useState(false);
  const future = exams.filter((e) => at(e.date, e.time) > now);
  const past = exams.filter((e) => at(e.date, e.time) <= now).reverse();

  const card = (e: Exam, i: number) => {
    const p = examProgress(e, blocks, sessions);
    const col = p.planned === 0 ? "var(--muted)" : p.pct > 110 ? "var(--orange)" : p.pct >= 90 ? "var(--green)" : "var(--blue)";
    return (
      <section key={e.id} className={"card exam" + (i === 0 && future.includes(e) ? " first" : "")}>
        <div className="card-head">
          <div>
            <h2>{e.short_name || e.subject}</h2>
            <p className="muted small">{e.short_name ? e.subject + " · " : ""}{longDate(e.date)}, {e.time.slice(0, 5)} Uhr</p>
          </div>
          <span className="countdown small mono">{countdown(at(e.date, e.time), now)}</span>
        </div>
        <div className="bar"><i style={{ width: `${Math.min(100, p.pct)}%`, background: col }} /></div>
        <p className="muted small">Gelernt {fmtMin(p.learned)} von {fmtMin(p.planned)} geplant · <b style={{ color: col }}>{p.pct} %</b></p>
        {e.topics.length > 0 && <ol className="topics">{e.topics.map((t) => <li key={t.id}>{t.name}</li>)}</ol>}
        <button className="btn ghost small" onClick={() => setEdit(e)}>Bearbeiten</button>
      </section>
    );
  };

  return (
    <div className="page">
      <header className="page-head row-between">
        <h1>Klausuren</h1>
        <button className="btn primary small" onClick={() => setEdit("new")}>+ Klausur</button>
      </header>
      <KlausurTabs />
      {future.length === 0 && <section className="card"><p className="muted">Keine kommende Klausur. Tippe auf „+ Klausur“.</p></section>}
      {future.map(card)}
      {past.length > 0 && (
        <>
          <button className="btn ghost small" onClick={() => setShowPast((s) => !s)}>{showPast ? "Vergangene ausblenden" : `Vergangene Klausuren (${past.length})`}</button>
          {showPast && past.map(card)}
        </>
      )}
      {edit && <Sheet title={edit === "new" ? "Neue Klausur" : "Klausur bearbeiten"} onClose={() => setEdit(null)}><ExamForm exam={edit === "new" ? undefined : edit} onDone={() => setEdit(null)} /></Sheet>}
    </div>
  );
}
