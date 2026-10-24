import { memo } from "react";
import type { GEvent } from "../lib/google";

/** Termin aus Google Kalender – nur lesen. */
function GRow({ ev }: { ev: GEvent }) {
  return (
    <li className="occ google">
      <span className="gbadge" title="Aus Google Kalender">G</span>
      <span className="occ-main static">
        <span className="occ-time mono">{ev.allDay ? "ganzt." : ev.start}{!ev.allDay && <small>{ev.end}</small>}</span>
        <span className="occ-text"><b>{ev.title}</b><small className="muted">Google Kalender</small></span>
      </span>
    </li>
  );
}
export default memo(GRow);
