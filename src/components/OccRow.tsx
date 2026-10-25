import { memo } from "react";
import type { Occurrence } from "../lib/types";
import { useStore } from "../lib/store";
import { kindInfo } from "../lib/labels";
import { isRepeating } from "../lib/plan";
import { hhmm } from "../lib/dates";
import { timerForBlock } from "../lib/startTimer";

function OccRow({ occ, now, onOpen, onToggle, sub }: { occ: Occurrence; now?: boolean; onOpen: () => void; onToggle: () => void; sub?: string }) {
  const b = occ.block;
  const { customKinds, timer, setTimer, exams } = useStore();
  const mine = !!timer && timer.block_id === b.id && (timer.meta as { date?: string }).date === occ.date;
  const k = kindInfo(b.kind, b.custom_kind_id, customKinds);
  return (
    <li className={"occ" + (occ.done ? " done" : "") + (now ? " now" : "")} style={{ ["--c" as string]: k.color }}>
      <button className="check" onClick={onToggle} aria-label={occ.done ? "Nicht erledigt" : "Abhaken"}>{occ.done ? "✓" : ""}</button>
      <button className="occ-main" onClick={onOpen}>
        <span className="occ-time mono">{hhmm(b.start_time)}<small>{hhmm(b.end_time)}</small></span>
        <span className="occ-text">
          <b>{b.title}</b>
          <small className="muted">{k.label}{sub ? ` · ${sub}` : ""}{isRepeating(b) ? " · ↻" : ""}</small>
          {b.day_notes?.[occ.date] && <span className="occ-note">📝 {b.day_notes[occ.date]}</span>}
        </span>
        {now && <span className="pill" style={{ ["--c" as string]: "var(--yellow)" }}>JETZT</span>}
      </button>
      <button className={"play" + (mine ? " on" : "")} aria-label={mine ? "Timer läuft" : "Start"} title={mine ? "Timer läuft – oben stoppen" : "Start"}
        onClick={() => { if (mine) { window.scrollTo({ top: 0, behavior: "smooth" }); return; } if (timer && !window.confirm("Es läuft schon ein Timer. Den alten verwerfen und hier neu starten?")) return; setTimer(timerForBlock(b, occ.date, exams, customKinds)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
        {mine ? "●" : "▶"}
      </button>
    </li>
  );
}
export default memo(OccRow);
