import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { useGoogle } from "../lib/google";
import { collectLessons, DRIVE_LABEL, SPECIAL_NEED, units } from "../lib/driving";
import type { DriveType } from "../lib/types";
import { fmtMin, shortDate } from "../lib/dates";

const ORDER: DriveType[] = ["normal", "ueberland", "autobahn", "nacht", "pruefung", "keine"];
const fmtU = (n: number) => String(n).replace(".", ",");

/** 🚗 Führerschein-Übersicht: Fahrstunden und Sonderfahrten. */
export default function Driving() {
  const { blocks, googleMarks, googleRules, customKinds, settings, saveSettings } = useStore();
  const google = useGoogle().byDate;
  const drv = useMemo(() => settings.driving ?? {}, [settings.driving]);
  const lessons = useMemo(() => collectLessons(blocks, google, googleMarks, googleRules, customKinds, drv), [blocks, google, googleMarks, googleRules, customKinds, drv]);
  const [showAll, setShowAll] = useState(false);

  const real = lessons.filter((l) => l.type !== "keine");
  const done = real.filter((l) => l.past), plan = real.filter((l) => !l.past);
  const sumU = (list: typeof real, t?: DriveType) => list.filter((l) => !t || l.type === t).reduce((a, l) => a + units(l.min), 0);
  const doneU = sumU(done), planU = sumU(plan);

  const setType = (key: string, t: DriveType) => saveSettings({ driving: { ...drv, types: { ...(drv.types ?? {}), [key]: t } } });

  if (!lessons.length) return (
    <section className="card"><h2>🚗 Führerschein</h2><p className="muted">Noch keine Fahrstunden gefunden. Trag Termine mit „Fahrstunde“ im Namen ein (im Plan oder in Google).</p></section>
  );

  const list = showAll ? [...lessons].reverse() : [...lessons].reverse().slice(0, 12);
  return (
    <>
      <section className="card">
        <h2>🚗 Führerschein</h2>
        <div className="kpis">
          <div><span className="muted small">Gemacht</span><b className="mono">{fmtU(doneU)}</b><span className="muted small">{done.length} {done.length === 1 ? "Termin" : "Termine"} · {fmtMin(done.reduce((a, l) => a + l.min, 0))}</span></div>
          <div><span className="muted small">Geplant</span><b className="mono">{fmtU(planU)}</b><span className="muted small">{plan.length} {plan.length === 1 ? "Termin" : "Termine"}</span></div>
        </div>
        <p className="muted small">Gezählt in Fahrstunden à 45 Min. (90 Min. = 2 Fahrstunden).</p>

        <h3>Sonderfahrten (Pflicht Klasse B)</h3>
        {(Object.keys(SPECIAL_NEED) as DriveType[]).map((t) => {
          const need = SPECIAL_NEED[t]!, have = sumU(done, t), pl = sumU(plan, t);
          const pct = Math.min(100, (have / need) * 100);
          return (
            <div key={t} className="cmp">
              <div className="row-between"><b>{DRIVE_LABEL[t]}</b><span className="mono small">{fmtU(have)} / {need}{pl ? ` (+${fmtU(pl)} geplant)` : ""}</span></div>
              <div className="cmp-bar"><i style={{ width: `${pct}%`, background: have >= need ? "var(--green)" : "var(--yellow)" }} /></div>
            </div>
          );
        })}
        <p className="muted small">Tipp: Sag deinem Fahrlehrer, welche Sonderfahrten noch fehlen.</p>
      </section>

      <section className="card">
        <h2>Deine Fahrstunden</h2>
        <p className="muted small">Wähle bei jeder Fahrstunde die Art. Pazulic rät sie aus dem Namen (z. B. „Autobahn“). „Keine Fahrstunde“ = wird nicht gezählt.</p>
        <ul className="sessions drive-list">
          {list.map((l) => (
            <li key={l.key}>
              <span><b>{shortDate(l.date)}</b> {l.start}–{l.end} <span className="muted small">{l.title}{l.past ? "" : " · geplant"}</span></span>
              <select value={l.type} onChange={(e) => setType(l.key, e.target.value as DriveType)} aria-label="Art der Fahrstunde">
                {ORDER.map((t) => <option key={t} value={t}>{DRIVE_LABEL[t]}</option>)}
              </select>
            </li>
          ))}
        </ul>
        {lessons.length > 12 && <button className="btn ghost small" onClick={() => setShowAll((x) => !x)}>{showAll ? "Weniger zeigen" : `Alle ${lessons.length} zeigen`}</button>}
      </section>
    </>
  );
}
