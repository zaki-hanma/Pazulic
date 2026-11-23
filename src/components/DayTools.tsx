import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { occurrencesOn, isRepeating, learnMinutes } from "../lib/plan";
import { kindInfo } from "../lib/labels";
import { addDays, hhmm, longDate, shortDate } from "../lib/dates";
import { isStudy } from "../lib/types";
import type { DayTemplate, TemplateItem } from "../lib/types";

/** Tag kopieren, als Vorlage speichern und Vorlagen einfügen. */
export default function DayTools({ day, onDone }: { day: string; onDone: () => void }) {
  const { blocks, customKinds, addBlocks, settings, saveSettings } = useStore();
  const templates = settings.templates ?? [];
  const occs = useMemo(() => occurrencesOn(blocks, day), [blocks, day]);
  const [tab, setTab] = useState<"vorlage" | "kopieren">(templates.length ? "vorlage" : "kopieren");
  // Vorauswahl: einzelne Einträge ja, Serien nein (die kommen ja sowieso)
  const [sel, setSel] = useState<Set<string>>(() => new Set(occs.filter((o) => !isRepeating(o.block)).map((o) => o.block.id)));
  const [target, setTarget] = useState(addDays(day, 1));
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const flip = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chosen = occs.filter((o) => sel.has(o.block.id));

  const rowsFor = (items: TemplateItem[], date: string) => items.map((i) => ({
    date, start_time: i.start, end_time: i.end, kind: i.kind, title: i.title, custom_kind_id: i.custom_kind_id,
    remind_minutes: i.remind_minutes ?? null, planned_minutes: isStudy(i.kind) ? learnMinutes(i.start, i.end) : 0,
  }));

  const copy = async () => {
    if (!chosen.length || !target) return;
    // Konflikt-Check: gibt es am Ziel-Tag schon Einträge zur gleichen Zeit?
    const there = occurrencesOn(blocks, target);
    const clash = chosen.filter((o) => there.some((t) => t.block.start_time.slice(0, 5) === o.block.start_time.slice(0, 5) && t.block.title === o.block.title));
    if (clash.length && !window.confirm(`Am ${longDate(target)} gibt es schon: ${clash.map((c) => c.block.title).join(", ")}. Trotzdem kopieren?`)) return;
    setBusy(true);
    const ok = await addBlocks(chosen.map((o) => ({
      date: target, start_time: o.block.start_time, end_time: o.block.end_time, kind: o.block.kind, title: o.block.title,
      custom_kind_id: o.block.custom_kind_id, remind_minutes: o.block.remind_minutes ?? null, exam_id: o.block.exam_id,
      topic_ids: o.block.topic_ids, planned_minutes: o.block.planned_minutes,
    })));
    setBusy(false);
    setMsg(ok ? { ok: true, t: `✓ ${chosen.length} Einträge auf ${shortDate(target)} kopiert.` } : { ok: false, t: "Kopieren hat nicht geklappt." });
  };

  const saveTpl = async () => {
    if (!chosen.length) return;
    const n = name.trim().slice(0, 40) || `Vorlage ${templates.length + 1}`;
    const t: DayTemplate = { id: crypto.randomUUID(), name: n, items: chosen.map((o) => ({
      kind: o.block.kind, custom_kind_id: o.block.custom_kind_id, title: o.block.title, start: o.block.start_time.slice(0, 5), end: o.block.end_time.slice(0, 5), remind_minutes: o.block.remind_minutes ?? null,
    })) };
    if (await saveSettings({ templates: [...templates, t] })) { setName(""); setMsg({ ok: true, t: `✓ Vorlage „${n}“ gespeichert.` }); }
  };

  const apply = async (t: DayTemplate) => {
    setBusy(true);
    const ok = await addBlocks(rowsFor(t.items, day));
    setBusy(false);
    if (ok) onDone(); else setMsg({ ok: false, t: "Einfügen hat nicht geklappt." });
  };
  const delTpl = (t: DayTemplate) => window.confirm(`Vorlage „${t.name}“ löschen?`) && saveSettings({ templates: templates.filter((x) => x.id !== t.id) });

  return (
    <div className="form">
      <div className="seg">
        <button type="button" className={tab === "vorlage" ? "on" : ""} onClick={() => { setTab("vorlage"); setMsg(null); }}>📋 Vorlage einfügen</button>
        <button type="button" className={tab === "kopieren" ? "on" : ""} onClick={() => { setTab("kopieren"); setMsg(null); }}>⧉ Tag kopieren / speichern</button>
      </div>

      {tab === "vorlage" ? (
        templates.length === 0 ? <p className="muted">Noch keine Vorlage. Plane einen Tag, dann tippe auf „Tag kopieren / speichern“ und speichere ihn als Vorlage (z. B. „Abend nach der Arbeit“).</p> : (
          <>
            <p className="muted small">Fügt alle Einträge der Vorlage am <b>{longDate(day)}</b> ein.</p>
            <ul className="tpl-list">
              {templates.map((t) => (
                <li key={t.id}>
                  <div>
                    <b>{t.name}</b>
                    <div className="tpl-items">{t.items.map((i, n) => { const k = kindInfo(i.kind, i.custom_kind_id, customKinds); return <span key={n} className="pill" style={{ ["--c" as string]: k.color }}>{i.start} {i.title}</span>; })}</div>
                  </div>
                  <span className="trash-actions">
                    <button className="btn primary small" disabled={busy} onClick={() => apply(t)}>Einfügen</button>
                    <button className="icon-btn" aria-label="Vorlage löschen" onClick={() => delTpl(t)}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )
      ) : occs.length === 0 ? <p className="muted">An diesem Tag ist nichts geplant.</p> : (
        <>
          <p className="muted small">Wähle die Einträge vom <b>{longDate(day)}</b>. Wiederholte Einträge (↻) sind nicht angehakt, weil sie sowieso wiederkommen.</p>
          <ul className="vac-list">
            {occs.map((o) => { const k = kindInfo(o.block.kind, o.block.custom_kind_id, customKinds); return (
              <li key={o.block.id}><label>
                <input type="checkbox" checked={sel.has(o.block.id)} onChange={() => flip(o.block.id)} />
                <span className="pill" style={{ ["--c" as string]: k.color }}>{k.label}</span>
                <span><b>{o.block.title}</b>{isRepeating(o.block) ? " ↻" : ""}<br /><span className="muted small">{hhmm(o.block.start_time)}–{hhmm(o.block.end_time)}</span></span>
              </label></li>
            ); })}
          </ul>
          <label className="lbl" htmlFor="dt-target">Kopieren auf</label>
          <div className="inline">
            <input id="dt-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
            <button className="btn primary" disabled={busy || !chosen.length || !target} onClick={copy}>⧉ Kopieren ({chosen.length})</button>
          </div>
          <label className="lbl" htmlFor="dt-name">… oder als Vorlage speichern</label>
          <div className="inline">
            <input id="dt-name" value={name} maxLength={40} placeholder="z. B. Abend nach der Arbeit" onChange={(e) => setName(e.target.value)} />
            <button className="btn" disabled={!chosen.length} onClick={saveTpl}>💾 Speichern</button>
          </div>
        </>
      )}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}
    </div>
  );
}
