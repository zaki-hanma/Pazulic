// Offline-Modus: letzter Stand bleibt auf dem Gerät, Änderungen ohne Internet werden gemerkt und später gespeichert.
import { supabase } from "./supabase";

type Row = Record<string, unknown>;
export type Op =
  | { t: "update"; table: string; id: string; row: Row }
  | { t: "insert"; table: string; row: Row }
  | { t: "upsert"; table: string; row: Row }
  | { t: "delete"; table: string; col: string; val: string };

const qKey = (uid: string) => `pazulic-queue-${uid}`;
const cKey = (uid: string) => `pazulic-cache-${uid}`;

export const isNetErr = (e: { message?: string } | null | undefined) =>
  !!e && (typeof navigator !== "undefined" && !navigator.onLine || /fetch|network|load failed|timeout/i.test(e.message ?? ""));

function readQ(uid: string): Op[] { try { return JSON.parse(localStorage.getItem(qKey(uid)) || "[]"); } catch { return []; } }
function writeQ(uid: string, q: Op[]) { try { localStorage.setItem(qKey(uid), JSON.stringify(q)); } catch { /* voll */ } window.dispatchEvent(new Event("pazulic-queue")); }
export const pendingCount = (uid: string | undefined) => (uid ? readQ(uid).length : 0);

async function exec(op: Op) {
  const t = supabase.from(op.table);
  if (op.t === "update") return t.update(op.row).eq("id", op.id);
  if (op.t === "insert") return t.insert(op.row);
  if (op.t === "upsert") return t.upsert(op.row);
  return t.delete().eq(op.col, op.val);
}

/** Ausführen – oder ohne Internet merken. true = gespeichert oder gemerkt. */
export async function runOrQueue(uid: string, op: Op): Promise<boolean> {
  if (!navigator.onLine) { writeQ(uid, [...readQ(uid), op]); return true; }
  const { error } = await exec(op);
  if (!error) return true;
  if (isNetErr(error)) { writeQ(uid, [...readQ(uid), op]); return true; }
  return false;
}

/** Gemerkte Änderungen der Reihe nach speichern. */
export async function flushQueue(uid: string): Promise<number> {
  let q = readQ(uid), done = 0;
  while (q.length && navigator.onLine) {
    const { error } = await exec(q[0]);
    if (error && isNetErr(error)) break; // noch kein Netz
    // anderer Fehler (z. B. Eintrag inzwischen gelöscht): überspringen, sonst hängt alles
    q = q.slice(1); done++;
    writeQ(uid, q);
  }
  return done;
}

// ---------- Letzter Stand der Daten ----------
export function saveCache(uid: string, data: unknown) { try { localStorage.setItem(cKey(uid), JSON.stringify({ at: Date.now(), data })); } catch { /* voll */ } }
export function loadCache<T>(uid: string): { at: number; data: T } | null { try { const s = localStorage.getItem(cKey(uid)); return s ? JSON.parse(s) : null; } catch { return null; } }
export function clearCache(uid: string) { try { localStorage.removeItem(cKey(uid)); localStorage.removeItem(qKey(uid)); localStorage.removeItem("pazulic-google-" + uid); } catch { /* egal */ } }
