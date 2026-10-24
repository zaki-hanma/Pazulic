import { useState } from "react";
import { useStore } from "../lib/store";
import type { CustomKind } from "../lib/types";

export const COLORS = [
  "#FF9ECF", "#FF6FA8", "#FF8A8A", "#FF5C5C", "#FFB067", "#FF8C42", "#F2CF45", "#E6E65A",
  "#B6E45A", "#5FD394", "#2EC4A0", "#5CC8C8", "#4FC3F7", "#8AA6FF", "#5B7CFF", "#B69CFF",
  "#9D6BFF", "#D07CFF", "#E8ECF3", "#9AA5B6", "#C3A27A", "#A47148", "#7FB069", "#FFD1A9",
];

/** Kleines Formular: eigene Art mit Name und Farbe anlegen. */
export default function NewKind({ onSaved, onCancel, start }: { onSaved: (k: CustomKind) => void; onCancel: () => void; start?: string }) {
  const { saveCustomKind, customKinds } = useStore();
  const [name, setName] = useState(start ?? "");
  const [color, setColor] = useState(COLORS[customKinds.length % COLORS.length]);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim() || busy) return;
    const exists = customKinds.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) { onSaved(exists); return; }
    setBusy(true);
    const k = await saveCustomKind({ name, color });
    setBusy(false);
    if (k) onSaved(k);
  }
  return (
    <div className="newkind">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Fahrstunde, Einkaufen, Sport …" maxLength={40}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
      <div className="colors">
        {COLORS.map((c) => <button type="button" key={c} aria-label={"Farbe " + c} className={"color" + (color === c ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} />)}
        <label className={"color pick" + (!COLORS.includes(color) ? " on" : "")} style={{ background: COLORS.includes(color) ? undefined : color }} title="Eigene Farbe">
          🎨<input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
      </div>
      <div className="inline" style={{ justifyContent: "flex-end" }}>
        <span className="pill" style={{ ["--c" as string]: color, marginRight: "auto" }}>{name.trim() || "Vorschau"}</span>
        <button type="button" className="btn ghost small" onClick={onCancel}>Abbrechen</button>
        <button type="button" className="btn primary small" onClick={save} disabled={!name.trim() || busy}>{busy ? "…" : "Art speichern"}</button>
      </div>
    </div>
  );
}
