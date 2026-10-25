import { useState } from "react";
import { supabase } from "../lib/supabase";
import Logo from "../components/Logo";
import Petals from "../components/Petals";
import { Link } from "react-router-dom";

const SEND_ERR = "Die E-Mail konnte gerade nicht verschickt werden (Problem beim E-Mail-Dienst). Bitte später nochmal versuchen.";
const RATE = "Es wurden gerade zu viele E-Mails verschickt. Bitte warte etwa eine Stunde und versuche es dann nochmal.";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register" | "check">("login");
  const [code, setCode] = useState("");
  const [cool, setCool] = useState(0);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(() => {
    const e = sessionStorage.getItem("auth-error");
    if (e) { sessionStorage.removeItem("auth-error"); return { ok: false, text: e }; }
    return null;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) {
        if (error.message.includes("confirm")) { setMode("check"); setMsg({ ok: false, text: "Deine E-Mail ist noch nicht bestätigt. Öffne die NEUESTE E-Mail von Pazulic (auch im Spam schauen) oder gib den Code ein." }); }
        else setMsg({ ok: false, text: error.message.includes("Invalid") ? "E-Mail oder Passwort ist falsch." : "Anmelden hat nicht geklappt: " + error.message });
      }
    } else {
      if (pw.length < 8) { setMsg({ ok: false, text: "Das Passwort braucht mindestens 8 Zeichen." }); setBusy(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + location.pathname, data: { name: name.trim() } } });
      if (error) setMsg({ ok: false, text: error.message.includes("rate") ? RATE : error.message.toLowerCase().includes("sending") ? SEND_ERR : "Registrieren hat nicht geklappt: " + error.message });
      else if (!data.session) { setMode("check"); startCool(); setMsg({ ok: true, text: "Fast fertig! Wir haben dir eine E-Mail geschickt. Klicke auf den Link darin – oder gib den Code aus der E-Mail hier ein." }); }
    }
    setBusy(false);
  }

  function startCool() {
    setCool(60);
    const t = window.setInterval(() => setCool((c) => { if (c <= 1) { window.clearInterval(t); return 0; } return c - 1; }), 1000);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) { setMsg({ ok: false, text: "Der Code hat 6 Ziffern." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "signup" });
    setBusy(false);
    if (error) setMsg({ ok: false, text: "Der Code ist falsch oder abgelaufen. Nimm den Code aus der NEUESTEN E-Mail." });
  }

  async function resend() {
    if (!email) { setMode("login"); setMsg({ ok: false, text: "Schreib zuerst deine E-Mail-Adresse hinein." }); return; }
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) setMsg({ ok: false, text: error.message.includes("rate") || error.message.includes("seconds") ? RATE : error.message.toLowerCase().includes("sending") ? SEND_ERR : error.message });
    else { startCool(); setMsg({ ok: true, text: "Neue E-Mail ist unterwegs. Wichtig: Nur die NEUESTE E-Mail funktioniert – ältere Links sind dann ungültig." }); }
  }

  if (mode === "check") return (
    <div className="app auth">
      <div className="bg" style={{ backgroundImage: "url(./backgrounds/bibliothek.jpg)" }} />
      <div className="bg-shade" />
      <Petals />
      <form className="card auth-card" onSubmit={verifyCode}>
        <div className="auth-logo"><Logo size={72} /></div>
        <h1>E-Mail bestätigen</h1>
        <p className="muted">Wir haben eine E-Mail an <b>{email}</b> geschickt.</p>
        <ol className="small check-steps">
          <li>Öffne die <b>neueste</b> E-Mail von Pazulic (auch im <b>Spam</b>-Ordner schauen).</li>
          <li>Klicke auf den Link – <b>oder</b> gib unten den 6-stelligen Code ein.</li>
          <li>Bitte <b>nicht mehrmals</b> auf „Registrieren“ drücken: Jede neue E-Mail macht die alte ungültig.</li>
        </ol>
        <label className="lbl" htmlFor="code">Code aus der E-Mail (falls vorhanden)</label>
        <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
        {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
        <button className="btn primary big" disabled={busy || code.length !== 6}>{busy ? "Bitte warten …" : "Bestätigen"}</button>
        <div className="auth-links">
          <button type="button" className="link" disabled={cool > 0} onClick={resend}>{cool > 0 ? `E-Mail nochmal senden (in ${cool} s)` : "E-Mail nochmal senden"}</button>
          <button type="button" className="link" onClick={() => { setMode("login"); setMsg(null); }}>Zur Anmeldung</button>
        </div>
      </form>
    </div>
  );

  async function reset() {
    if (!email) { setMsg({ ok: false, text: "Schreib zuerst deine E-Mail oben hinein, dann tippe nochmal auf „Passwort vergessen?“." }); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    setMsg(error ? { ok: false, text: error.message.includes("rate") || error.message.includes("seconds") ? RATE : error.message.toLowerCase().includes("sending") ? SEND_ERR : error.message } : { ok: true, text: "Wenn es ein Konto mit dieser E-Mail gibt, kommt gleich eine E-Mail. Öffne den Link darin (auch im Spam-Ordner schauen) und wähle ein neues Passwort." });
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
