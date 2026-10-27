import { useState } from "react";
import { useStore } from "../lib/store";
import { OFF_ICON, OFF_LABEL, useVacations } from "../lib/vacation";
import type { OffType } from "../lib/vacation";
import { shortDate, today } from "../lib/dates";

const span = (a: string, b: string) => shortDate(a) + (b !== a ? " – " + shortDate(b) : "");

/** Urlaub oder Frei (Überstunden) selbst eintragen – für alle, auch ohne Google Kalender. */
export default function VacationSheet() {
  const { settings, saveSettings } = useStore();
  const { periods } = useVacations();
  const [type, setType] = useState<OffType>("urlaub");
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const own = settings.vacations ?? [];
  const other = periods.filter((p) => p.end >= today() && !own.some((v) => v.start === p.start && v.end === p.end));

  const add = async () => {
    if (!start || !end || end < start) { setErr("Das Ende muss am oder nach dem Start sein."); return; }
    setErr("");
    const v = { id: crypto.randomUUID(), start, end, type, name: name.trim().slice(0, 40) || OFF_LABEL[type] };
    if (await saveSettings({ vacations: [...own, v].sort((a, b) => a.start.localeCompare(b.start)) })) setName("");
  };
  const del = (id: string) => window.confirm("Diesen Eintrag löschen?") && saveSettings({ vacations: own.filter((v) => v.id !== id) });

  return (
    <div className="detail">
      <p className="muted small">Trag hier Urlaub oder freie Tage (Überstunden abbauen) ein. Danach fragt Pazulic, ob Alltags-Termine (Arbeit, Schule …) an diesen Tagen wegfallen sollen.</p>
      <div className="seg">
        {(["urlaub", "frei"] as OffType[]).map((t) => <button key={t} type="button" className={type === t ? "on" : ""} onClick={() => setType(t)}>{OFF_ICON[t]} {OFF_LABEL[t]}</button>)}
      </div>
      <label className="lbl" htmlFor="vn">Name (optional)</label>
      <input id="vn" value={name} maxLength={40} placeholder={OFF_LABEL[type]} onChange={(e) => setName(e.target.value)} />
      <div className="inline">
        <div><label className="lbl" htmlFor="vs">Von</label><input id="vs" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} /></div>
        <div><label className="lbl" htmlFor="ve">Bis</label><input id="ve" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      {err && <p className="err">{err}</p>}
      <button className="btn primary" onClick={add}>+ {OFF_LABEL[type]} eintragen</button>

      {own.length > 0 && <>
        <h3>Selbst eingetragen</h3>
        <ul className="sessions">
          {own.map((v) => (
            <li key={v.id}>
              <span>{OFF_ICON[v.type ?? "urlaub"]} <b>{v.name}</b> · {span(v.start, v.end)}</span>
              <button className="icon-btn" aria-label="Löschen" onClick={() => del(v.id)}>✕</button>
            </li>
          ))}
        </ul>
      </>}
      {other.length > 0 && <>
        <h3>Aus Google und deinem Plan</h3>
        <ul className="sessions">
          {other.map((p) => <li key={p.key}><span>{OFF_ICON[p.type]} <b>{p.name}</b> · {span(p.start, p.end)}</span></li>)}
        </ul>
        <p className="muted small">Diese änderst du in Google bzw. im Plan-Eintrag.</p>
      </>}
      {Object.keys(settings.vacation_choices ?? {}).length > 0 && (
        <button className="btn ghost small" onClick={() => saveSettings({ vacation_choices: {} })}>Nochmal fragen, ob Alltags-Termine wegfallen sollen</button>
      )}
    </div>
  );
}
