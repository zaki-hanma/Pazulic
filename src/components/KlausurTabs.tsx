import { NavLink } from "react-router-dom";

export default function KlausurTabs() {
  return (
    <div className="seg wide">
      <NavLink to="/klausuren" className={({ isActive }) => (isActive ? "on" : "")}>Klausuren</NavLink>
      <NavLink to="/langfristig" className={({ isActive }) => (isActive ? "on" : "")}>Langfristig</NavLink>
    </div>
  );
}
