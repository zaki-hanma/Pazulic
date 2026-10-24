import { memo } from "react";
import type { Occurrence } from "../lib/types";
import { useStore } from "../lib/store";
import { kindInfo } from "../lib/labels";
import { isRepeating } from "../lib/plan";
import { hhmm } from "../lib/dates";

function OccRow({ occ, now, onOpen, onToggle, sub }: { occ: Occurrence; now?: boolean; onOpen: () => void; onToggle: () => void; sub?: string }) {
  const b = occ.block;
  const { customKinds } = useStore();
  const k = kindInfo(b.kind, b.custom_kind_id, customKinds);
  return (
    <li className={"occ" + (occ.done ? " done" : "") + (now ? " now" : "")} style={{ ["--c" as string]: k.color }}>
      <button className="check" onClick={onToggle} aria-label={occ.done ? "Nicht erledigt" : "Abhaken"}>{occ.done ? "✓" : ""}</button>
      <button className="occ-main" onClick={onOpen}>
        <span className="occ-time mono">{hhmm(b.start_time)}<small>{hhmm(b.end_time)}</small></span>
        <span className="occ-text">
          <b>{b.title}</b>
          <small className="muted">{k.label}{sub ? ` · ${sub}` : ""}{isRepeating(b) ? " · ↻" : ""}</small>
        </span>
        {now && <span className="pill" style={{ ["--c" as string]: "var(--yellow)" }}>JETZT</span>}
      </button>
    </li>
  );
}
export default memo(OccRow);
