// Schickt Push-Erinnerungen vor Plan-Einträgen und Google-Terminen.
// Wird jede Minute von pg_cron aufgerufen (mit Geheimnis), oder vom Nutzer für eine Test-Nachricht.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";
import ICAL from "npm:ical.js@2.1.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const APP_URL = "https://zaki-hanma.github.io/Pazulic/";
const DEFAULTS: Record<string, number> = { lernen: 5, wiederholung: 5, unterwegs: -1, arbeit: -1, _other: 30, _google: 30 };
const STUDY = new Set(["lernen", "wiederholung"]);

// ---------- Datum-Hilfen (lokale Zeit des Nutzers) ----------
const pad = (n: number) => String(n).padStart(2, "0");
function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s: string, n: number) => { const d = parseYmd(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const isoWd = (s: string) => { const w = parseYmd(s).getUTCDay(); return w === 0 ? 7 : w; };
const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(":").map(Number); return h * 60 + m; };
const dayDiff = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 864e5);
const mondayOf = (d: string) => addDays(d, 1 - isoWd(d));

// deno-lint-ignore no-explicit-any
type Any = any;
function matchesRule(r: Any, start: string, date: string): boolean {
  if (date < start) return false;
  if (r.until && date > r.until) return false;
  const n = Math.max(1, r.interval || 1);
  const d = parseYmd(date), s = parseYmd(start);
  switch (r.freq) {
    case "daily": return dayDiff(start, date) % n === 0;
    case "weekly": {
      const wds = r.weekdays?.length ? r.weekdays : [isoWd(start)];
      if (!wds.includes(isoWd(date))) return false;
      return (dayDiff(mondayOf(start), mondayOf(date)) / 7) % n === 0;
    }
    case "monthly": {
      const months = (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + d.getUTCMonth() - s.getUTCMonth();
      if (months % n !== 0) return false;
      if (r.monthMode === "nth") {
        if (isoWd(date) !== (r.nthWeekday ?? isoWd(start))) return false;
        const nth = r.nth ?? 1;
        if (nth === -1) return d.getUTCMonth() !== parseYmd(addDays(date, 7)).getUTCMonth();
        return Math.ceil(d.getUTCDate() / 7) === nth;
      }
      const want = r.monthDay ?? s.getUTCDate();
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      return d.getUTCDate() === Math.min(want, last);
    }
    case "yearly":
      return d.getUTCMonth() === s.getUTCMonth() && d.getUTCDate() === s.getUTCDate() && (d.getUTCFullYear() - s.getUTCFullYear()) % n === 0;
  }
  return false;
}
function occursOn(b: Any, date: string): { done: boolean } | null {
  if (b.skip_dates?.includes(date)) return null;
  if (b.repeat_rule) return matchesRule(b.repeat_rule, b.date, date) ? { done: b.completed_dates?.includes(date) } : null;
  if (b.repeat_weekdays?.length) return date >= b.date && b.repeat_weekdays.includes(isoWd(date)) ? { done: b.completed_dates?.includes(date) } : null;
  return b.date === date ? { done: b.done } : null;
}

// ---------- Google ----------
async function googleEvents(admin: Any, userId: string, url: string, tz: string, today: string) {
  const { data: cache } = await admin.from("google_cache").select("events, fetched_at").eq("user_id", userId).maybeSingle();
  if (cache && Date.now() - new Date(cache.fetched_at).getTime() < 15 * 60 * 1000) return cache.events as Any[];
  const events: Any[] = [];
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Pazulic" } });
    if (!r.ok) return cache?.events ?? [];
    const comp = new ICAL.Component(ICAL.parse(await r.text()));
    for (const t of comp.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(t);
    const vevents = comp.getAllSubcomponents("vevent").map((v: Any) => new ICAL.Event(v));
    const masters = new Map<string, Any>();
    for (const e of vevents) if (!e.isRecurrenceException()) masters.set(e.uid, e);
    for (const e of vevents) if (e.isRecurrenceException()) masters.get(e.uid)?.relateException(e);
    const to = addDays(today, 2);
    const push = (uid: string, title: string, s: Any, e: Any) => {
      if (s.isDate) return;
      const a = localParts(s.toJSDate(), tz), b = localParts(e.toJSDate(), tz);
      if (a.date < today || a.date > to) return;
      events.push({ uid, title, date: a.date, start: a.min, end: b.date === a.date ? b.min : 1439 });
    };
    for (const ev of masters.values()) {
      const title = ev.summary || "Termin";
      if (!ev.isRecurring()) { push(ev.uid, title, ev.startDate, ev.endDate || ev.startDate); continue; }
      const it = ev.iterator(); let t; let n = 0;
      while ((t = it.next()) && n++ < 3000) {
        const ds = localParts(t.toJSDate(), tz).date;
        if (ds > to) break;
        if (ds < addDays(today, -1)) continue;
        const o = ev.getOccurrenceDetails(t);
        push(ev.uid, o.item.summary || title, o.startDate, o.endDate);
      }
    }
  } catch { return cache?.events ?? []; }
  await admin.from("google_cache").upsert({ user_id: userId, events, fetched_at: new Date().toISOString() });
  return events;
}

const fmtT = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const inText = (m: number) => (m <= 0 ? "Jetzt" : m < 60 ? `In ${m} Min.` : m % 60 ? `In ${Math.floor(m / 60)} Std. ${m % 60} Min.` : `In ${m / 60} Std.`);

async function sendTo(admin: Any, subs: Any[], payload: Any) {
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 600, urgency: "high" });
      ok++;
    } catch (e: Any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return ok;
}

async function processUser(admin: Any, userId: string, subs: Any[], now: Date) {
  const [{ data: st }, { data: blocks }, { data: kinds }, { data: rules }, { data: marks }, { data: exams }] = await Promise.all([
    admin.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("plan_blocks").select("*").eq("user_id", userId).is("deleted_at", null),
    admin.from("custom_kinds").select("*").eq("user_id", userId),
    admin.from("google_rules").select("*").eq("user_id", userId),
    admin.from("google_marks").select("*").eq("user_id", userId),
    admin.from("exams").select("id, subject, short_name").eq("user_id", userId),
  ]);
  const tz = st?.timezone || "Europe/Berlin";
  const defs = { ...DEFAULTS, ...(st?.remind_defaults ?? {}) };
  const { date: today, min: nowMin } = localParts(now, tz);
  const kindById = new Map((kinds ?? []).map((k: Any) => [k.id, k]));
  const due: { key: string; payload: Any }[] = [];

  // Plan-Einträge (heute und morgen, für Erinnerungen über Mitternacht)
  for (const [date, offset] of [[today, 0], [addDays(today, 1), 1440]] as [string, number][]) {
    for (const b of blocks ?? []) {
      const o = occursOn(b, date);
      if (!o || o.done) continue;
      const ck = b.custom_kind_id ? kindById.get(b.custom_kind_id) : null;
      const before = b.remind_minutes ?? ck?.remind_minutes ?? defs[b.kind] ?? defs._other;
      if (before == null || before < 0) continue;
      const start = toMin(b.start_time) + offset, at = start - before;
      if (at > nowMin || at <= nowMin - 3) continue;
      const exam = b.exam_id ? (exams ?? []).find((e: Any) => e.id === b.exam_id) : null;
      const study = STUDY.has(b.kind);
      due.push({
        key: `b|${b.id}|${date}|${b.start_time}`,
        payload: {
          title: study ? `📚 ${b.title}` : `⏰ ${b.title}`,
          body: `${inText(start - nowMin)} · ${fmtT(toMin(b.start_time))}–${fmtT(toMin(b.end_time))}${exam ? " · " + (exam.short_name || exam.subject) : ""}${study ? " · 25 Min. lernen + 5 Min. Pause" : ""}`,
          tag: `b-${b.id}-${date}`, url: APP_URL,
        },
      });
    }
  }

  // Google-Termine
  if (st?.google_enabled && st?.google_ical_url) {
    const evs = await googleEvents(admin, userId, st.google_ical_url, tz, today);
    const hiddenAll = new Set((marks ?? []).filter((m: Any) => m.hidden && m.date === "2000-01-01").map((m: Any) => m.uid));
    const sorted = [...(rules ?? [])].sort((a: Any, b: Any) => b.match.length - a.match.length);
    for (const ev of evs) {
      const offset = ev.date === today ? 0 : ev.date === addDays(today, 1) ? 1440 : null;
      if (offset == null || hiddenAll.has(ev.uid)) continue;
      const m = (marks ?? []).find((x: Any) => x.uid === ev.uid && x.date === ev.date);
      if (m?.hidden || m?.done) continue;
      const rule = sorted.find((r: Any) => ev.title.toLowerCase().includes(r.match));
      const kind = m?.kind ?? rule?.kind ?? "termin";
      const ck = (m?.custom_kind_id ?? rule?.custom_kind_id) ? kindById.get(m?.custom_kind_id ?? rule?.custom_kind_id) : null;
      const before = rule?.remind_minutes ?? ck?.remind_minutes ?? (ck ? defs._other : defs[kind]) ?? defs._google;
      if (before == null || before < 0) continue;
      const start = ev.start + offset, at = start - before;
      if (at > nowMin || at <= nowMin - 3) continue;
      due.push({
        key: `g|${ev.uid}|${ev.date}|${ev.start}`,
        payload: { title: `⏰ ${ev.title}`, body: `${inText(start - nowMin)} · ${fmtT(ev.start)}–${fmtT(ev.end)} · Google`, tag: `g-${ev.uid}-${ev.date}`, url: APP_URL },
      });
    }
  }

  let sent = 0;
  for (const d of due) {
    // nur einmal senden (Primärschlüssel verhindert doppelte Nachrichten)
    const { error } = await admin.from("sent_reminders").insert({ user_id: userId, key: d.key });
    if (error) continue;
    sent += await sendTo(admin, subs, d.payload);
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: cfg } = await admin.rpc("get_push_config");
  if (!cfg?.vapid_private) return new Response("Keine Schlüssel", { status: 500, headers: CORS });
  webpush.setVapidDetails("mailto:zakariaghulami238@gmail.com", cfg.vapid_public, cfg.vapid_private);

  // 1) Zeitplan (pg_cron)
  if (req.headers.get("x-cron-secret")) {
    if (req.headers.get("x-cron-secret") !== cfg.cron_secret) return new Response("Nein", { status: 403, headers: CORS });
    const { data: subs } = await admin.from("push_subscriptions").select("*");
    const byUser = new Map<string, Any[]>();
    for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
    const now = new Date();
    let sent = 0;
    for (const [uid, list] of byUser) {
      try { sent += await processUser(admin, uid, list, now); } catch (e) { console.error("user", uid, e); }
    }
    await admin.from("sent_reminders").delete().lt("sent_at", new Date(Date.now() - 3 * 864e5).toISOString());
    return new Response(JSON.stringify({ users: byUser.size, sent }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // 2) Test-Nachricht für den angemeldeten Nutzer
  const auth = req.headers.get("Authorization") ?? "";
  const { data: u } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) return new Response("Nicht angemeldet", { status: 401, headers: CORS });
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", u.user.id);
  const n = await sendTo(admin, subs ?? [], { title: "✅ Pazulic", body: "Erinnerungen funktionieren! So sieht eine Erinnerung aus.", tag: "test", url: APP_URL });
  return new Response(JSON.stringify({ devices: subs?.length ?? 0, sent: n }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
