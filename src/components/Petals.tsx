import { memo } from "react";

// Ruhige Sakura-Blätter im Hintergrund. Nur CSS-Animation (schnell, kein Flackern).
function Petals() {
  const items = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="petals" aria-hidden>
      {items.map((i) => (
        <span key={i} style={{
          left: `${(i * 73) % 100}%`,
          animationDuration: `${14 + ((i * 7) % 10)}s`,
          animationDelay: `${-((i * 3.7) % 18)}s`,
          transform: `scale(${0.6 + ((i * 13) % 6) / 10})`,
        }} />
      ))}
    </div>
  );
}
export default memo(Petals);
