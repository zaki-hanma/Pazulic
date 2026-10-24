// Google Kalender → App (nur lesen). Termine kommen über die Edge Function „google-ical“.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "./supabase";
import { useStore } from "./store";
import { addDays, today, ymd } from "./dates";

export interface GEvent { uid: string; date: string; start: string; end: string; allDay: boolean; title: string }

interface G { byDate: Map<string, GEvent[]>; loading: boolean; error: string | null; lastLoad: Date | null; reload: () => void }
const Ctx = createContext<G>({ byDate: new Map(), loading: false, error: null, lastLoad: null, reload: () => {} });
export const useGoogle = () => useContext(Ctx);

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

async function parse(text: string): Promise<GEvent[]> {
  const ICAL = (await import("ical.js")).default;
  const comp = new ICAL.Component(ICAL.parse(text));
  for (const tz of comp.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);
  const from = addDays(today(), -60), to = addDays(today(), 400);
  const vevents = comp.getAllSubcomponents("vevent").map((v) => new ICAL.Event(v));
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>();
  for (const e of vevents) if (!e.isRecurrenceException()) masters.set(e.uid, e);
  for (const e of vevents) if (e.isRecurrenceException()) masters.get(e.uid)?.relateException(e);

  const out: GEvent[] = [];
  const push = (uid: string, title: string, s: InstanceType<typeof ICAL.Time>, e: InstanceType<typeof ICAL.Time>) => {
    if (s.isDate) {
      // Ganztägig: jeden Tag bis (ohne) Enddatum
      let d = ymd(s.toJSDate());
      const end = ymd(e.toJSDate());
      do { if (d >= from && d <= to) out.push({ uid, date: d, start: "00:00", end: "23:59", allDay: true, title }); d = addDays(d, 1); } while (d < end);
      return;
    }
    const sd = s.toJSDate(), ed = e.toJSDate();
    const d = ymd(sd);
    if (d < from || d > to) return;
    const sameDay = ymd(ed) === d;
    out.push({ uid, date: d, start: hm(sd), end: sameDay ? hm(ed) : "23:59", allDay: false, title });
  };

  for (const ev of masters.values()) {
    const title = ev.summary || "Termin";
    if (!ev.isRecurring()) { push(ev.uid, title, ev.startDate, ev.endDate || ev.startDate); continue; }
    const it = ev.iterator();
    let n = 0, t;
    while ((t = it.next()) && n++ < 2000) {
      const ds = ymd(t.toJSDate());
      if (ds > to) break;
      if (ds < from) continue;
      const o = ev.getOccurrenceDetails(t);
      push(ev.uid, o.item.summary || title, o.startDate, o.endDate);
    }
  }
  return out;
}

export function GoogleProvider({ children }: { children: ReactNode }) {
  const { settings, auth } = useStore();
  const [events, setEvents] = useState<GEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoad, setLastLoad] = useState<Date | null>(null);
  const on = settings.google_enabled && !!settings.google_ical_url;

  const load = useCallback(async () => {
    if (!on || !auth) { setEvents([]); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("google-ical", { method: "GET" });
      if (err) throw err;
      const text = typeof data === "string" ? data : data instanceof Blob ? await data.text() : "";
      setEvents(text ? await parse(text) : []);
      setLastLoad(new Date());
    } catch {
      setError("Google Kalender konnte nicht geladen werden. Prüfe den Link in den Einstellungen.");
    }
    setLoading(false);
  }, [on, auth, settings.google_ical_url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    if (!on) return;
    const t = window.setInterval(load, 15 * 60 * 1000);
    const vis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [load, on]);

  const byDate = useMemo(() => {
    const m = new Map<string, GEvent[]>();
    for (const e of events) { const l = m.get(e.date) ?? []; l.push(e); m.set(e.date, l); }
    for (const l of m.values()) l.sort((a, b) => a.start.localeCompare(b.start));
    return m;
  }, [events]);

  return <Ctx.Provider value={{ byDate, loading, error, lastLoad, reload: load }}>{children}</Ctx.Provider>;
}
