import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { useGoogle } from "../lib/google";
import type { Exam } from "../lib/types";
import { learnFactor, makePlan } from "../lib/autoplan";
import type { Proposal } from "../lib/autoplan";
import { fmtMin, shortDate, today } from "../lib/dates";
import { isStudy } from "../lib/types";
import Sheet from "./Sheet";

const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const LS = "pazulic-autoplan";

export default function AutoPlanSheet({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const { exams, blocks, sessions, addBlocks } = useStore();
  const google = useGoogle().byDate;
  const lf = useMemo(() => learnFactor(exam, exams, blocks, sessions), [exam, exams, blocks, sessions]);
  const futurePlanned = blocks.filter((b) => b.exam_id === exam.id && isStudy(b.kind) && b.date >= today()).reduce((a, b) => a + b.planned_minutes, 0);
  const base = Math.max(1, exam.topics.length) * 120;
  const suggested = Math.max(0, Math.round((base * lf.factor - futurePlanned) / 30) * 30);

  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } })();
  const [hours, setHours] = useState(String(suggested / 60).replace(".", ","));
  const [perDay, setPerDay] = useState<string>(saved.perDay ?? "2");
  const [sWd, setSWd] = useState<string>(saved.sWd ?? "17:00");
  const [sWe, setSWe] = useState<string>(saved.sWe ?? "10:00");
  const [end, setEnd] = useState<string>(saved.end ?? "21:30");
  const [free, setFree] = useState<number[]>(saved.free ?? [2]);
  const [items, setItems] = useState<Proposal[] | null>(null);
  const [missing, setMissing] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const num = (s: string) => Number(s.replace(",", "."));

  function calc() {
    try { localStorage.setItem(LS, JSON.stringify({ perDay, sWd, sWe, end, free })); } catch { /* egal */ }
    const r = makePlan(exam, blocks, google, {
      targetMin: Math.round(num(hours) * 60), maxPerDayMin: Math.round(num(perDay) * 60), startWeekday: sWd, startWeekend: sWe,
      endTime: end, freeDays: free, blockMin: 60, gapMin: 30,
    });
    setItems(r.items); setMissing(r.missing);
  }

  async function apply() {
    if (!items?.length) return;
    setBusy(true);
    const ok = await addBlocks(items.map((p) => ({
      exam_id: exam.id, date: p.date, start_time: p.start, end_time: p.end, kind: p.kind, title: p.title,
      topic_ids: p.topic_ids, planned_minutes: p.planned, repeat_weekdays: null,
    })));
    setBusy(false);
    if (ok) setDone(true);
  }

  const byDay = useMemo(() => {
    const m = new Map<string, Proposal[]>();
    for (const p of items ?? []) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return [...m.entries()];
  }, [items]);
  const total = (items ?? []).reduce((a, p) => a + p.planned, 0);

  return (
    <Sheet title={`Auto-Plan · ${exam.short_name || exam.subject}`} onClose={onClose}>
      {done ? (
        <div className="detail">
          <p className="ok">✓ {items!.length} Lernblöcke sind jetzt in deinem Plan.</p>
          <p className="muted small">Du kannst jeden Block im Plan noch ändern oder löschen.</p>
          <button className="btn primary" onClick={onClose}>Fertig</button>
        </div>
      ) : (
        <div className="form">
          <p className="muted small">Der Auto-Plan sucht freie Zeiten zwischen heute und dem Klausurtag. Er plant um deine Einträge (Arbeit, Schule, Termine, Google) herum. An Tagen mit Nachhilfe plant er nichts.</p>
          <div className="hint">
            {lf.basis > 0 && lf.factor > 1.05
              ? <>📈 Lerneffekt: Du brauchst {lf.sameSubject ? "in diesem Fach" : "im Schnitt"} <b>{lf.factor.toFixed(1).replace(".", ",")} ×</b> so lange wie geplant.</>
              : <>Vorschlag: ca. 2 Std. pro Thema ({exam.topics.length || 1} {exam.topics.length === 1 ? "Thema" : "Themen"}).</>}
            {futurePlanned > 0 && <> Schon geplant: {fmtMin(futurePlanned)}.</>}
            <> → <b>{fmtMin(suggested)}</b> zusätzlich.</>
          </div>
          <div className="row3">
            <div><label className="lbl" htmlFor="ap-h">Ziel (Std.)</label><input id="ap-h" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="ap-d">max. pro Tag (Std.)</label><input id="ap-d" inputMode="decimal" value={perDay} onChange={(e) => setPerDay(e.target.value)} /></div>
          </div>
          <div className="row3">
            <div><label className="lbl" htmlFor="ap-s1">Start Mo–Fr</label><input id="ap-s1" type="time" value={sWd} onChange={(e) => setSWd(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="ap-s2">Start Sa/So</label><input id="ap-s2" type="time" value={sWe} onChange={(e) => setSWe(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="ap-e">Spätestens bis</label><input id="ap-e" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <label className="lbl">Tage ohne Lernen</label>
          <div className="chips">
            {WD.map((w, i) => (
              <button type="button" key={w} className={"chip sq" + (free.includes(i + 1) ? " on" : "")} style={{ ["--c" as string]: "var(--red)" }} onClick={() => setFree((f) => (f.includes(i + 1) ? f.filter((x) => x !== i + 1) : [...f, i + 1]))}>{w}</button>
            ))}
          </div>
          <p className="muted small">Lernblöcke: 1 Std. (2 × 25 Min. + Pausen), danach 30 Min. frei für Alltag. Die letzten Blöcke sind Wiederholung.</p>
          <div className="form-actions"><button className="btn primary" onClick={calc}>Vorschlag berechnen</button></div>

          {items && (
            <>
              <h3>Vorschlag: {items.length} Blöcke · {fmtMin(total)} Lernzeit</h3>
              {missing > 0 && <p className="err">Es fehlen {fmtMin(missing)}: nicht genug freie Zeit bis zur Klausur. Erhöhe „max. pro Tag“ oder gib mehr Tage frei.</p>}
              {items.length === 0 ? <p className="muted">Keine freie Zeit gefunden.</p> : (
                <div className="ap-list">
                  {byDay.map(([d, list]) => (
                    <div key={d}>
                      <b className="small">{shortDate(d)}</b>
                      {list.map((p) => (
                        <div key={p.start} className="ap-row" style={{ ["--c" as string]: p.kind === "lernen" ? "var(--blue)" : "var(--yellow)" }}>
                          <span className="mono small">{p.start}–{p.end}</span><span>{p.title}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {items.length > 0 && <div className="form-actions"><button className="btn primary" onClick={apply} disabled={busy}>{busy ? "Speichert …" : "In den Plan übernehmen"}</button></div>}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
