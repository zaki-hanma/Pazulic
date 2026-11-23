import { useEffect, useState } from "react";
import { enablePush, pushStatus } from "../lib/push";

/** Hinweis auf „Heute“, wenn Erinnerungen auf diesem Gerät noch aus sind. */
export default function PushNudge() {
  const [st, setSt] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [hide, setHide] = useState(() => { try { return localStorage.getItem("push-nudge-hide") === "1"; } catch { return false; } });
  useEffect(() => { pushStatus().then(setSt); }, []);
  if (hide || (st !== "off" && st !== "denied")) return null;
  const on = async () => { const r = await enablePush(); if (r.ok) setSt("on"); else setMsg(r.msg ?? ""); };
  const close = () => { setHide(true); try { localStorage.setItem("push-nudge-hide", "1"); } catch { /* egal */ } };
  return (
    <section className="card push-nudge">
      <p><b>🔔 Erinnerungen sind auf diesem Gerät aus.</b></p>
      {st === "denied"
        ? <p className="muted small">Du hast Benachrichtigungen blockiert. Erlaube sie in den Handy-Einstellungen für Pazulic (bzw. Chrome) und öffne die App neu.</p>
        : <p className="muted small">Schalte sie ein, damit du vor deinen Terminen eine Nachricht aufs Handy bekommst.</p>}
      {msg && <p className="err small">{msg}</p>}
      <div className="detail-actions">
        {st === "off" && <button className="btn primary" onClick={on}>Einschalten</button>}
        <button className="btn ghost small" onClick={close}>Nicht mehr zeigen</button>
      </div>
    </section>
  );
}
