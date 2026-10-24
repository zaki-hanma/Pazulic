import { Navigate, Route, Routes } from "react-router-dom";
import { useStore } from "./lib/store";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import Heute from "./pages/Heute";
import Plan from "./pages/Plan";
import Klausuren from "./pages/Klausuren";
import Analyse from "./pages/Analyse";
import Noten from "./pages/Noten";
import Logo from "./components/Logo";

export default function App() {
  const { auth, authReady, ready } = useStore();
  if (!authReady) return <Splash />;
  if (!auth) return <Auth />;
  if (!ready) return <Splash />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Heute />} />
        <Route path="plan" element={<Plan />} />
        <Route path="analyse" element={<Analyse />} />
        <Route path="klausuren" element={<Klausuren />} />
        <Route path="noten" element={<Noten />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
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
