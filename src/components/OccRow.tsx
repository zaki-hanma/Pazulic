import { memo } from "react";
import type { Occurrence } from "../lib/types";
import { KIND_COLOR, KIND_LABEL } from "../lib/types";
import { hhmm } from "../lib/dates";

function OccRow({ occ, now, onOpen, onToggle, sub }: { occ: Occurrence; now?: boolean; onOpen: () => void; onToggle: () => void; sub?: string }) {
  const b = occ.block;
  return (
    <li className={"occ" + (occ.done ? " done" : "") + (now ? " now" : "")} style={{ ["--c" as string]: KIND_COLOR[b.kind] }}>
      <button className="check" onClick={onToggle} aria-label={occ.done ? "Nicht erledigt" : "Abhaken"}>{occ.done ? "✓" : ""}</button>
      <button className="occ-main" onClick={onOpen}>
        <span className="occ-time mono">{hhmm(b.start_time)}<small>{hhmm(b.end_time)}</small></span>
        <span className="occ-text">
          <b>{b.title}</b>
          <small className="muted">{KIND_LABEL[b.kind]}{sub ? ` · ${sub}` : ""}{b.repeat_weekdays?.length ? " · ↻" : ""}</small>
        </span>
        {now && <span className="pill" style={{ ["--c" as string]: "var(--yellow)" }}>JETZT</span>}
      </button>
    </li>
  );
}
export default memo(OccRow);
