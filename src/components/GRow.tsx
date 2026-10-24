import { memo, useState } from "react";
import type { GEvent } from "../lib/google";
import { HIDE_ALL } from "../lib/google";
import { useStore } from "../lib/store";
import { KINDS, KIND_LABEL } from "../lib/types";
import type { GoogleMark, Kind } from "../lib/types";
import { googleKind, kindInfo } from "../lib/labels";
import NewKind from "./NewKind";
import { fmtMin, longDate, minutesBetween } from "../lib/dates";
import Sheet from "./Sheet";

export const gDuration = (ev: GEvent) => (ev.allDay ? 0 : Math.max(0, minutesBetween(ev.start, ev.end)));

function GDetail({ ev, onClose }: { ev: GEvent; onClose: () => void }) {
  const { googleMarks, saveGoogleMark, customKinds, googleRules, saveGoogleRule } = useStore();
  const m = googleMarks.find((x) => x.uid === ev.uid && x.date === ev.date);
  const [min, setMin] = useState(m?.minutes != null ? String(m.minutes) : "");
  const gk = googleKind(ev.title, m, googleRules);
  const sel = gk.custom ? "c:" + gk.custom : gk.kind;
  const [scope, setScope] = useState<"alle" | "einer">(m && (m.kind || m.custom_kind_id) ? "einer" : "alle");
  const [adding, setAdding] = useState(false);
  async function setArt(kind: Kind, custom: string | null) {
    if (scope === "alle") {
      await saveGoogleRule({ match: ev.title, kind, custom_kind_id: custom });
      if (m && (m.kind || m.custom_kind_id)) await save({ kind: null, custom_kind_id: null });
    } else await save({ kind, custom_kind_id: custom });
  }
  const save = (patch: Partial<GoogleMark>) => saveGoogleMark({ ...patch, uid: ev.uid, date: ev.date });

  return (
    <div className="detail">
      <span className="pill" style={{ ["--c" as string]: "#E8ECF3" }}>Google Kalender</span>
      <h3>{ev.title}</h3>
      <p className="muted">{longDate(ev.date)} · {ev.allDay ? "ganztägig" : `${ev.start}–${ev.end}`}</p>

      <label className="lbl" htmlFor="g-kind">Art (so wird der Termin angezeigt und analysiert)</label>
      <select id="g-kind" value={sel} onChange={(e) => {
        const v = e.target.value;
        if (v === "__new") { setAdding(true); return; }
        setArt(v.startsWith("c:") ? "sonstiges" : (v as Kind), v.startsWith("c:") ? v.slice(2) : null);
      }}>
        {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        {customKinds.map((c) => <option key={c.id} value={"c:" + c.id}>{c.name}</option>)}
        <option value="__new">+ Eigene Art …</option>
      </select>
      <div className="chips">
        <button type="button" className={"chip" + (scope === "alle" ? " on" : "")} style={{ ["--c" as string]: "var(--yellow)" }} onClick={() => setScope("alle")}>für alle Termine mit „{ev.title}“</button>
        <button type="button" className={"chip" + (scope === "einer" ? " on" : "")} style={{ ["--c" as string]: "var(--yellow)" }} onClick={() => setScope("einer")}>nur für diesen Termin</button>
      </div>
      {gk.rule && scope === "alle" && <p className="muted small">✓ Alle Google-Termine, die „{gk.rule.match}“ im Namen haben, sind „{kindInfo(gk.kind, gk.custom, customKinds).label}“.</p>}
      {adding && <NewKind start={ev.title} onSaved={(k) => { setAdding(false); setArt("sonstiges", k.id); }} onCancel={() => setAdding(false)} />}

      <div className="detail-actions">
        <button className={"btn" + (m?.done ? "" : " primary")} onClick={() => save({ done: !m?.done })}>{m?.done ? "✓ Erledigt (rückgängig)" : "✓ Abhaken"}</button>
      </div>

      <label className="lbl" htmlFor="g-min">Wirkliche Zeit (Minuten){!ev.allDay && <span className="muted"> · geplant {fmtMin(gDuration(ev))}</span>}</label>
      <div className="inline">
        <input id="g-min" type="number" min={0} max={1440} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder={ev.allDay ? "z. B. 120" : String(gDuration(ev))} />
        <button className="btn" onClick={() => save({ minutes: min === "" ? null : Math.min(1440, Math.max(0, parseInt(min, 10) || 0)), done: true })}>Speichern</button>
      </div>
      <p className="muted small">Die Zeit zählt in der Analyse (Alltag), sobald der Termin abgehakt ist. Ohne Eingabe zählt die geplante Dauer.</p>

      <label className="lbl">Aus Pazulic entfernen</label>
      <div className="detail-actions">
        <button className="btn danger" onClick={async () => { if (window.confirm("Diesen Termin in Pazulic ausblenden? In Google bleibt er.") && (await save({ hidden: true }))) onClose(); }}>Nur diesen Tag</button>
        <button className="btn danger" onClick={async () => { if (window.confirm("ALLE Termine mit diesem Namen/dieser Serie in Pazulic ausblenden? In Google bleiben sie.") && (await saveGoogleMark({ uid: ev.uid, date: HIDE_ALL, hidden: true }))) onClose(); }}>Alle aus dieser Serie</button>
      </div>
      <p className="muted small">Pazulic löscht nichts in deinem Google Kalender – der Termin wird nur in der App nicht mehr gezeigt.</p>
    </div>
  );
}

/** Termin aus Google Kalender – abhaken, Zeit eintragen, ausblenden. */
function GRow({ ev }: { ev: GEvent }) {
  const { googleMarks, saveGoogleMark, customKinds, googleRules } = useStore();
  const [open, setOpen] = useState(false);
  const m = googleMarks.find((x) => x.uid === ev.uid && x.date === ev.date);
  const done = !!m?.done;
  const gk = googleKind(ev.title, m, googleRules);
  const k = kindInfo(gk.kind, gk.custom, customKinds);
  return (
    <li className={"occ google" + (done ? " done" : "")} style={{ ["--c" as string]: k.color }}>
      <button className="check" onClick={() => saveGoogleMark({ uid: ev.uid, date: ev.date, done: !done })} aria-label={done ? "Nicht erledigt" : "Abhaken"}>{done ? "✓" : ""}</button>
      <button className="occ-main" onClick={() => setOpen(true)}>
        <span className="occ-time mono">{ev.allDay ? "ganzt." : ev.start}{!ev.allDay && <small>{ev.end}</small>}</span>
        <span className="occ-text"><b>{ev.title}</b><small className="muted"><span className="gtag">G</span> {k.label}{m?.minutes != null ? " · " + fmtMin(m.minutes) : ""}</small></span>
      </button>
      {open && <Sheet title="Google-Termin" onClose={() => setOpen(false)}><GDetail ev={ev} onClose={() => setOpen(false)} /></Sheet>}
    </li>
  );
}
export default memo(GRow);
