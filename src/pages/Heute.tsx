import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { useNow } from "../lib/useNow";
import { at, countdown, ferienName, holidayName, longDate, today, ymd } from "../lib/dates";
import { isNow, isPast, occurrencesOn, examProgress, runningFromYesterday } from "../lib/plan";
import { examName, topicNames } from "../lib/labels";
import type { Occurrence } from "../lib/types";
import TimerCard from "../components/TimerCard";
import OccRow from "../components/OccRow";
import GRow from "../components/GRow";
import { useGoogle } from "../lib/google";
import Sheet from "../components/Sheet";
import BlockDetail from "../components/BlockDetail";
import BlockForm from "../components/BlockForm";
import Logo from "../components/Logo";
import VacationPrompt from "../components/VacationPrompt";

export default function Heute() {
  const { exams, blocks, sessions, timer, toggleDone, auth } = useStore();
  const name = (auth?.user.user_metadata?.name as string | undefined)?.trim();
  const now = useNow(30000);
  const d = ymd(now);
  const [open, setOpen] = useState<Occurrence | null>(null);
  const [add, setAdd] = useState(false);

  const occs = useMemo(() => occurrencesOn(blocks, d), [blocks, d]);
  const gev = useGoogle().byDate.get(d) ?? [];
  const current = occs.find((o) => isNow(o, now)) ?? runningFromYesterday(blocks, d, now)[0];
  const next = occs.find((o) => !isPast(o, now) && o !== current && at(o.date, o.block.start_time) > now);
  const upcoming = exams.filter((e) => at(e.date, e.time) > now);
  const nextExam = upcoming[0];
  const special = holidayName(d) || ferienName(d);
  const hour = now.getHours();
  const hello = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";

  return (
    <div className="page">
      <header className="page-head">
        <div className="mobile-logo"><Logo size={34} /></div>
        <div>
          <h1>{hello}{name ? `, ${name}` : ""}</h1>
          <p className="muted">{longDate(d)}{special && <> · <span className={"tag" + (holidayName(d) ? " red" : "")}>{special}</span></>}</p>
        </div>
      </header>

      {nextExam && (() => {
        const p = examProgress(nextExam, blocks, sessions);
        return (
          <section className="card exam-hero">
            <div>
              <span className="muted small">Nächste Klausur</span>
              <h2>{examName(nextExam)}</h2>
              <p className="muted small">{longDate(nextExam.date)}</p>
            </div>
            <div className="countdown mono">{countdown(at(nextExam.date, nextExam.time), now)}</div>
            <div className="bar"><i style={{ width: `${Math.min(100, p.pct)}%`, background: p.pct > 110 ? "var(--orange)" : "var(--blue)" }} /></div>
            <p className="muted small">{p.pct} % der geplanten Lernzeit geschafft</p>
          </section>
        );
      })()}

      {timer && <TimerCard />}
      <VacationPrompt />

      <div className="grid2">
        <section className="card now-card">
          <span className="muted small">Jetzt</span>
          {current ? (
            <button className="now-btn" onClick={() => setOpen(current)}>
              <b>{current.block.title}</b>
              <small className="muted">{current.block.start_time.slice(0, 5)}–{current.block.end_time.slice(0, 5)}{topicNames(current.block, exams) ? " · " + topicNames(current.block, exams) : ""}</small>
            </button>
          ) : <p className="muted">Gerade nichts geplant.</p>}
        </section>
        <section className="card now-card">
          <span className="muted small">Als Nächstes</span>
          {next ? (
            <button className="now-btn" onClick={() => setOpen(next)}>
              <b>{next.block.title}</b>
              <small className="muted">um {next.block.start_time.slice(0, 5)} Uhr</small>
            </button>
          ) : <p className="muted">Heute nichts mehr. Genieß den Abend! 🌙</p>}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Heute</h2>
          <button className="btn primary small" onClick={() => setAdd(true)}>+ Eintrag</button>
        </div>
        {occs.length + gev.length === 0 ? <p className="muted">Für heute ist nichts geplant.</p> : (
          <ul className="occ-list">
            {[...occs.map((o) => ({ t: o.block.start_time.slice(0, 5), o })), ...gev.map((g) => ({ t: g.allDay ? "00:00" : g.start, g }))]
              .sort((a, b) => a.t.localeCompare(b.t))
              .map((x) => "g" in x ? <GRow key={"g" + x.g.uid + x.g.start} ev={x.g} /> : (
                <OccRow key={x.o.block.id} occ={x.o} now={x.o === current} sub={topicNames(x.o.block, exams)} onOpen={() => setOpen(x.o)} onToggle={() => toggleDone(x.o.block, x.o.date)} />
              ))}
          </ul>
        )}
      </section>

      {open && <Sheet title="Eintrag" onClose={() => setOpen(null)}><BlockDetail occ={occurrencesOn(blocks, open.date).find((o) => o.block.id === open.block.id) ?? open} onClose={() => setOpen(null)} /></Sheet>}
      {add && <Sheet title="Neuer Eintrag" onClose={() => setAdd(false)}><BlockForm date={today()} onDone={() => setAdd(false)} /></Sheet>}
    </div>
  );
}
