import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { useNow } from "../lib/useNow";
import { at, countdown, fmtMin, longDate, shortDate, today } from "../lib/dates";
import type { Goal } from "../lib/types";
import Sheet from "../components/Sheet";
import KlausurTabs from "../components/KlausurTabs";
import TimerCard from "../components/TimerCard";

const LF = Array.from({ length: 13 }, (_, i) => `LF${i + 1}`);

function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const { saveGoal, deleteGoal } = useStore();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [date, setDate] = useState(goal?.date ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const ok = await saveGoal({ id: goal?.id, title: title.trim(), date: date || null });
    setBusy(false); if (ok) onDone();
  }
  return (
    <form className="form" onSubmit={submit}>
      <label className="lbl" htmlFor="g-t">Name</label>
      <input id="g-t" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="z. B. Zwischenprüfung" />
      <label className="lbl" htmlFor="g-d">Datum (optional)</label>
      <input id="g-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="form-actions">
        {goal && <button type="button" className="btn danger" onClick={async () => { if (window.confirm(`„${goal.title}“ löschen? Die Lernzeiten bleiben gespeichert.`) && (await deleteGoal(goal.id))) onDone(); }}>Löschen</button>}
        <button className="btn primary" disabled={busy}>{busy ? "Speichert …" : "Speichern"}</button>
      </div>
    </form>
  );
}

function LearnForm({ goal, mode, onDone }: { goal: Goal; mode: "timer" | "manuell"; onDone: () => void }) {
  const { sessions, timer, setTimer, addSession } = useStore();
  const mine = sessions.filter((s) => s.goal_id === goal.id);
  const last = [...mine].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];
  const [lf, setLf] = useState(last?.lernfeld ?? "");
  const [topic, setTopic] = useState("");
  const [min, setMin] = useState("");
  const [date, setDate] = useState(today());
  const lfs = useMemo(() => [...new Set([...LF, ...mine.map((s) => s.lernfeld).filter(Boolean) as string[]])], [mine]);
  const topics = useMemo(() => [...new Set(mine.filter((s) => !lf || s.lernfeld === lf).map((s) => s.topic).filter(Boolean))], [mine, lf]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "timer") {
      if (timer && !window.confirm("Es läuft schon ein Timer. Den alten verwerfen und neu starten?")) return;
      await setTimer({ block_id: null, goal_id: goal.id, running: true, started_at: new Date().toISOString(), acc_ms: 0,
        meta: { title: topic.trim(), subject: goal.title, topic: topic.trim(), lernfeld: lf.trim(), exam_id: null, date: today() } });
      onDone();
    } else {
      const m = parseInt(min, 10);
      if (!m || m <= 0) return;
      if (await addSession({ block_id: null, exam_id: null, goal_id: goal.id, subject: goal.title, lernfeld: lf.trim() || null, topic: topic.trim(), date, minutes: m, source: "manuell" })) onDone();
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="lbl" htmlFor="l-lf">Lernfeld</label>
      <input id="l-lf" list="lf-list" value={lf} onChange={(e) => setLf(e.target.value)} required placeholder="z. B. LF8" />
      <datalist id="lf-list">{lfs.map((x) => <option key={x} value={x} />)}</datalist>
      <label className="lbl" htmlFor="l-t">Thema</label>
      <input id="l-t" list="t-list" value={topic} onChange={(e) => setTopic(e.target.value)} required placeholder="z. B. Kaufvertrag" />
      <datalist id="t-list">{topics.map((x) => <option key={x} value={x} />)}</datalist>
      {mode === "manuell" && (
        <div className="row3">
          <div><label className="lbl" htmlFor="l-d">Datum</label><input id="l-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><label className="lbl" htmlFor="l-m">Minuten</label><input id="l-m" type="number" min={1} max={600} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} required /></div>
        </div>
      )}
      <div className="form-actions">
        <button className="btn primary">{mode === "timer" ? "▶ Timer starten" : "Eintragen"}</button>
      </div>
    </form>
  );
}

export default function Langfristig() {
  const { goals, sessions, timer, deleteSession } = useStore();
  const now = useNow(60000);
  const [edit, setEdit] = useState<Goal | "new" | null>(null);
  const [learn, setLearn] = useState<{ goal: Goal; mode: "timer" | "manuell" } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...goals].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  return (
    <div className="page">
      <header className="page-head row-between">
        <h1>Langfristig</h1>
        <button className="btn primary small" onClick={() => setEdit("new")}>+ Ziel</button>
      </header>
      <KlausurTabs />
      <p className="muted small">Für lange Ziele wie die Zwischenprüfung: nur Start/Stopp, Lernfeld und Thema.</p>
      {timer?.goal_id && <TimerCard />}
      {sorted.length === 0 && <section className="card"><p className="muted">Noch kein Ziel. Tippe auf „+ Ziel“.</p></section>}
      {sorted.map((g) => {
        const mine = sessions.filter((s) => s.goal_id === g.id);
        const total = mine.reduce((a, s) => a + s.minutes, 0);
        const byLf = new Map<string, { m: number; topics: Map<string, number> }>();
        for (const s of mine) {
          const k = s.lernfeld || "Ohne Lernfeld";
          const e = byLf.get(k) ?? { m: 0, topics: new Map() };
          e.m += s.minutes; e.topics.set(s.topic || "–", (e.topics.get(s.topic || "–") ?? 0) + s.minutes);
          byLf.set(k, e);
        }
        const lfs = [...byLf.entries()].sort((a, b) => b[1].m - a[1].m);
        const max = Math.max(1, ...lfs.map((x) => x[1].m));
        return (
          <section key={g.id} className="card">
            <div className="card-head">
              <div>
                <h2>{g.title}</h2>
                {g.date && <p className="muted small">{longDate(g.date)}</p>}
              </div>
              {g.date && <span className="countdown small mono">{countdown(at(g.date, "08:00"), now)}</span>}
            </div>
            <p>Gelernt insgesamt: <b className="mono">{fmtMin(total)}</b></p>
            <div className="detail-actions">
              <button className="btn primary" onClick={() => setLearn({ goal: g, mode: "timer" })}>▶ Lernen starten</button>
              <button className="btn" onClick={() => setLearn({ goal: g, mode: "manuell" })}>Zeit nachtragen</button>
              <button className="btn ghost small" onClick={() => setEdit(g)}>Bearbeiten</button>
            </div>
            {lfs.map(([lf, v]) => (
              <div key={lf} className="cmp">
                <button className="lf-row" onClick={() => setOpen(open === g.id + lf ? null : g.id + lf)}>
                  <b>{lf}</b><span className="mono small">{fmtMin(v.m)} {open === g.id + lf ? "▴" : "▾"}</span>
                </button>
                <div className="cmp-bar"><i style={{ width: `${(v.m / max) * 100}%`, background: "var(--pink)" }} /></div>
                {open === g.id + lf && (
                  <ul className="sessions">
                    {[...v.topics.entries()].sort((a, b) => b[1] - a[1]).map(([t, m]) => <li key={t}><span>{t}</span><span className="mono small">{fmtMin(m)}</span></li>)}
                    {mine.filter((s) => (s.lernfeld || "Ohne Lernfeld") === lf).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((s) => (
                      <li key={s.id} className="muted small">
                        <span>{shortDate(s.date)} · {s.topic}</span><span className="mono">{fmtMin(s.minutes)}</span>
                        <button className="icon-btn" aria-label="Lernzeit löschen" onClick={() => window.confirm("Diese Lernzeit löschen?") && deleteSession(s.id)}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        );
      })}
      {edit && <Sheet title={edit === "new" ? "Neues Ziel" : "Ziel bearbeiten"} onClose={() => setEdit(null)}><GoalForm goal={edit === "new" ? undefined : edit} onDone={() => setEdit(null)} /></Sheet>}
      {learn && <Sheet title={learn.mode === "timer" ? "Lernen starten" : "Zeit nachtragen"} onClose={() => setLearn(null)}><LearnForm goal={learn.goal} mode={learn.mode} onDone={() => setLearn(null)} /></Sheet>}
    </div>
  );
}
