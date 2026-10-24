import { NavLink, Outlet, useLocation } from "react-router-dom";
import Petals from "./Petals";
import Logo from "./Logo";
import { useState } from "react";
import { useStore } from "../lib/store";
import SettingsSheet from "./SettingsSheet";

const NAV = [
  { to: "/", label: "Heute", icon: "☀" },
  { to: "/plan", label: "Plan", icon: "▦" },
  { to: "/klausuren", label: "Klausuren", icon: "✎" },
  { to: "/analyse", label: "Analyse", icon: "▮" },
  { to: "/noten", label: "Noten", icon: "★" },
];

const BG: Record<string, string> = { "/noten": "tafel", "/langfristig": "reise" };

export default function Layout() {
  const { pathname } = useLocation();
  const { error, clearError, auth } = useStore();
  const [settings, setSettings] = useState(false);
  const bg = BG[pathname] ?? "bibliothek";
  return (
    <div className="app">
      <div className="bg" style={{ backgroundImage: `url(./backgrounds/${bg}.jpg)` }} />
      <div className="bg-shade" />
      <Petals />
      <aside className="sidebar">
        <div className="brand"><Logo size={40} /><span>Pazulic</span></div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => "side-link" + (isActive || (n.to === "/klausuren" && pathname === "/langfristig") ? " active" : "")}>
              <span className="ico">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <span className="muted small">{auth?.user.email}</span>
          <button className="btn ghost small" onClick={() => setSettings(true)}>⚙ Einstellungen</button>
        </div>
      </aside>
      <button className="gear" onClick={() => setSettings(true)} aria-label="Einstellungen">⚙</button>
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
      <main className="main">
        {error && (
          <div className="toast" role="alert" onClick={clearError}>
            {error} <span className="muted">(tippen zum Schließen)</span>
          </div>
        )}
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => "tab" + (isActive || (n.to === "/klausuren" && pathname === "/langfristig") ? " active" : "")}>
            <span className="ico">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
