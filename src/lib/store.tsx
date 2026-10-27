// Alle Daten-Zugriffe an EINER Stelle. Später kann hier der Speicher getauscht werden
// (z. B. „Daten nur auf dem Gerät“ oder verschlüsselt), ohne die Seiten zu ändern.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session as AuthSession } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { ActivityLog, Block, CustomKind, Exam, Goal, GoogleMark, GoogleRule, Grade, ReportGrade, Session, Settings, SubjectRow, TimerState } from "./types";
import { isRepeating } from "./plan";

interface Store {
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
  saveCustomKind: (k: { id?: string; name: string; color: string; remind_minutes?: number | null }) => Promise<CustomKind | null>;
  deleteCustomKind: (id: string) => Promise<boolean>;
  saveGoogleMark: (m: Partial<GoogleMark> & { uid: string; date: string }) => Promise<boolean>;
  saveGoogleRule: (r: { match: string; kind: GoogleRule["kind"]; custom_kind_id: string | null }) => Promise<boolean>;
  deleteGoogleRule: (id: string) => Promise<boolean>;
  toggleDone: (b: Block, date: string) => Promise<void>;
  addSession: (s: Omit<Session, "id" | "user_id" | "created_at">) => Promise<boolean>;
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
  const uid = auth?.user.id;
  const loading = useRef(false);
  const timerTouched = useRef(0); // Zeitpunkt der letzten lokalen Timer-Änderung

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setAuth(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "PASSWORD_RECOVERY") { sessionStorage.setItem("pw-recovery", "1"); window.dispatchEvent(new Event("pw-recovery")); } setAuth(s); });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadAll = useCallback(async () => {
    if (!uid || loading.current) return;
    loading.current = true;
    const [e, b, s, t, g, gr, rg, st, sj, ck, gm, grl, al] = await Promise.all([
      supabase.from("exams").select("*").order("date"),
      supabase.from("plan_blocks").select("*"),
      supabase.from("study_sessions").select("*"),
      supabase.from("timer_state").select("*").maybeSingle(),
      supabase.from("long_goals").select("*").order("date"),
      supabase.from("grades").select("*"),
      supabase.from("report_grades").select("*"),
      supabase.from("user_settings").select("google_ical_url, google_enabled, remind_defaults, timezone").maybeSingle(),
      supabase.from("subjects").select("*").order("sort"),
      supabase.from("custom_kinds").select("*").order("created_at"),
      supabase.from("google_marks").select("*"),
      supabase.from("google_rules").select("*"),
      supabase.from("activity_logs").select("*"),
    ]);
    loading.current = false;
    if (e.error || b.error || s.error || g.error || gr.error || rg.error || sj.error || ck.error || gm.error || grl.error || al.error) { setError("Daten konnten nicht geladen werden. Bitte später nochmal öffnen."); return; }
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
    loadAll();
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
    return () => { supabase.removeChannel(ch); document.removeEventListener("visibilitychange", onVis); window.clearTimeout(t); };
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
    const { error: err } = await supabase.from("plan_blocks").update({ skip_dates }).eq("id", b.id);
    if (err) { setError(FAIL); setBlocks((p) => p.map((x) => (x.id === b.id ? b : x))); return false; }
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
    const { error: err } = await supabase.from("plan_blocks").update({ day_notes }).eq("id", b.id);
    if (err) { setError(FAIL); return false; }
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
    const { error: err } = await supabase.from("plan_blocks").update(patch).eq("id", b.id);
    if (err) { setError(FAIL); setBlocks((p) => p.map((x) => (x.id === b.id ? b : x))); }
  };

  const addSession: Store["addSession"] = async (s) => {
    const res = await supabase.from("study_sessions").insert(s).select().single();
    if (res.error) { setError(FAIL); return false; }
    setSessions((p) => [...p, res.data as Session]);
    return true;
  };

  const deleteSession: Store["deleteSession"] = async (id) => {
    const { error: err } = await supabase.from("study_sessions").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setSessions((p) => p.filter((s) => s.id !== id));
    return true;
  };

  const addActivityLog: Store["addActivityLog"] = async (l) => {
    const res = await supabase.from("activity_logs").insert(l).select().single();
    if (res.error) { setError(FAIL); return false; }
    setActivityLogs((p) => [...p, res.data as ActivityLog]);
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
    if (!t) { await supabase.from("timer_state").delete().eq("user_id", uid!); return; }
    const { error: err } = await supabase.from("timer_state").upsert({ ...t, user_id: uid, updated_at: new Date().toISOString() });
    if (err) setError(FAIL);
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
  const signOut = async () => {
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
    auth, authReady, ready, exams, blocks, trash, sessions, goals, grades, reportGrades, subjects, customKinds, googleMarks, googleRules, activityLogs, settings, timer, error, clearError: () => setError(null),
    saveExam, deleteExam, saveGoal, deleteGoal, saveBlock, deleteBlock, restoreBlock, purgeBlock, unskipOccurrence, saveDayNote, addBlocks, skipOccurrence, saveCustomKind, deleteCustomKind, saveGoogleMark, saveGoogleRule, deleteGoogleRule, toggleDone, addSession, deleteSession, addActivityLog, deleteActivityLog, setTimer, saveGrade, deleteGrade, saveReportGrade, saveSettings, saveSubjects, deleteSubject, reloadAll: loadAll, signOut,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [auth, authReady, ready, exams, blocks, trash, sessions, goals, grades, reportGrades, subjects, customKinds, googleMarks, googleRules, activityLogs, settings, timer, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
