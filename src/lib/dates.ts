// Datum-Hilfen. Alle Daten als "YYYY-MM-DD" (lokale Zeit), Uhrzeiten als "HH:MM".

export const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const WD_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
export const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const pad = (n: number) => String(n).padStart(2, "0");

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function at(date: string, time: string): Date {
  const d = parseYmd(date);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  d.setHours(h || 0, mi || 0, 0, 0);
  return d;
}

export function addDays(date: string, n: number): string {
  const d = parseYmd(date);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export const today = () => ymd(new Date());
export const hhmm = (t: string) => (t || "").slice(0, 5);

/** Wochentag 1=Mo … 7=So */
export function isoWeekday(date: string): number {
  const w = parseYmd(date).getDay();
  return w === 0 ? 7 : w;
}

export function longDate(date: string): string {
  const d = parseYmd(date);
  return `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

export function shortDate(date: string): string {
  const d = parseYmd(date);
  return `${WD_SHORT[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

export function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

export function fmtMin(m: number): string {
  m = Math.round(m);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} Std. ${r} Min.` : `${h} Std.`;
}

export function fmtHM(m: number): string {
  m = Math.max(0, Math.round(m));
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
}

export function countdown(target: Date, now = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "vorbei";
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5);
  return d > 0 ? `${d} T ${h} Std.` : `${h} Std. ${Math.floor((ms % 36e5) / 6e4)} Min.`;
}

// ---------- Feiertage Niedersachsen ----------
function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

const holidayCache = new Map<number, Record<string, string>>();
export function holidays(year: number): Record<string, string> {
  if (holidayCache.has(year)) return holidayCache.get(year)!;
  const e = easter(year);
  const rel = (n: number) => { const d = new Date(e); d.setDate(d.getDate() + n); return ymd(d); };
  const r: Record<string, string> = {
    [`${year}-01-01`]: "Neujahr",
    [rel(-2)]: "Karfreitag",
    [rel(1)]: "Ostermontag",
    [`${year}-05-01`]: "Tag der Arbeit",
    [rel(39)]: "Christi Himmelfahrt",
    [rel(50)]: "Pfingstmontag",
    [`${year}-10-03`]: "Tag der Deutschen Einheit",
    [`${year}-10-31`]: "Reformationstag",
    [`${year}-12-25`]: "1. Weihnachtstag",
    [`${year}-12-26`]: "2. Weihnachtstag",
  };
  holidayCache.set(year, r);
  return r;
}

export function holidayName(date: string): string | null {
  return holidays(parseYmd(date).getFullYear())[date] ?? null;
}

// ---------- Schulferien Niedersachsen (Quelle: Kultusministerium Niedersachsen) ----------
// Jedes Jahr ergänzen.
const FERIEN: { name: string; from: string; to: string }[] = [
  { name: "Sommerferien", from: "2026-07-02", to: "2026-08-12" },
  { name: "Herbstferien", from: "2026-10-12", to: "2026-10-24" },
  { name: "Weihnachtsferien", from: "2026-12-23", to: "2027-01-09" },
  { name: "Halbjahresferien", from: "2027-02-01", to: "2027-02-02" },
  { name: "Osterferien", from: "2027-03-22", to: "2027-04-03" },
  { name: "Brückentag", from: "2027-05-07", to: "2027-05-07" },
  { name: "Brückentag", from: "2027-05-18", to: "2027-05-18" },
  { name: "Sommerferien", from: "2027-07-08", to: "2027-08-18" },
];

export function ferienName(date: string): string | null {
  const f = FERIEN.find((x) => date >= x.from && date <= x.to);
  return f ? f.name : null;
}
