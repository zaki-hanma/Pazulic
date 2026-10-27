import { useState } from "react";
import { useStore } from "../lib/store";
import { useVacations } from "../lib/vacation";
import { shortDate, today } from "../lib/dates";

/** Urlaub selbst eintragen (für alle, auch ohne Google Kalender). */
export default function VacationSheet() {
  const { settings, saveSettings } = useStore();
  const { periods } = useVacations();
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [name, setName] = useState("Urlaub");
  const [err, setErr] = useState("");
  const own = settings.vacations ?? [];
  const google = periods.filter((p) => p.source === "google" && p.end >= today());

  const add = async () => {
    if (!start || !end || end < start) { setErr("Das Ende muss am oder nach dem Start sein."); return; }
    setErr("");
    const v = { id: crypto.randomUUID(), start, end, name: name.trim().slice(0, 40) || "Urlaub" };
    if (await saveSettings({ vacations: [...own, v].sort((a, b) => a.start.localeCompare(b.start)) })) setName("Urlaub");
  };
  const del = (id: string) => window.confirm("Diesen Urlaub löschen?") && saveSettings({ vacations: own.filter((v) => v.id !== id) });

  return (
    <div className="detail">
      <p className="muted small">Trag hier deinen Urlaub ein. Danach fragt Pazulic, ob Alltags-Termine (Arbeit, Schule …) in dieser Zeit wegfallen sollen.</p>
      <label className="lbl" htmlFor="vn">Name</label>
      <input id="vn" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <div className="inline">
        <div><label className="lbl" htmlFor="vs">Von</label><input id="vs" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} /></div>
        <div><label className="lbl" htmlFor="ve">Bis</label><input id="ve" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      {err && <p className="err">{err}</p>}
      <button className="btn primary" onClick={add}>+ Urlaub eintragen</button>

      {own.length > 0 && <>
        <h3>Dein Urlaub</h3>
        <ul className="sessions">
          {own.map((v) => (
            <li key={v.id}>
              <span>🌴 <b>{v.name}</b> · {shortDate(v.start)}{v.end !== v.start ? " – " + shortDate(v.end) : ""}</span>
              <button className="icon-btn" aria-label="Urlaub löschen" onClick={() => del(v.id)}>✕</button>
            </li>
          ))}
        </ul>
      </>}
      {google.length > 0 && <>
        <h3>Aus Google Kalender</h3>
        <ul className="sessions">
          {google.map((p) => <li key={p.key}><span>🌴 <b>{p.name}</b> · {shortDate(p.start)}{p.end !== p.start ? " – " + shortDate(p.end) : ""}</span></li>)}
        </ul>
        <p className="muted small">Diese kannst du nur in Google ändern.</p>
      </>}
      {Object.keys(settings.vacation_choices ?? {}).length > 0 && (
        <button className="btn ghost small" onClick={() => saveSettings({ vacation_choices: {} })}>Nochmal fragen, ob Alltags-Termine im Urlaub wegfallen sollen</button>
      )}
    </div>
  );
}
