// Alle Daten-Zugriffe an EINER Stelle. Später kann hier der Speicher getauscht werden
// (z. B. „Daten nur auf dem Gerät“ oder verschlüsselt), ohne die Seiten zu ändern.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session as AuthSession } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { ActivityLog, Block, CustomKind, Exam, Goal, GoogleMark, GoogleRule, Grade, ReportGrade, Session, Settings, SubjectRow, TimerState } from "./types";
import { isRepeating } from "./plan";
import { releasePush, syncPush } from "./push";
import { clearCache, flushQueue, isNetErr, loadCache, pendingCount, runOrQueue, saveCache } from "./offline";

interface Store {
  /** Kein Internet: es wird der letzte Stand gezeigt */
  offline: boolean;
  /** Änderungen, die noch gespeichert werden müssen */
  pending: number;
  auth: AuthSession | null;
  authReady: boolean;
  ready: boolean;
  exams: Exam[];
  blocks: Block[];
  trash: Block[];
  sessions: Session[];
  goals: Goal[];
  grades: Grade[];
  reportGrades: ReportGrade[];
  subjects: SubjectRow[];
  customKinds: CustomKind[];
  googleMarks: GoogleMark[];
  googleRules: GoogleRule[];
  activityLogs: ActivityLog[];
  settings: Settings;
  timer: TimerState | null;
  error: string | null;
  clearError: () => void;
  saveExam: (e: Partial<Exam> & { subject: string; date: string }) => Promise<boolean>;
  deleteExam: (id: string) => Promise<boolean>;
  saveGoal: (g: { id?: string; title: string; date: string | null }) => Promise<boolean>;
  deleteGoal: (id: string) => Promise<boolean>;
  saveBlock: (b: Partial<Block> & Pick<Block, "date" | "start_time" | "end_time" | "kind">) => Promise<boolean>;
  deleteBlock: (id: string) => Promise<boolean>;
  restoreBlock: (id: string) => Promise<boolean>;
  purgeBlock: (id: string) => Promise<boolean>;
  unskipOccurrence: (b: Block, date: string) => Promise<boolean>;
  saveDayNote: (b: Block, date: string, text: string) => Promise<boolean>;
  addBlocks: (rows: (Partial<Block> & Pick<Block, "date" | "start_time" | "end_time" | "kind">)[]) => Promise<boolean>;
  skipOccurrence: (b: Block, date: string) => Promise<boolean>;
  skipMany: (items: { b: Block; dates: string[] }[]) => Promise<boolean>;
  /** Nur einen Tag einer Serie ändern: Tag aus der Serie nehmen und als eigenen Eintrag speichern. */
  detachOccurrence: (b: Block, date: string, x: Partial<Block> & Pick<Block, "date" | "start_time" | "end_time" | "kind">) => Promise<boolean>;
  saveCustomKind: (k: { id?: string; name: string; color: string; remind_minutes?: number | null }) => Promise<CustomKind | null>;
  deleteCustomKind: (id: string) => Promise<boolean>;
  saveGoogleMark: (m: Partial<GoogleMark> & { uid: string; date: string }) => Promise<boolean>;
  saveGoogleRule: (r: { match: string; kind: GoogleRule["kind"]; custom_kind_id: string | null }) => Promise<boolean>;
  deleteGoogleRule: (id: string) => Promise<boolean>;
  toggleDone: (b: Block, date: string) => Promise<void>;
  addSession: (s: Omit<Session, "id" | "user_id" | "created_at">) => Promise<boolean>;
  /** Gelernte Zeit ohne Plan-Eintrag (z. B. Langfristig) als erledigten Lern-Eintrag in den Plan schreiben. Gibt die id zurück. */
  addLearnBlock: (x: { date: string; start: string; end: string; title: string; minutes: number }) => Promise<string | null>;
  deleteSession: (id: string) => Promise<boolean>;
  addActivityLog: (l: Omit<ActivityLog, "id" | "user_id" | "created_at">) => Promise<boolean>;
  deleteActivityLog: (id: string) => Promise<boolean>;
  setTimer: (t: TimerState | null) => Promise<void>;
  saveGrade: (g: Omit<Grade, "id" | "user_id" | "created_at"> & { id?: string }) => Promise<boolean>;
  deleteGrade: (id: string) => Promise<boolean>;
  saveReportGrade: (r: { school_year: string; subject: string; grade: number | null }) => Promise<boolean>;
  saveSettings: (s: Partial<Settings>) => Promise<boolean>;
  saveSubjects: (rows: (Omit<SubjectRow, "id" | "user_id"> & { id?: string })[]) => Promise<boolean>;
  deleteSubject: (id: string) => Promise<boolean>;
  reloadAll: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store fehlt");
  return s;
};

const FAIL = "Speichern hat nicht geklappt. Prüfe deine Internetverbindung und versuche es nochmal.";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [allBlocks, setBlocks] = useState<Block[]>([]);
  const [allSessions, setSessions] = useState<Session[]>([]);
  const blocks = useMemo(() => allBlocks.filter((b) => !b.deleted_at), [allBlocks]);
  const trashIds = useMemo(() => new Set(allBlocks.filter((b) => b.deleted_at).map((b) => b.id)), [allBlocks]);
  // Lernzeiten von gelöschten Einträgen zählen nicht mit
  const sessions = useMemo(() => allSessions.filter((x) => !x.block_id || !trashIds.has(x.block_id)), [allSessions, trashIds]);
  const trash = useMemo(() => allBlocks.filter((b) => b.deleted_at).sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? "")), [allBlocks]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [reportGrades, setReportGrades] = useState<ReportGrade[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [customKinds, setCustomKinds] = useState<CustomKind[]>([]);
  const [googleMarks, setGoogleMarks] = useState<GoogleMark[]>([]);
  const [googleRules, setGoogleRules] = useState<GoogleRule[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettingsState] = useState<Settings>({ google_ical_url: null, google_enabled: false });
  const [timer, setTimerState] = useState<TimerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [pending, setPending] = useState(0);
  const uid = auth?.user.id;
  const loading = useRef(false);
  const timerTouched = useRef(0); // Zeitpunkt der letzten lokalen Timer-Änderung

  useEffect(() => {
    // Ohne Internet kann die Anmeldung nicht erneuert werden – dann den gespeicherten Stand nehmen (nur zum Anzeigen)
    const stored = (): AuthSession | null => {
      try { const k = Object.keys(localStorage).find((x) => x.startsWith("sb-") && x.endsWith("-auth-token")); return k ? (JSON.parse(localStorage.getItem(k)!) as AuthSession) : null; } catch { return null; }
    };
    if (!navigator.onLine) { const s0 = stored(); if (s0) { setAuth(s0); setAuthReady(true); } }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session || navigator.onLine) setAuth(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") { sessionStorage.setItem("pw-recovery", "1"); window.dispatchEvent(new Event("pw-recovery")); }
      if (!s && !navigator.onLine && e !== "SIGNED_OUT") return; // offline: angemeldet bleiben
      setAuth(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadAll = useCallback(async () => {
    if (!uid || loading.current) return;
    loading.current = true;
    // Erst gemerkte Offline-Änderungen speichern, dann neu laden
    if (pendingCount(uid) && navigator.onLine) await flushQueue(uid);
    setPending(pendingCount(uid));
    const [e, b, s, t, g, gr, rg, st, sj, ck, gm, grl, al] = await Promise.all([
      supabase.from("exams").select("*").order("date"),
      supabase.from("plan_blocks").select("*"),
      supabase.from("study_sessions").select("*"),
      supabase.from("timer_state").select("*").maybeSingle(),
      supabase.from("long_goals").select("*").order("date"),
      supabase.from("grades").select("*"),
      supabase.from("report_grades").select("*"),
      supabase.from("user_settings").select("google_ical_url, google_enabled, remind_defaults, timezone, vacations, vacation_choices, morning_time, weekly_review, templates, driving").maybeSingle(),
      supabase.from("subjects").select("*").order("sort"),
      supabase.from("custom_kinds").select("*").order("created_at"),
      supabase.from("google_marks").select("*"),
      supabase.from("google_rules").select("*"),
      supabase.from("activity_logs").select("*"),
    ]);
    loading.current = false;
    const firstErr = [e, b, s, g, gr, rg, sj, ck, gm, grl, al].find((x) => x.error)?.error;
    if (firstErr) {
      if (isNetErr(firstErr)) { setOffline(true); if (loadCache(uid)) setReady(true); else setError("Keine Internetverbindung. Bitte verbinde dich einmal, damit Pazulic deine Daten laden kann."); return; }
      setError("Daten konnten nicht geladen werden. Bitte später nochmal öffnen."); return;
    }
    setOffline(false);
    saveCache(uid, { exams: e.data, blocks: b.data, sessions: s.data, timer: t.data, goals: g.data, grades: gr.data, reportGrades: rg.data, settings: st.data, subjects: sj.data, customKinds: ck.data, googleMarks: gm.data, googleRules: grl.data, activityLogs: al.data });
    const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
    const old = (b.data as Block[]).filter((x) => x.deleted_at && x.deleted_at < cutoff).map((x) => x.id);
    if (old.length) supabase.from("plan_blocks").delete().in("id", old).then(() => {});
    setExams(e.data as Exam[]); setBlocks((b.data as Block[]).filter((x) => !old.includes(x.id))); setSessions(s.data as Session[]); setGoals(g.data as Goal[]);
    setGrades((gr.data as Grade[]).map((x) => ({ ...x, points: x.points == null ? null : Number(x.points), max_points: x.max_points == null ? null : Number(x.max_points) })));
    setReportGrades(rg.data as ReportGrade[]);
    setCustomKinds(ck.data as CustomKind[]); setGoogleMarks(gm.data as GoogleMark[]); setGoogleRules(grl.data as GoogleRule[]); setActivityLogs(al.data as ActivityLog[]);
    setSubjects((sj.data as SubjectRow[]).map((x) => ({ ...x, hours: Number(x.hours) })));
    if (st.data) setSettingsState(st.data as Settings);
    // Direkt nach Start/Pause/Weiter nicht mit evtl. älterem Server-Stand überschreiben (verhindert Springen)
    if (Date.now() - timerTouched.current > 4000) setTimerState((t.data as TimerState) ?? null);
    setReady(true);
  }, [uid]);

  // Einmal laden, danach live über Realtime (Handy und Laptop bleiben synchron).
  useEffect(() => {
    if (!uid) { setReady(false); setExams([]); setBlocks([]); setSessions([]); setGoals([]); setGrades([]); setReportGrades([]); setSubjects([]); setCustomKinds([]); setGoogleMarks([]); setGoogleRules([]); setActivityLogs([]); setTimerState(null); return; }
    // Sofort den letzten Stand zeigen (schneller Start, und offline nutzbar)
    type C = { exams: Exam[]; blocks: Block[]; sessions: Session[]; timer: TimerState | null; goals: Goal[]; grades: Grade[]; reportGrades: ReportGrade[]; settings: Settings | null; subjects: SubjectRow[]; customKinds: CustomKind[]; googleMarks: GoogleMark[]; googleRules: GoogleRule[]; activityLogs: ActivityLog[] };
    const c = loadCache<C>(uid)?.data;
    if (c) {
      setExams(c.exams ?? []); setBlocks(c.blocks ?? []); setSessions(c.sessions ?? []); setGoals(c.goals ?? []);
      setGrades((c.grades ?? []).map((x) => ({ ...x, points: x.points == null ? null : Number(x.points), max_points: x.max_points == null ? null : Number(x.max_points) })));
      setReportGrades(c.reportGrades ?? []); setCustomKinds(c.customKinds ?? []); setGoogleMarks(c.googleMarks ?? []); setGoogleRules(c.googleRules ?? []); setActivityLogs(c.activityLogs ?? []);
      setSubjects((c.subjects ?? []).map((x) => ({ ...x, hours: Number(x.hours) })));
      if (c.settings) setSettingsState(c.settings);
      setTimerState(c.timer ?? null);
      setReady(true);
    }
    setPending(pendingCount(uid));
    loadAll();
    const goOnline = () => { setOffline(false); loadAll(); };
    const goOffline = () => setOffline(true);
    const onQueue = () => setPending(pendingCount(uid));
    window.addEventListener("online", goOnline); window.addEventListener("offline", goOffline); window.addEventListener("pazulic-queue", onQueue);
    let t: number | undefined;
    const reload = () => { window.clearTimeout(t); t = window.setTimeout(loadAll, 300); };
    const ch = supabase.channel("pazulic-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "exams", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_blocks", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "long_goals", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "grades", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "report_grades", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_kinds", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "google_rules", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "google_marks", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "subjects", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_settings", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "timer_state", filter: `user_id=eq.${uid}` }, reload)
      .subscribe();
    const onVis = () => { if (document.visibilityState === "visible") loadAll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { supabase.removeChannel(ch); document.removeEventListener("visibilitychange", onVis); window.clearTimeout(t); window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); window.removeEventListener("pazulic-queue", onQueue); };
  }, [uid, loadAll]);

  const saveExam: Store["saveExam"] = async (x) => {
    const row = { subject: x.subject, short_name: x.short_name ?? null, date: x.date, time: x.time ?? "08:00", topics: x.topics ?? [] };
    const res = x.id ? await supabase.from("exams").update(row).eq("id", x.id).select().single()
      : await supabase.from("exams").insert(row).select().single();
    if (res.error) { setError(FAIL); return false; }
    const saved = res.data as Exam;
    setExams((p) => [...p.filter((e) => e.id !== saved.id), saved].sort((a, b) => a.date.localeCompare(b.date)));
    return true;
  };

  const deleteExam: Store["deleteExam"] = async (id) => {
    const { error: err } = await supabase.from("exams").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setExams((p) => p.filter((e) => e.id !== id));
    return true;
  };

  const saveGoal: Store["saveGoal"] = async (x) => {
    const row = { title: x.title, date: x.date || null };
    const res = x.id ? await supabase.from("long_goals").update(row).eq("id", x.id).select().single()
      : await supabase.from("long_goals").insert(row).select().single();
    if (res.error) { setError(FAIL); return false; }
    const saved = res.data as Goal;
    setGoals((p) => [...p.filter((g) => g.id !== saved.id), saved]);
    return true;
  };

  const deleteGoal: Store["deleteGoal"] = async (id) => {
    const { error: err } = await supabase.from("long_goals").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setGoals((p) => p.filter((g) => g.id !== id));
    return true;
  };

  const saveBlock: Store["saveBlock"] = async (x) => {
    const row = {
      exam_id: x.exam_id ?? null, date: x.date, start_time: x.start_time, end_time: x.end_time, kind: x.kind,
      title: x.title ?? "", topic_ids: x.topic_ids ?? [], planned_minutes: x.planned_minutes ?? 0,
      repeat_weekdays: x.repeat_rule ? null : x.repeat_weekdays && x.repeat_weekdays.length ? x.repeat_weekdays : null,
      repeat_rule: x.repeat_rule ?? null, custom_kind_id: x.custom_kind_id ?? null, remind_minutes: x.remind_minutes ?? null,
      school: !!x.school,
    };
    const res = x.id ? await supabase.from("plan_blocks").update(row).eq("id", x.id).select().single()
      : await supabase.from("plan_blocks").insert(row).select().single();
    if (res.error) { setError(FAIL); return false; }
    const saved = res.data as Block;
    setBlocks((p) => [...p.filter((b) => b.id !== saved.id), saved]);
    return true;
  };

  const addBlocks: Store["addBlocks"] = async (rows) => {
    const res = await supabase.from("plan_blocks").insert(rows).select();
    if (res.error) { setError(FAIL); return false; }
    setBlocks((p) => [...p, ...(res.data as Block[])]);
    return true;
  };

  const skipOccurrence: Store["skipOccurrence"] = async (b, date) => {
    const skip_dates = [...new Set([...(b.skip_dates ?? []), date])];
    setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, skip_dates } : x)));
    if (!(await runOrQueue(uid!, { t: "update", table: "plan_blocks", id: b.id, row: { skip_dates } }))) { setError(FAIL); setBlocks((p) => p.map((x) => (x.id === b.id ? b : x))); return false; }
    return true;
  };

  const skipMany: Store["skipMany"] = async (items) => {
    let ok = true;
    for (const { b, dates } of items) {
      if (!dates.length) continue;
      const skip_dates = [...new Set([...(b.skip_dates ?? []), ...dates])];
      const { error: err } = await supabase.from("plan_blocks").update({ skip_dates }).eq("id", b.id);
      if (err) { ok = false; continue; }
      setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, skip_dates } : x)));
    }
    if (!ok) setError(FAIL);
    return ok;
  };

  const detachOccurrence: Store["detachOccurrence"] = async (b, date, x) => {
    const note = b.day_notes?.[date];
    const row = {
      exam_id: x.exam_id ?? null, date: x.date, start_time: x.start_time, end_time: x.end_time, kind: x.kind,
      title: x.title ?? "", topic_ids: x.topic_ids ?? [], planned_minutes: x.planned_minutes ?? 0,
      repeat_weekdays: null, repeat_rule: null, custom_kind_id: x.custom_kind_id ?? null, remind_minutes: x.remind_minutes ?? null,
      done: x.date === date && b.completed_dates.includes(date), completed_dates: [], detached_from: `${b.id}|${date}`, ...(note && x.date === date ? { day_notes: { [date]: note } } : {}),
    };
    const res = await supabase.from("plan_blocks").insert(row).select().single();
    if (res.error) { setError(FAIL); return false; }
    const nb = res.data as Block;
    const skip_dates = [...new Set([...(b.skip_dates ?? []), date])];
    const day_notes = { ...(b.day_notes ?? {}) }; delete day_notes[date];
    const up = await supabase.from("plan_blocks").update({ skip_dates, day_notes }).eq("id", b.id);
    if (up.error) { await supabase.from("plan_blocks").delete().eq("id", nb.id); setError(FAIL); return false; }
    // gemessene Zeiten dieses Tages mitnehmen
    await supabase.from("study_sessions").update({ block_id: nb.id, date: x.date }).eq("block_id", b.id).eq("date", date);
    await supabase.from("activity_logs").update({ block_id: nb.id, date: x.date }).eq("block_id", b.id).eq("date", date);
    setBlocks((p) => [...p.map((y) => (y.id === b.id ? { ...y, skip_dates, day_notes } : y)), nb]);
    loadAll();
    return true;
  };

  const saveCustomKind: Store["saveCustomKind"] = async (k) => {
    const row = { name: k.name.trim().slice(0, 40), color: k.color, ...(k.remind_minutes !== undefined ? { remind_minutes: k.remind_minutes } : {}) };
    const res = k.id ? await supabase.from("custom_kinds").update(row).eq("id", k.id).select().single()
      : await supabase.from("custom_kinds").insert(row).select().single();
    if (res.error) { setError(FAIL); return null; }
    const saved = res.data as CustomKind;
    setCustomKinds((p) => [...p.filter((x) => x.id !== saved.id), saved]);
    return saved;
  };

  const deleteCustomKind: Store["deleteCustomKind"] = async (id) => {
    const { error: err } = await supabase.from("custom_kinds").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setCustomKinds((p) => p.filter((x) => x.id !== id));
    setBlocks((p) => p.map((b) => (b.custom_kind_id === id ? { ...b, custom_kind_id: null } : b)));
    return true;
  };

  const saveGoogleMark: Store["saveGoogleMark"] = async (m) => {
    const old = googleMarks.find((x) => x.uid === m.uid && x.date === m.date);
    const merged = { done: false, hidden: false, minutes: null, kind: null, custom_kind_id: null, ...old, ...m };
    const { id: _id, user_id: _u, ...row } = merged as GoogleMark;
    setGoogleMarks((p) => [...p.filter((x) => !(x.uid === m.uid && x.date === m.date)), { id: old?.id ?? "tmp", ...row } as GoogleMark]);
    const res = await supabase.from("google_marks").upsert({ ...row, user_id: uid, updated_at: new Date().toISOString() }, { onConflict: "user_id,uid,date" }).select().single();
    if (res.error) { setError(FAIL); setGoogleMarks((p) => [...p.filter((x) => !(x.uid === m.uid && x.date === m.date)), ...(old ? [old] : [])]); return false; }
    setGoogleMarks((p) => [...p.filter((x) => !(x.uid === m.uid && x.date === m.date)), res.data as GoogleMark]);
    return true;
  };

  const saveGoogleRule: Store["saveGoogleRule"] = async (r) => {
    const row = { match: r.match.trim().toLowerCase().slice(0, 200), kind: r.kind, custom_kind_id: r.custom_kind_id, user_id: uid };
    const res = await supabase.from("google_rules").upsert(row, { onConflict: "user_id,match" }).select().single();
    if (res.error) { setError(FAIL); return false; }
    const saved = res.data as GoogleRule;
    setGoogleRules((p) => [...p.filter((x) => x.match !== saved.match), saved]);
    return true;
  };

  const deleteGoogleRule: Store["deleteGoogleRule"] = async (id) => {
    const { error: err } = await supabase.from("google_rules").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setGoogleRules((p) => p.filter((x) => x.id !== id));
    return true;
  };

  const deleteBlock: Store["deleteBlock"] = async (id) => {
    // In den Papierkorb (kann 30 Tage lang wiederhergestellt werden)
    const deleted_at = new Date().toISOString();
    const { error: err } = await supabase.from("plan_blocks").update({ deleted_at }).eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setBlocks((p) => p.map((b) => (b.id === id ? { ...b, deleted_at } : b)));
    return true;
  };

  const restoreBlock: Store["restoreBlock"] = async (id) => {
    const { error: err } = await supabase.from("plan_blocks").update({ deleted_at: null }).eq("id", id);
    if (err) { setError(FAIL); return false; }
    setBlocks((p) => p.map((b) => (b.id === id ? { ...b, deleted_at: null } : b)));
    return true;
  };

  const purgeBlock: Store["purgeBlock"] = async (id) => {
    const { error: err } = await supabase.from("plan_blocks").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setBlocks((p) => p.filter((b) => b.id !== id));
    setSessions((p) => p.filter((x) => x.block_id !== id));
    return true;
  };

  const saveDayNote: Store["saveDayNote"] = async (b, date, text) => {
    const day_notes = { ...(b.day_notes ?? {}) };
    if (text.trim()) day_notes[date] = text.trim().slice(0, 4000); else delete day_notes[date];
    if (!(await runOrQueue(uid!, { t: "update", table: "plan_blocks", id: b.id, row: { day_notes } }))) { setError(FAIL); return false; }
    setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, day_notes } : x)));
    return true;
  };

  const unskipOccurrence: Store["unskipOccurrence"] = async (b, date) => {
    const skip_dates = (b.skip_dates ?? []).filter((d) => d !== date);
    const { error: err } = await supabase.from("plan_blocks").update({ skip_dates }).eq("id", b.id);
    if (err) { setError(FAIL); return false; }
    setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, skip_dates } : x)));
    return true;
  };

  const toggleDone: Store["toggleDone"] = async (b, date) => {
    let patch: Partial<Block>;
    if (isRepeating(b)) {
      const has = b.completed_dates.includes(date);
      patch = { completed_dates: has ? b.completed_dates.filter((d) => d !== date) : [...b.completed_dates, date] };
    } else patch = { done: !b.done };
    setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, ...patch } : x))); // sofort anzeigen
    if (!(await runOrQueue(uid!, { t: "update", table: "plan_blocks", id: b.id, row: patch as Record<string, unknown> }))) { setError(FAIL); setBlocks((p) => p.map((x) => (x.id === b.id ? b : x))); }
  };

  const addLearnBlock: Store["addLearnBlock"] = async (x) => {
    const row = {
      id: crypto.randomUUID(), date: x.date, start_time: x.start, end_time: x.end, kind: "lernen", title: x.title.slice(0, 80) || "Lernen",
      exam_id: null, topic_ids: [], planned_minutes: x.minutes, done: true, completed_dates: [], repeat_weekdays: null, repeat_rule: null,
    };
    if (!(await runOrQueue(uid!, { t: "insert", table: "plan_blocks", row }))) { setError(FAIL); return null; }
    setBlocks((p) => [...p, { ...row, user_id: uid!, custom_kind_id: null, skip_dates: [], remind_minutes: null, deleted_at: null, day_notes: {} } as unknown as Block]);
    return row.id;
  };

  const addSession: Store["addSession"] = async (s) => {
    const row = { ...s, id: crypto.randomUUID() };
    if (!(await runOrQueue(uid!, { t: "insert", table: "study_sessions", row }))) { setError(FAIL); return false; }
    setSessions((p) => [...p, { ...row, user_id: uid!, created_at: new Date().toISOString() } as Session]);
    return true;
  };

  const deleteSession: Store["deleteSession"] = async (id) => {
    const { error: err } = await supabase.from("study_sessions").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setSessions((p) => p.filter((s) => s.id !== id));
    return true;
  };

  const addActivityLog: Store["addActivityLog"] = async (l) => {
    const row = { ...l, id: crypto.randomUUID() };
    if (!(await runOrQueue(uid!, { t: "insert", table: "activity_logs", row }))) { setError(FAIL); return false; }
    setActivityLogs((p) => [...p, { ...row, user_id: uid!, created_at: new Date().toISOString() } as ActivityLog]);
    return true;
  };

  const deleteActivityLog: Store["deleteActivityLog"] = async (id) => {
    const { error: err } = await supabase.from("activity_logs").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setActivityLogs((p) => p.filter((x) => x.id !== id));
    return true;
  };

  const setTimer: Store["setTimer"] = async (t) => {
    timerTouched.current = Date.now();
    setTimerState(t);
    if (!t) { await runOrQueue(uid!, { t: "delete", table: "timer_state", col: "user_id", val: uid! }); return; }
    if (!(await runOrQueue(uid!, { t: "upsert", table: "timer_state", row: { ...t, user_id: uid, updated_at: new Date().toISOString() } }))) setError(FAIL);
  };

  const saveGrade: Store["saveGrade"] = async (x) => {
    const { id, ...row } = x;
    const res = id ? await supabase.from("grades").update(row).eq("id", id).select().single()
      : await supabase.from("grades").insert(row).select().single();
    if (res.error) { setError(FAIL); return false; }
    const g = res.data as Grade;
    const saved = { ...g, points: g.points == null ? null : Number(g.points), max_points: g.max_points == null ? null : Number(g.max_points) };
    setGrades((p) => [...p.filter((y) => y.id !== saved.id), saved]);
    return true;
  };

  const deleteGrade: Store["deleteGrade"] = async (id) => {
    const { error: err } = await supabase.from("grades").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setGrades((p) => p.filter((g) => g.id !== id));
    return true;
  };

  const saveReportGrade: Store["saveReportGrade"] = async (r) => {
    const res = await supabase.from("report_grades").upsert({ ...r, user_id: uid }, { onConflict: "user_id,school_year,subject" }).select().single();
    if (res.error) { setError(FAIL); return false; }
    const saved = res.data as ReportGrade;
    setReportGrades((p) => [...p.filter((y) => !(y.school_year === saved.school_year && y.subject === saved.subject)), saved]);
    return true;
  };

  const saveSettings: Store["saveSettings"] = async (x) => {
    const { error: err } = await supabase.from("user_settings").upsert({ ...x, user_id: uid, updated_at: new Date().toISOString() });
    if (err) { setError(FAIL); return false; }
    setSettingsState((p) => ({ ...p, ...x }));
    return true;
  };

  const saveSubjects: Store["saveSubjects"] = async (rows) => {
    if (!rows.length) return true;
    const res = await supabase.from("subjects").upsert(rows.map((r) => ({ ...r, user_id: uid })), { onConflict: "user_id,school_year,key" }).select();
    if (res.error) { setError(FAIL); return false; }
    const saved = (res.data as SubjectRow[]).map((x) => ({ ...x, hours: Number(x.hours) }));
    setSubjects((p) => [...p.filter((x) => !saved.some((y) => y.id === x.id)), ...saved].sort((a, b) => a.sort - b.sort));
    return true;
  };

  const deleteSubject: Store["deleteSubject"] = async (id) => {
    const { error: err } = await supabase.from("subjects").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setSubjects((p) => p.filter((x) => x.id !== id));
    return true;
  };

  // Abmelden: immer lokal abmelden, auch wenn das Internet schlecht ist oder der Server nicht antwortet.
  const uidNow = auth?.user.id;
  useEffect(() => { if (uidNow) syncPush(); }, [uidNow]);

  const signOut = async () => {
    if (uid && pendingCount(uid) && !window.confirm("Du hast noch Änderungen, die ohne Internet gemacht wurden und noch nicht gespeichert sind. Trotzdem abmelden? Dann gehen sie verloren.")) return;
    await Promise.race([releasePush(), new Promise((r) => setTimeout(r, 2000))]);
    if (uid) clearCache(uid);
    try {
      await Promise.race([supabase.auth.signOut({ scope: "local" }), new Promise((r) => setTimeout(r, 3000))]);
    } catch { /* egal – wir räumen unten trotzdem auf */ }
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k);
      sessionStorage.removeItem("pw-recovery");
    } catch { /* egal */ }
    setAuth(null);
    window.location.replace(window.location.pathname + "#/");
  };

  const value = useMemo<Store>(() => ({
    offline, pending, auth, authReady, ready, exams, blocks, trash, sessions, goals, grades, reportGrades, subjects, customKinds, googleMarks, googleRules, activityLogs, settings, timer, error, clearError: () => setError(null),
    saveExam, deleteExam, saveGoal, deleteGoal, saveBlock, deleteBlock, restoreBlock, purgeBlock, unskipOccurrence, saveDayNote, addBlocks, skipOccurrence, skipMany, detachOccurrence, saveCustomKind, deleteCustomKind, saveGoogleMark, saveGoogleRule, deleteGoogleRule, toggleDone, addSession, addLearnBlock, deleteSession, addActivityLog, deleteActivityLog, setTimer, saveGrade, deleteGrade, saveReportGrade, saveSettings, saveSubjects, deleteSubject, reloadAll: loadAll, signOut,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [offline, pending, auth, authReady, ready, exams, blocks, trash, sessions, goals, grades, reportGrades, subjects, customKinds, googleMarks, googleRules, activityLogs, settings, timer, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
