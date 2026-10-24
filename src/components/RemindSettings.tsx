import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { KINDS, KIND_LABEL } from "../lib/types";
import { DEFAULT_REMIND, REMIND_OPTIONS, disablePush, enablePush, pushStatus, testPush } from "../lib/push";

function Sel({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="rem-row"><span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {REMIND_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </label>
  );
}

export default function RemindSettings() {
  const { settings, saveSettings, customKinds, saveCustomKind } = useStore();
  const [status, setStatus] = useState<string>("…");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const defs = { ...DEFAULT_REMIND, ...(settings.remind_defaults ?? {}) };
  useEffect(() => { pushStatus().then(setStatus); }, []);

  const setDef = (k: string, v: number) => saveSettings({ remind_defaults: { ...defs, [k]: v }, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin" });

  return (
    <div className="form">
      <p className="muted small">Pazulic schickt dir eine Nachricht aufs Handy oder den Laptop – auch wenn die App zu ist. Schalte es auf <b>jedem Gerät</b> einmal ein.</p>
      {status === "unsupported" && <p className="err">Dieses Gerät/dieser Browser kann keine Benachrichtigungen. Auf Android: Pazulic in <b>Chrome</b> öffnen → ⋮ → <b>„App installieren“</b>, dann hier einschalten.</p>}
      {status === "denied" && <p className="err">Benachrichtigungen sind blockiert. Erlaube sie in den Einstellungen deines Browsers/Handys für Pazulic.</p>}
      <div className="detail-actions">
        {status !== "on" ? (
          <button className="btn primary" disabled={busy || status === "unsupported"} onClick={async () => {
            setBusy(true); const r = await enablePush(); setBusy(false);
            setMsg(r.ok ? { ok: true, t: "✓ Erinnerungen sind an diesem Gerät eingeschaltet." } : { ok: false, t: r.msg ?? "Fehler" });
            setStatus(await pushStatus());
          }}>🔔 Erinnerungen einschalten</button>
        ) : (
          <>
            <span className="ok">🔔 An diesem Gerät eingeschaltet</span>
            <button className="btn" disabled={busy} onClick={async () => {
              setBusy(true); const r = await testPush(); setBusy(false);
              setMsg(r.ok ? { ok: true, t: `✓ Test-Nachricht an ${r.devices} ${r.devices === 1 ? "Gerät" : "Geräte"} geschickt.` } : { ok: false, t: "Test hat nicht geklappt. Schalte die Erinnerungen aus und wieder ein." });
            }}>Test senden</button>
            <button className="btn ghost small" onClick={async () => { await disablePush(); setStatus(await pushStatus()); setMsg({ ok: true, t: "Erinnerungen an diesem Gerät ausgeschaltet." }); }}>Ausschalten</button>
          </>
        )}
      </div>
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

      <label className="lbl">Wann erinnern? (Standard je Art)</label>
      <div className="rem-list">
        {KINDS.map((k) => <Sel key={k} label={KIND_LABEL[k]} value={defs[k] ?? defs._other} onChange={(v) => setDef(k, v)} />)}
        {customKinds.map((c) => (
          <Sel key={c.id} label={c.name} value={c.remind_minutes ?? defs._other} onChange={(v) => saveCustomKind({ id: c.id, name: c.name, color: c.color, remind_minutes: v })} />
        ))}
        <Sel label="Google-Termine" value={defs._google} onChange={(v) => setDef("_google", v)} />
      </div>
      <p className="muted small">Bei jedem Eintrag kannst du die Erinnerung auch einzeln ändern. Abgehakte Einträge werden nicht mehr erinnert.</p>
    </div>
  );
}
