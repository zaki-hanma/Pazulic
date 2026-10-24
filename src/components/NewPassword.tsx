import { useState } from "react";
import { supabase } from "../lib/supabase";

/** Neues Passwort setzen (nach „Passwort vergessen“ oder in den Einstellungen). */
export default function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setMsg({ ok: false, t: "Das Passwort braucht mindestens 8 Zeichen." }); return; }
    if (pw !== pw2) { setMsg({ ok: false, t: "Die beiden Passwörter sind nicht gleich." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, t: error.message.includes("different") ? "Das neue Passwort muss anders sein als das alte." : "Hat nicht geklappt: " + error.message }); return; }
    setMsg({ ok: true, t: "✓ Dein neues Passwort ist gespeichert." });
    sessionStorage.removeItem("pw-recovery");
    setTimeout(onDone, 1200);
  }

  return (
    <form className="form" onSubmit={save}>
      <label className="lbl" htmlFor="np1">Neues Passwort</label>
      <div className="pw">
        <input id="np1" type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Passwort verstecken" : "Passwort zeigen"}>{show ? "🙈" : "👁"}</button>
      </div>
      <label className="lbl" htmlFor="np2">Nochmal eingeben</label>
      <input id="np2" type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
      <p className="muted small">Mindestens 8 Zeichen.</p>
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}
      <div className="form-actions"><button className="btn primary" disabled={busy}>{busy ? "Speichert …" : "Passwort speichern"}</button></div>
    </form>
  );
}
