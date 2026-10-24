import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Datenschutz, Impressum } from "./legal/Legal";
import { useStore } from "./lib/store";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import Heute from "./pages/Heute";
import Plan from "./pages/Plan";
import Klausuren from "./pages/Klausuren";
import Analyse from "./pages/Analyse";
import Noten from "./pages/Noten";
import Langfristig from "./pages/Langfristig";
import Logo from "./components/Logo";
import { GoogleProvider } from "./lib/google";
import { useEffect, useState } from "react";
import NewPassword from "./components/NewPassword";
import Petals from "./components/Petals";

export default function App() {
  const { auth, authReady, ready } = useStore();
  const { pathname } = useLocation();
  const [recovery, setRecovery] = useState(() => sessionStorage.getItem("pw-recovery") === "1");
  useEffect(() => {
    const on = () => setRecovery(true);
    window.addEventListener("pw-recovery", on);
    return () => window.removeEventListener("pw-recovery", on);
  }, []);
  if (pathname === "/impressum") return <Impressum />;
  if (pathname === "/datenschutz") return <Datenschutz />;
  if (!authReady) return <Splash />;
  if (!auth) return <Auth />;
  if (recovery) return (
    <div className="app auth">
      <div className="bg" style={{ backgroundImage: "url(./backgrounds/bibliothek.jpg)" }} />
      <div className="bg-shade" />
      <Petals />
      <div className="card auth-card">
        <div className="auth-logo"><Logo size={72} /></div>
        <h1>Neues Passwort</h1>
        <p className="muted">Wähle ein neues Passwort für {auth.user.email}.</p>
        <NewPassword onDone={() => setRecovery(false)} />
      </div>
    </div>
  );
  if (!ready) return <Splash />;
  return (
    <GoogleProvider>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Heute />} />
        <Route path="plan" element={<Plan />} />
        <Route path="analyse" element={<Analyse />} />
        <Route path="klausuren" element={<Klausuren />} />
        <Route path="langfristig" element={<Langfristig />} />
        <Route path="noten" element={<Noten />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </GoogleProvider>
  );
}

function Splash() {
  return (
    <div className="splash">
      <Logo size={96} />
      <p className="muted">Pazulic lädt …</p>
    </div>
  );
}
