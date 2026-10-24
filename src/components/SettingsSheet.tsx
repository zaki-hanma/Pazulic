import { useState } from "react";
import { useStore } from "../lib/store";
import { useGoogle } from "../lib/google";
import Sheet from "./Sheet";

const OK = /^https:\/\/calendar\.google\.com\/calendar\/ical\/\S+\.ics$/;

export default function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings, saveSettings, signOut, auth } = useStore();
  const g = useGoogle();
  const [url, setUrl] = useState(settings.google_ical_url ?? "");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    const u = url.trim();
    if (!OK.test(u)) { setMsg({ ok: false, t: "Das ist kein gültiger Google-iCal-Link. Er beginnt mit https://calendar.google.com/calendar/ical/ und endet mit .ics" }); return; }
    setBusy(true);
    const ok = await saveSettings({ google_ical_url: u, google_enabled: true });
    setBusy(false);
    if (ok) setMsg({ ok: true, t: "Verbunden! Deine Google-Termine erscheinen jetzt in Heute, Plan und Kalender." });
  }
  async function disconnect() {
    if (!window.confirm("Google Kalender trennen? Der Link wird gelöscht.")) return;
    if (await saveSettings({ google_ical_url: null, google_enabled: false })) { setUrl(""); setMsg({ ok: true, t: "Getrennt." }); }
  }

  const connected = settings.google_enabled && !!settings.google_ical_url;
  return (
    <Sheet title="Einstellungen" onClose={onClose}>
      <div className="form">
        <h3>Google Kalender (freiwillig)</h3>
        <p className="muted small">Nur in eine Richtung: Termine aus Google erscheinen in Pazulic. Pazulic schreibt nichts in deinen Google Kalender.</p>
        {connected ? (
          <>
            <p className="ok">✓ Verbunden{g.lastLoad ? ` · zuletzt geladen ${g.lastLoad.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
            {g.error && <p className="err">{g.error}</p>}
            <div className="detail-actions">
              <button className="btn" onClick={g.reload} disabled={g.loading}>{g.loading ? "Lädt …" : "Jetzt aktualisieren"}</button>
              <button className="btn danger" onClick={disconnect}>Trennen</button>
            </div>
          </>
        ) : (
          <>
            <details className="howto">
              <summary>So findest du den Link (am Laptop)</summary>
              <ol>
                <li>Öffne <b>calendar.google.com</b> am Laptop.</li>
                <li>Links bei „Meine Kalender“: auf die drei Punkte ⋮ neben deinem Kalender → <b>Einstellungen und Freigabe</b>.</li>
                <li>Ganz nach unten scrollen zu <b>„Privatadresse im iCal-Format“</b> → kopieren.</li>
                <li>Hier einfügen und auf „Verbinden“ tippen.</li>
              </ol>
              <p className="muted small">Wichtig: Diesen Link niemandem zeigen – wer ihn hat, kann deine Termine sehen.</p>
            </details>
            <label className="lbl" htmlFor="g-url">Privatadresse im iCal-Format</label>
            <div className="pw">
              <input id="g-url" type={show ? "text" : "password"} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autoComplete="off" />
              <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Link verstecken" : "Link zeigen"}>{show ? "🙈" : "👁"}</button>
            </div>
            <div className="form-actions"><button className="btn primary" onClick={connect} disabled={busy || !url}>{busy ? "Speichert …" : "Verbinden"}</button></div>
          </>
        )}
        {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

        <h3 style={{ marginTop: 18 }}>Konto</h3>
        <p className="muted small">Angemeldet als {auth?.user.email}</p>
        <div className="detail-actions"><button className="btn" onClick={signOut}>Abmelden</button></div>
      </div>
    </Sheet>
  );
}
