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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
