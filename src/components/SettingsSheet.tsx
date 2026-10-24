import { useState } from "react";
import { useStore } from "../lib/store";
import { useGoogle } from "../lib/google";
import Sheet from "./Sheet";
import { downloadBackup, restoreBackup } from "../lib/backup";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import RemindSettings from "./RemindSettings";

const OK = /^https:\/\/calendar\.google\.com\/calendar\/ical\/[^\s]+\.ics(\?[^\s]*)?$/;
/** Link säubern: Leerzeichen/Zeilenumbrüche weg, webcal:// → https:// */
const clean = (u: string) => u.replace(/\s+/g, "").replace(/^webcals?:\/\//i, "https://").replace(/^http:\/\//i, "https://");

function NameEdit() {
  const { auth } = useStore();
  const [name, setName] = useState((auth?.user.user_metadata?.name as string) ?? "");
  const [ok, setOk] = useState(false);
  return (
    <div className="inline">
      <input aria-label="Dein Name" value={name} onChange={(e) => { setName(e.target.value); setOk(false); }} placeholder="Dein Name" maxLength={30} />
      <button className="btn" onClick={async () => { const { error } = await supabase.auth.updateUser({ data: { name: name.trim() } }); setOk(!error); }}>{ok ? "✓" : "Name speichern"}</button>
    </div>
  );
}

export default function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings, saveSettings, signOut, auth, reloadAll } = useStore();
  const [bmsg, setBmsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [bbusy, setBbusy] = useState(false);
  const g = useGoogle();
  const [url, setUrl] = useState(settings.google_ical_url ?? "");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    const u = clean(url);
    if (!OK.test(u)) {
      let why = "Er muss mit https://calendar.google.com/calendar/ical/ beginnen und mit .ics enden.";
      if (u.includes("/embed")) why = "Das ist der Link zum Einbetten. Du brauchst die „Geheime Adresse im iCal-Format“.";
      else if (u.includes("/public/")) why = "Das ist die öffentliche Adresse. Die funktioniert nur, wenn dein Kalender öffentlich ist. Nimm lieber die „Geheime Adresse im iCal-Format“.";
      else if (!u.startsWith("https://calendar.google.com")) why = "Der Link kommt nicht von calendar.google.com.";
      setMsg({ ok: false, t: "Dieser Link passt nicht. " + why + " Dein Link beginnt mit: " + u.slice(0, 45) + "…" });
      return;
    }
    setBusy(true);
    const ok = await saveSettings({ google_ical_url: u, google_enabled: true });
    if (!ok) { setBusy(false); setMsg({ ok: false, t: "Speichern hat nicht geklappt. Bitte nochmal versuchen." }); return; }
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
        <h3>Erinnerungen</h3>
        <RemindSettings />

        <h3 style={{ marginTop: 18 }}>Google Kalender (freiwillig)</h3>
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
                <li>Ganz nach unten scrollen zu <b>„Geheime Adresse im iCal-Format“</b> (englisch: „Secret address in iCal format“) → auf das Kopier-Symbol klicken.</li>
                <li>Hier einfügen und auf „Verbinden“ tippen.</li>
              </ol>
              <p className="muted small">Wichtig: Diesen Link niemandem zeigen – wer ihn hat, kann deine Termine sehen.</p>
            </details>
            <label className="lbl" htmlFor="g-url">Geheime Adresse im iCal-Format</label>
            <div className="pw">
              <input id="g-url" type={show ? "text" : "password"} inputMode="url" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autoComplete="off" />
              <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Link verstecken" : "Link zeigen"}>{show ? "🙈" : "👁"}</button>
            </div>
            <div className="form-actions"><button className="btn primary" onClick={connect} disabled={busy || !url}>{busy ? "Speichert …" : "Verbinden"}</button></div>
          </>
        )}
        {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

        <h3 style={{ marginTop: 18 }}>Sicherung</h3>
        <p className="muted small">Lade alle deine Daten (Klausuren, Plan, Lernzeiten, Noten …) als Datei herunter. Mach das ab und zu und speichere die Datei z. B. in OneDrive. Mit der Datei kannst du alles wiederherstellen.</p>
        <div className="detail-actions">
          <button className="btn primary" disabled={bbusy} onClick={async () => { setBbusy(true); const r = await downloadBackup(); setBbusy(false); setBmsg(r.ok ? { ok: true, t: `✓ Sicherung mit ${r.count} Einträgen heruntergeladen.` } : { ok: false, t: "Sicherung hat nicht geklappt. Prüfe dein Internet." }); }}>⬇ Sicherung herunterladen</button>
          <label className="btn">
            ⬆ Sicherung einspielen
            <input type="file" accept="application/json,.json" hidden onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = "";
              if (!f || !window.confirm("Sicherung einspielen? Einträge aus der Datei werden wiederhergestellt bzw. überschrieben. Neuere Einträge bleiben.")) return;
              setBbusy(true); const r = await restoreBackup(f); setBbusy(false);
              setBmsg(r.ok ? { ok: true, t: `✓ ${r.count} Einträge wiederhergestellt.` } : { ok: false, t: r.msg ?? "Fehler." });
              if (r.ok || r.count) reloadAll();
            }} />
          </label>
        </div>
        {bmsg && <p className={bmsg.ok ? "ok" : "err"}>{bmsg.t}</p>}

        <h3 style={{ marginTop: 18 }}>Konto</h3>
        <p className="muted small">Angemeldet als {auth?.user.email}</p>
        <NameEdit />
        <div className="detail-actions">
          <button className="btn" onClick={signOut}>Abmelden</button>
          <button className="btn danger" onClick={async () => {
            const w = window.prompt("Konto löschen? ALLE deine Daten werden endgültig gelöscht. Tipp: Lade vorher eine Sicherung herunter.\n\nSchreib LÖSCHEN zum Bestätigen:");
            if (w?.trim().toUpperCase() !== "LÖSCHEN") return;
            const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
            if (error) { setBmsg({ ok: false, t: "Konto löschen hat nicht geklappt. Bitte später nochmal." }); return; }
            await signOut();
          }}>Konto löschen</button>
        </div>
        <p className="small legal-links"><Link to="/impressum" onClick={onClose}>Impressum</Link> · <Link to="/datenschutz" onClick={onClose}>Datenschutz</Link></p>
      </div>
    </Sheet>
  );
}
