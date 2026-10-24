// Sicherung: alle eigenen Daten als Datei herunterladen und wieder einspielen.
import { supabase } from "./supabase";

const TABLES: { name: string; conflict: string }[] = [
  { name: "custom_kinds", conflict: "id" },
  { name: "exams", conflict: "id" },
  { name: "plan_blocks", conflict: "id" },
  { name: "study_sessions", conflict: "id" },
  { name: "long_goals", conflict: "id" },
  { name: "subjects", conflict: "user_id,school_year,key" },
  { name: "grades", conflict: "id" },
  { name: "report_grades", conflict: "user_id,school_year,subject" },
  { name: "google_marks", conflict: "user_id,uid,date" },
];

export async function downloadBackup(): Promise<{ ok: boolean; count: number }> {
  const data: Record<string, unknown[]> = {};
  let count = 0;
  for (const t of TABLES) {
    const { data: rows, error } = await supabase.from(t.name).select("*");
    if (error) return { ok: false, count: 0 };
    data[t.name] = (rows ?? []).map(({ user_id: _u, ...r }) => r);
    count += rows?.length ?? 0;
  }
  const file = { app: "Pazulic", version: 1, created: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(file, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `pazulic-sicherung-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { ok: true, count };
}

export async function restoreBackup(file: File): Promise<{ ok: boolean; count: number; msg?: string }> {
  let json: { app?: string; data?: Record<string, Record<string, unknown>[]> };
  try { json = JSON.parse(await file.text()); } catch { return { ok: false, count: 0, msg: "Die Datei ist keine Pazulic-Sicherung." }; }
  if (json.app !== "Pazulic" || !json.data) return { ok: false, count: 0, msg: "Die Datei ist keine Pazulic-Sicherung." };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false, count: 0, msg: "Bitte zuerst anmelden." };
  let count = 0;
  for (const t of TABLES) {
    const rows = (json.data[t.name] ?? []).map((r) => {
      const { user_id: _u, created_at: _c, ...rest } = r;
      const row: Record<string, unknown> = { ...rest, user_id: u.user!.id };
      // Bei Tabellen mit eigenem Schlüssel die id weglassen (sonst Konflikt mit vorhandenen Zeilen)
      if (t.conflict !== "id") delete row.id;
      return row;
    });
    if (!rows.length) continue;
    const { error } = await supabase.from(t.name).upsert(rows, { onConflict: t.conflict });
    if (error) return { ok: false, count, msg: `Fehler bei „${t.name}“. Ein Teil wurde schon eingespielt.` };
    count += rows.length;
  }
  return { ok: true, count };
}
