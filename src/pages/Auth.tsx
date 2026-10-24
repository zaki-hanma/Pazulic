import { useState } from "react";
import { supabase } from "../lib/supabase";
import Logo from "../components/Logo";
import Petals from "../components/Petals";
import { Link } from "react-router-dom";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg({ ok: false, text: error.message.includes("Invalid") ? "E-Mail oder Passwort ist falsch." : error.message.includes("confirm") ? "Bitte bestätige zuerst deine E-Mail (Link im Postfach)." : "Anmelden hat nicht geklappt: " + error.message });
    } else {
      if (pw.length < 8) { setMsg({ ok: false, text: "Das Passwort braucht mindestens 8 Zeichen." }); setBusy(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + location.pathname, data: { name: name.trim() } } });
      if (error) setMsg({ ok: false, text: "Registrieren hat nicht geklappt: " + error.message });
      else if (!data.session) setMsg({ ok: true, text: "Fast fertig! Öffne die E-Mail von uns und klicke auf den Link. Danach kannst du dich anmelden." });
    }
    setBusy(false);
  }

  async function reset() {
    if (!email) { setMsg({ ok: false, text: "Schreib zuerst deine E-Mail oben hinein." }); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Wir haben dir eine E-Mail zum Zurücksetzen geschickt." });
  }

  return (
    <div className="app auth">
      <div className="bg" style={{ backgroundImage: "url(./backgrounds/bibliothek.jpg)" }} />
      <div className="bg-shade" />
      <Petals />
      <form className="card auth-card" onSubmit={submit}>
        <div className="auth-logo"><Logo size={84} /></div>
        <h1>Pazulic</h1>
        <p className="muted">{mode === "login" ? "Willkommen zurück! Melde dich an." : "Neues Konto erstellen"}</p>
        {mode === "register" && <>
          <label className="lbl" htmlFor="nm">Dein Vorname (oder Spitzname)</label>
          <input id="nm" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
        </>}
        <label className="lbl" htmlFor="em">E-Mail</label>
        <input id="em" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="lbl" htmlFor="pw">Passwort</label>
        <div className="pw">
          <input id="pw" type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={pw} onChange={(e) => setPw(e.target.value)} required />
          <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Passwort verstecken" : "Passwort zeigen"}>{show ? "🙈" : "👁"}</button>
        </div>
        {mode === "register" && <p className="muted small">Mit der Registrierung akzeptierst du die <Link className="link" to="/datenschutz">Datenschutzerklärung</Link>.</p>}
        {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? "Bitte warten …" : mode === "login" ? "Anmelden" : "Registrieren"}</button>
        <div className="auth-links">
          <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMsg(null); }}>
            {mode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Anmelden"}
          </button>
          {mode === "login" && <button type="button" className="link" onClick={reset}>Passwort vergessen?</button>}
        </div>
        <p className="small legal-links"><Link to="/impressum">Impressum</Link> · <Link to="/datenschutz">Datenschutz</Link></p>
      </form>
    </div>
  );
}
