import { useMemo } from "react";
import { useStore } from "../lib/store";
import { addDays, fmtMin, isoWeekday, today } from "../lib/dates";
import { examProgress } from "../lib/plan";

function status(planned: number, learned: number) {
  if (planned === 0) return { col: "var(--muted)", text: "kein Ziel" };
  const pct = Math.round((learned / planned) * 100);
  if (pct < 90) return { col: "var(--red)", text: `${fmtMin(planned - learned)} fehlen, ${pct} % geschafft` };
  if (pct > 110) return { col: "var(--orange)", text: `${fmtMin(learned - planned)} mehr gebraucht, ${pct} %` };
  return { col: "var(--green)", text: `im Plan, ${pct} %` };
}

export default function Analyse() {
  const { exams, blocks, sessions } = useStore();
  const t = today();
  const weekStart = addDays(t, 1 - isoWeekday(t));
  const sum = (f: (d: string) => boolean) => sessions.filter((s) => f(s.date)).reduce((a, s) => a + s.minutes, 0);
  const totals = [
    { label: "Diese Woche", m: sum((d) => d >= weekStart && d <= t) },
    { label: "Dieser Monat", m: sum((d) => d.startsWith(t.slice(0, 7))) },
    { label: `Jahr ${t.slice(0, 4)}`, m: sum((d) => d.startsWith(t.slice(0, 4))) },
  ];

  const weeks = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const s = addDays(weekStart, -7 * (7 - i)), e = addDays(s, 6);
    return { label: s.slice(8, 10) + "." + s.slice(5, 7) + ".", m: sessions.filter((x) => x.date >= s && x.date <= e).reduce((a, x) => a + x.minutes, 0) };
  }), [sessions, weekStart]);
  const maxW = Math.max(60, ...weeks.map((w) => w.m));

  const rows = exams.map((e) => ({ e, ...examProgress(e, blocks, sessions) })).filter((r) => r.planned > 0 || r.learned > 0);
  const maxE = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.learned)));

  return (
    <div className="page">
      <header className="page-head"><h1>Analyse</h1></header>
      <section className="kpi-row">
        {totals.map((x) => <div key={x.label} className="card kpi"><span className="muted small">{x.label}</span><b className="mono">{fmtMin(x.m)}</b></div>)}
      </section>

      <section className="card">
        <h2>Ziel vs. Ist pro Klausur</h2>
        <p className="muted small legend"><i className="lg" style={{ background: "rgba(255,255,255,.35)" }} /> Ziel <i className="lg" style={{ background: "var(--red)" }} /> zu wenig <i className="lg" style={{ background: "var(--green)" }} /> im Plan <i className="lg" style={{ background: "var(--orange)" }} /> mehr gebraucht</p>
        {rows.length === 0 ? <p className="muted">Noch keine Lernzeit. Starte den Timer bei einem Lernblock!</p> : rows.map((r) => {
          const s = status(r.planned, r.learned);
          return (
            <div key={r.e.id} className="cmp">
              <div className="row-between"><b>{r.e.short_name || r.e.subject}</b><span className="small" style={{ color: s.col }}>{s.text}</span></div>
              <div className="cmp-bar"><i className="goal" style={{ width: `${(r.planned / maxE) * 100}%` }} /></div>
              <div className="cmp-bar"><i style={{ width: `${(r.learned / maxE) * 100}%`, background: s.col }} /></div>
              <p className="muted small mono">Ziel {fmtMin(r.planned)} · Ist {fmtMin(r.learned)}</p>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2>Lernzeit pro Woche</h2>
        <div className="wchart">
          {weeks.map((w) => (
            <div key={w.label} className="wcol" title={fmtMin(w.m)}>
              <span className="mono small">{w.m ? Math.round(w.m / 6) / 10 : ""}</span>
              <i style={{ height: `${(w.m / maxW) * 100}%` }} />
              <small className="muted">{w.label}</small>
            </div>
          ))}
        </div>
        <p className="muted small">Zahlen = Stunden</p>
      </section>
      <p className="muted small center">Mehr Analyse (Themen, Alltag pro Monat, Lerneffekt) kommt im nächsten Schritt.</p>
    </div>
  );
}
