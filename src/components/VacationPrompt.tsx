import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { affectedBy, useVacations } from "../lib/vacation";
import type { Period } from "../lib/vacation";
import { OFF_ICON, OFF_LABEL } from "../lib/vacation";
import { isStudy } from "../lib/types";
import { kindInfo } from "../lib/labels";
import { hhmm, shortDate, today } from "../lib/dates";
import Sheet from "./Sheet";

const range = (p: Period) => (p.start === p.end ? shortDate(p.start) : `${shortDate(p.start)} – ${shortDate(p.end)}`);

/** Fragt: Im Urlaub stehen noch Alltags-Termine (Arbeit, Schule …) – behalten oder löschen? */
export default function VacationPrompt() {
  const { blocks, settings, saveSettings } = useStore();
  const { periods } = useVacations();
  const [open, setOpen] = useState<Period | null>(null);
  const choices = settings.vacation_choices ?? {};

  const todo = useMemo(() => periods
    .filter((p) => p.end >= today() && !choices[p.key])
    .map((p) => ({ p, list: affectedBy(p, blocks) }))
    .filter((x) => x.list.length > 0), [periods, blocks, choices]);

  if (!todo.length) return null;
  const decide = (p: Period, c: "keep" | "skip") => saveSettings({ vacation_choices: { ...choices, [p.key]: c } });

  return (
    <>
      {todo.map(({ p, list }) => (
        <section key={p.key} className={"card vac-prompt" + (p.type === "frei" ? " frei" : "")}>
          <h2>{OFF_ICON[p.type]} {p.name}: {range(p)}</h2>
          <p>{p.type === "frei" ? "An deinem freien Tag" : "In deinem Urlaub"} stehen noch <b>{list.reduce((a, x) => a + x.dates.length, 0)} Alltags-Termine</b> im Plan (z. B. {[...new Set(list.map((x) => x.b.title))].slice(0, 3).join(", ")}).</p>
          <p className="muted small">Sollen sie für diese Zeit gelöscht werden? Du bekommst dann auch keine Erinnerungen dafür.</p>
          <div className="detail-actions">
            <button className="btn primary" onClick={() => setOpen(p)}>Auswählen & löschen</button>
            <button className="btn ghost" onClick={() => decide(p, "keep")}>Plan behalten</button>
          </div>
        </section>
      ))}
      {open && <Sheet title={OFF_LABEL[open.type] + ": Termine löschen"} onClose={() => setOpen(null)}><Pick p={open} onDone={() => setOpen(null)} decide={decide} /></Sheet>}
    </>
  );
}

function Pick({ p, onDone, decide }: { p: Period; onDone: () => void; decide: (p: Period, c: "keep" | "skip") => Promise<boolean> }) {
  const { blocks, customKinds, skipMany } = useStore();
  const list = useMemo(() => affectedBy(p, blocks), [p, blocks]);
  // Vorauswahl: alles außer Lernen/Wiederholung
  const [sel, setSel] = useState<Set<string>>(() => new Set(list.filter((x) => !isStudy(x.b.kind)).map((x) => x.b.id)));
  const [busy, setBusy] = useState(false);
  const flip = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const go = async () => {
    setBusy(true);
    const ok = await skipMany(list.filter((x) => sel.has(x.b.id)));
    if (ok) { await decide(p, "skip"); onDone(); }
    setBusy(false);
  };

  return (
    <div className="detail">
      <p><b>{p.name}</b> · {range(p)}</p>
      <p className="muted small">Hake an, was in dieser Zeit <b>wegfallen</b> soll. Gelöschte Tage findest du im Papierkorb 🗑 und kannst sie dort wiederherstellen.</p>
      <ul className="vac-list">
        {list.map((x) => {
          const k = kindInfo(x.b.kind, x.b.custom_kind_id, customKinds);
          return (
            <li key={x.b.id}>
              <label>
                <input type="checkbox" checked={sel.has(x.b.id)} onChange={() => flip(x.b.id)} />
                <span className="pill" style={{ ["--c" as string]: k.color }}>{k.label}</span>
                <span><b>{x.b.title}</b><br /><span className="muted small">{hhmm(x.b.start_time)}–{hhmm(x.b.end_time)} · {x.dates.length}× im Urlaub</span></span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="detail-actions">
        <button className="btn primary" disabled={busy} onClick={go}>{busy ? "Bitte warten …" : sel.size ? `${sel.size} löschen` : "Nichts löschen"}</button>
        <button className="btn ghost" onClick={onDone}>Abbrechen</button>
      </div>
    </div>
  );
}
