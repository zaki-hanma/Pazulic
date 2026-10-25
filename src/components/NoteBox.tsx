import { useEffect, useState } from "react";

/** Notiz-Feld: speichert automatisch, wenn man aufhört zu tippen. */
export default function NoteBox({ value, onSave }: { value: string; onSave: (t: string) => Promise<boolean> }) {
  const [text, setText] = useState(value);
  const [state, setState] = useState<"" | "…" | "✓">("");
  useEffect(() => { setText(value); }, [value]);
  useEffect(() => {
    if (text === value) return;
    setState("…");
    const t = window.setTimeout(async () => { if (await onSave(text)) setState("✓"); }, 800);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <>
      <label className="lbl" htmlFor="note">📝 Notiz {state && <span className="muted small">{state === "…" ? "speichert …" : "gespeichert"}</span>}</label>
      <textarea id="note" className="note" rows={3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Was hast du gemacht? Was willst du noch machen? (Du kannst später danach suchen.)" />
    </>
  );
}
