import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
// Schriften lokal (kein Google Fonts → keine Daten an Google)
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/bricolage-grotesque/latin-700.css";
import "@fontsource/bricolage-grotesque/latin-800.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "./styles.css";
import App from "./App";
import { StoreProvider } from "./lib/store";
import { supabase } from "./lib/supabase";

// Links aus E-Mails (Passwort zurücksetzen, E-Mail bestätigen) bringen Daten im „#…“ mit.
// Zuerst die Anmeldung daraus lesen, DANN die App starten (sonst überschreibt der Router den Link).
async function boot() {
  const h = window.location.hash;
  if (h.includes("access_token=") || h.includes("error_description=")) {
    const p = new URLSearchParams(h.replace(/^#/, ""));
    if (p.get("type") === "recovery") sessionStorage.setItem("pw-recovery", "1");
    if (p.get("error_description")) sessionStorage.setItem("auth-error", p.get("error_code") === "otp_expired" ? "Dieser Link funktioniert nicht mehr. Meist liegt es daran, dass eine neuere E-Mail geschickt wurde (dann gilt nur die neueste) oder der Link schon benutzt wurde. Versuch dich einfach anzumelden – vielleicht ist dein Konto schon bestätigt." : p.get("error_description")!);
    await supabase.auth.getSession();
    history.replaceState(null, "", window.location.pathname + "#/");
  }
  render();
}

function render() {
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>
  </StrictMode>,
);
}
boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
