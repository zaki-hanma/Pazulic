import { useMemo, useState } from "react";
import { MONTHS, minutesBetween, parseYmd, ymd } from "../lib/dates";
import { occurrencesOn } from "../lib/plan";
import { isStudy } from "../lib/types";
import { googleKind, kindInfo } from "../lib/labels";
import { useGoogle } from "../lib/google";
import { gDuration } from "../components/GRow";
import type { Block, Kind } from "../lib/types";
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

function Alltag({ blocks }: { blocks: Block[] }) {
  const t = today();
  const [month, setMonth] = useState(t.slice(0, 7));
  const shift = (n: number) => { const d = parseYmd(month + "-01"); d.setMonth(d.getMonth() + n); setMonth(ymd(d).slice(0, 7)); };
  const { customKinds, googleMarks, googleRules, activityLogs } = useStore();
  const google = useGoogle().byDate;
  const data = useMemo(() => {
    const per = new Map<string, { label: string; color: string; m: number; n: number }>();
    const add = (kind: Kind, cid: string | null, min: number) => {
      const info = kindInfo(kind, cid, customKinds);
      const key = cid ?? kind;
      const e = per.get(key) ?? { label: info.label, color: info.color, m: 0, n: 0 };
      e.m += min; e.n++; per.set(key, e);
    };
    let days = 0;
    for (let d = month + "-01"; d.startsWith(month) && d <= t; d = addDays(d, 1)) {
      days++;
      for (const o of occurrencesOn(blocks, d)) {
        if (isStudy(o.block.kind)) continue;
        // gemessene Zeit (Start/Stopp oder von Hand) zählt zuerst, sonst die geplante Dauer, wenn abgehakt
        const logged = activityLogs.filter((l) => l.block_id === o.block.id && l.date === d).reduce((a, l) => a + l.minutes, 0);
        if (logged > 0) add(o.block.kind, o.block.custom_kind_id, logged);
        else if (o.done) add(o.block.kind, o.block.custom_kind_id, Math.max(0, minutesBetween(o.block.start_time.slice(0, 5), o.block.end_time.slice(0, 5))));
      }
    }
    // Abgehakte Google-Termine
    for (const mk of googleMarks) {
      if (!mk.done || mk.hidden || !mk.date.startsWith(month) || mk.date > t) continue;
      const ev = (google.get(mk.date) ?? []).find((x) => x.uid === mk.uid);
      if (!ev) continue; // ausgeblendet/gelöscht oder nicht mehr in Google → nicht mitzählen
      const min = mk.minutes ?? gDuration(ev);
      const gk = googleKind(ev?.title ?? "", mk, googleRules);
      add(gk.kind, gk.custom, min);
    }
    return { rows: [...per.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.m - a.m), days };
  }, [blocks, month, t, customKinds, googleMarks, googleRules, google, activityLogs]);
  const max = Math.max(1, ...data.rows.map((r) => r.m));
  const total = data.rows.reduce((a, r) => a + r.m, 0);
  const [y, m] = month.split("-").map(Number);
  return (
    <>
      <section className="card">
        <div className="card-head">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Monat zurück">‹</button>
          <h2>{MONTHS[m - 1]} {y}</h2>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Monat vor" disabled={month >= t.slice(0, 7)}>›</button>
        </div>
        {data.days === 0 ? <p className="muted">Dieser Monat hat noch nicht angefangen.</p> : data.rows.length === 0 ? <p className="muted">In diesem Monat hast du noch keinen Alltag-Eintrag abgehakt.</p> : (
          <>
            <p className="muted small">Abgehakte Einträge ({data.days} {data.days === 1 ? "Tag" : "Tage"}) · zusammen {fmtMin(total)}</p>
            {data.rows.map((r) => (
              <div key={r.k} className="cmp">
                <div className="row-between"><b><i className="kdot" style={{ background: r.color }} />{r.label}</b><span className="mono small">{fmtMin(r.m)}</span></div>
                <div className="cmp-bar"><i style={{ width: `${(r.m / max) * 100}%`, background: r.color }} /></div>
                <p className="muted small">{r.n} {r.n === 1 ? "Eintrag" : "Einträge"} · Ø {fmtMin(r.m / data.days)} pro Tag</p>
              </div>
            ))}
          </>
        )}
      </section>
      <p className="muted small center">Gezählt wird die gemessene Zeit (▶ Start/Stopp oder von Hand). Ohne Messung zählt die geplante Dauer, wenn du den Eintrag mit ✓ abgehakt hast – Plan-Einträge und Google-Termine (Arbeit, Unterwegs, Termine, Schlafen, eigene Arten …). Lernen siehst du im Reiter „Lernen“.</p>
    </>
  );
}

export default function Analyse() {
  const [tab, setTab] = useState<"lernen" | "alltag">(() => { try { return (localStorage.getItem("analyse-tab") as "alltag") || "lernen"; } catch { return "lernen"; } });
  const pick = (v: "lernen" | "alltag") => { setTab(v); try { localStorage.setItem("analyse-tab", v); } catch { /* egal */ } };
  const { blocks } = useStore();
  return (
    <div className="page">
      <header className="page-head"><h1>Analyse</h1></header>
      <div className="seg wide">
        <button className={tab === "lernen" ? "on" : ""} onClick={() => pick("lernen")}>Lernen</button>
        <button className={tab === "alltag" ? "on" : ""} onClick={() => pick("alltag")}>Alltag</button>
      </div>
      {tab === "lernen" ? <Lernen /> : <Alltag blocks={blocks} />}
    </div>
  );
}

function Lernen() {
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

  const nowD = new Date();
  const pastBlocks = blocks.filter((b) => !b.repeat_weekdays?.length && !b.repeat_rule && new Date(b.date + "T" + b.end_time.slice(0, 5)) <= nowD);
  const rows = exams.map((e) => ({ e, ...examProgress(e, pastBlocks, sessions) })).filter((r) => r.learned > 0);
  const maxE = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.learned)));

  return (
    <>
      <section className="kpi-row">
        {totals.map((x) => <div key={x.label} className="card kpi"><span className="muted small">{x.label}</span><b className="mono">{fmtMin(x.m)}</b></div>)}
      </section>

      <section className="card">
        <h2>Ziel vs. Ist pro Klausur</h2>
        <p className="muted small">Ziel = Lernblöcke, die schon vorbei sind. Ist = deine gespeicherte Lernzeit.</p>
        <p className="muted small legend"><i className="lg" style={{ background: "rgba(255,255,255,.35)" }} /> Ziel <i className="lg" style={{ background: "var(--red)" }} /> zu wenig <i className="lg" style={{ background: "var(--green)" }} /> im Plan <i className="lg" style={{ background: "var(--orange)" }} /> mehr gebraucht</p>
        {rows.length === 0 ? <p className="muted">Noch keine Lernzeit gespeichert. Starte den Timer bei einem Lernblock oder trag die Zeit von Hand ein.</p> : rows.map((r) => {
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
    </>
  );
}
