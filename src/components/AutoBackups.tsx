import { useEffect, useState } from "react";
import { downloadServerBackup, listServerBackups, restoreServerBackup } from "../lib/backup";
import type { ServerBackup } from "../lib/backup";
import { useStore } from "../lib/store";

/** Automatische Sicherungen: jeden Sonntag in der Nacht, die letzten 4 bleiben. */
export default function AutoBackups() {
  const { reloadAll } = useStore();
  const [list, setList] = useState<ServerBackup[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { listServerBackups().then(setList); }, []);
  const when = (iso: string) => new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <p className="muted small" style={{ marginTop: 12 }}><b>Automatisch:</b> Jeden Sonntag in der Nacht macht Pazulic selbst eine Sicherung. Die letzten 4 bleiben gespeichert.</p>
      {list === null ? <p className="muted small">Lädt …</p> : list.length === 0 ? <p className="muted small">Noch keine automatische Sicherung.</p> : (
        <ul className="sessions">
          {list.map((b) => (
            <li key={b.id}>
              <span>🛡️ {when(b.created_at)}</span>
              <span className="trash-actions">
                <button className="btn small" disabled={busy} onClick={() => downloadServerBackup(b)}>⬇</button>
                <button className="btn primary small" disabled={busy} onClick={async () => {
                  if (!window.confirm(`Sicherung vom ${when(b.created_at)} wiederherstellen? Einträge daraus werden wiederhergestellt bzw. überschrieben. Neuere Einträge bleiben.`)) return;
                  setBusy(true); const r = await restoreServerBackup(b.id); setBusy(false);
                  setMsg(r.ok ? { ok: true, t: `✓ ${r.count} Einträge wiederhergestellt.` } : { ok: false, t: r.msg ?? "Fehler." });
                  if (r.ok || r.count) reloadAll();
                }}>Wiederherstellen</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}
    </>
  );
}
