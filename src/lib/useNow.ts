import { useEffect, useState } from "react";

/** Aktuelle Zeit, aktualisiert alle `ms` Millisekunden. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
