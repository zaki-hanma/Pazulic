import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { addDays, ferienName, holidayName, isoWeekday, longDate, MONTHS, parseYmd, today, WD_SHORT, ymd } from "../lib/dates";
import { isNow, occurrencesOn } from "../lib/plan";
import { topicNames } from "../lib/labels";
import { KIND_COLOR } from "../lib/types";
import type { Occurrence } from "../lib/types";
import OccRow from "../components/OccRow";
import GRow from "../components/GRow";
import { useGoogle } from "../lib/google";
import Sheet from "../components/Sheet";
import BlockDetail from "../components/BlockDetail";
import BlockForm from "../components/BlockForm";

type View = "liste" | "kalender";

export default function Plan() {
  const { blocks, exams, toggleDone } = useStore();
  const [view, setView] = useState<View>(() => { try { return (localStorage.getItem("plan-view") as View) || "liste"; } catch { return "liste"; } });
  const [day, setDay] = useState(today());
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [open, setOpen] = useState<Occurrence | null>(null);
  const [add, setAdd] = useState(false);

  const setV = (v: View) => { setView(v); try { localStorage.setItem("plan-view", v); } catch { /* egal */ } };

  const weekStart = addDays(day, 1 - isoWeekday(day));
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const occs = useMemo(() => occurrencesOn(blocks, day), [blocks, day]);
  const google = useGoogle().byDate;
  const gev = google.get(day) ?? [];
  const examDates = useMemo(() => new Map(exams.map((e) => [e.date, e.short_name || e.subject])), [exams]);
  const t = today();
  const nowD = new Date();

  const cells = useMemo(() => {
    const first = parseYmd(month + "-01");
    const start = addDays(ymd(first), 1 - isoWeekday(ymd(first)));
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(start, i);
      return { d, inMonth: d.startsWith(month), occ: occurrencesOn(blocks, d) };
    });
  }, [month, blocks]);

  const shiftMonth = (n: number) => { const d = parseYmd(month + "-01"); d.setMonth(d.getMonth() + n); setMonth(ymd(d).slice(0, 7)); };
  const pick = (d: string) => { setDay(d); setMonth(d.slice(0, 7)); };
  const URL_RE = /urlaub|vacation|betriebsferien/i;
  const urlaubName = (d: string) => (google.get(d) ?? []).find((g) => g.allDay && URL_RE.test(g.title))?.title ?? null;
  const special = holidayName(day) || ferienName(day);
  const urlaubDay = urlaubName(day);
  const [my, mm] = month.split("-").map(Number);

  return (
    <div className="page">
      <header className="page-head row-between">
        <h1>Plan</h1>
        <div className="seg">
          <button className={view === "liste" ? "on" : ""} onClick={() => setV("liste")}>Liste</button>
          <button className={view === "kalender" ? "on" : ""} onClick={() => setV("kalender")}>Kalender</button>
        </div>
      </header>

      {view === "liste" ? (
        <section className="card week">
          <button className="icon-btn" onClick={() => setDay(addDays(day, -7))} aria-label="Woche zurück">‹</button>
          <div className="week-days">
            {week.map((d) => {
              const pd = parseYmd(d);
              const mark = [holidayName(d) ? "hol" : "", ferienName(d) ? "fer" : "", urlaubName(d) ? "url" : ""].join(" ").trim();
              return (
                <button key={d} className={"wd" + (d === day ? " on" : "") + (d === t ? " today" : "") + (mark ? " " + mark : "") + (examDates.has(d) ? " exam" : "")} onClick={() => setDay(d)}>
                  <small>{WD_SHORT[pd.getDay()]}</small><b>{pd.getDate()}</b>
                </button>
              );
            })}
          </div>
          <button className="icon-btn" onClick={() => setDay(addDays(day, 7))} aria-label="Woche vor">›</button>
        </section>
      ) : (
        <section className="card cal">
          <div className="card-head">
            <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Monat zurück">‹</button>
            <h2>{MONTHS[mm - 1]} {my}</h2>
            <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Monat vor">›</button>
          </div>
          <div className="cal-grid">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => <div key={w} className="cal-wd">{w}</div>)}
            {cells.map((c) => {
              const hol = holidayName(c.d), fer = ferienName(c.d), url = urlaubName(c.d), ex = examDates.get(c.d);
              return (
                <button key={c.d} className={"cal-cell" + (c.inMonth ? "" : " out") + (c.d === day ? " on" : "") + (c.d === t ? " today" : "") + (hol ? " hol" : "") + (fer ? " fer" : "") + (url ? " url" : "")} onClick={() => pick(c.d)} title={[hol, fer, url].filter(Boolean).join(" · ")}>
                  <span className="cal-n">{parseYmd(c.d).getDate()}</span>
                  {ex && <span className="cal-exam">{ex}</span>}
                  {hol && <span className="cal-hol">{hol}</span>}
                  <span className="cal-dots">{c.occ.slice(0, 6).map((o) => <i key={o.block.id} style={{ background: KIND_COLOR[o.block.kind] }} />)}{(google.get(c.d) ?? []).slice(0, 3).map((_, i) => <i key={"g" + i} className="g" />)}</span>
                </button>
              );
            })}
          </div>
          <p className="muted small legend"><i className="lg fer" /> Schulferien Niedersachsen <i className="lg url" /> Urlaub (Google) <i className="lg hol" /> Feiertag <i className="lg ex" /> Klausur <i className="lg" style={{ background: "#E8ECF3", borderRadius: "50%" }} /> Google</p>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2>{longDate(day)}</h2>
            {special && <span className={"tag" + (holidayName(day) ? " red" : "")}>{special}</span>}
            {urlaubDay && <span className="tag url">{urlaubDay}</span>}
            {examDates.has(day) && <span className="tag red">Klausur: {examDates.get(day)}</span>}
          </div>
          <button className="btn primary small" onClick={() => setAdd(true)}>+ Eintrag</button>
        </div>
        {day < t && <p className="muted small">Vergangener Tag – du kannst Einträge nachtragen oder ändern.</p>}
        {occs.length + gev.length === 0 ? <p className="muted">Nichts geplant.</p> : (
          <ul className="occ-list">
            {[...occs.map((o) => ({ t: o.block.start_time.slice(0, 5), o })), ...gev.map((g) => ({ t: g.allDay ? "00:00" : g.start, g }))]
              .sort((a, b) => a.t.localeCompare(b.t))
              .map((x) => "g" in x ? <GRow key={"g" + x.g.uid + x.g.start} ev={x.g} /> : (
                <OccRow key={x.o.block.id} occ={x.o} now={day === t && isNow(x.o, nowD)} sub={topicNames(x.o.block, exams)} onOpen={() => setOpen(x.o)} onToggle={() => toggleDone(x.o.block, x.o.date)} />
              ))}
          </ul>
        )}
      </section>

      {open && <Sheet title="Eintrag" onClose={() => setOpen(null)}><BlockDetail occ={occurrencesOn(blocks, open.date).find((o) => o.block.id === open.block.id) ?? open} onClose={() => setOpen(null)} /></Sheet>}
      {add && <Sheet title="Neuer Eintrag" onClose={() => setAdd(false)}><BlockForm date={day} onDone={() => setAdd(false)} /></Sheet>}
    </div>
  );
}
