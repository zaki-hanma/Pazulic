// Alle Daten-Zugriffe an EINER Stelle. Später kann hier der Speicher getauscht werden
// (z. B. „Daten nur auf dem Gerät“ oder verschlüsselt), ohne die Seiten zu ändern.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session as AuthSession } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Block, Exam, Session, TimerState } from "./types";

interface Store {
  auth: AuthSession | null;
  authReady: boolean;
  ready: boolean;
  exams: Exam[];
  blocks: Block[];
  sessions: Session[];
  timer: TimerState | null;
  error: string | null;
  clearError: () => void;
  saveExam: (e: Partial<Exam> & { subject: string; date: string }) => Promise<boolean>;
  deleteExam: (id: string) => Promise<boolean>;
  saveBlock: (b: Partial<Block> & Pick<Block, "date" | "start_time" | "end_time" | "kind">) => Promise<boolean>;
  deleteBlock: (id: string) => Promise<boolean>;
  toggleDone: (b: Block, date: string) => Promise<void>;
  addSession: (s: Omit<Session, "id" | "user_id" | "created_at">) => Promise<boolean>;
  deleteSession: (id: string) => Promise<boolean>;
  setTimer: (t: TimerState | null) => Promise<void>;
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
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [timer, setTimerState] = useState<TimerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uid = auth?.user.id;
  const loading = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setAuth(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setAuth(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadAll = useCallback(async () => {
    if (!uid || loading.current) return;
    loading.current = true;
    const [e, b, s, t] = await Promise.all([
      supabase.from("exams").select("*").order("date"),
      supabase.from("plan_blocks").select("*"),
      supabase.from("study_sessions").select("*"),
      supabase.from("timer_state").select("*").maybeSingle(),
    ]);
    loading.current = false;
    if (e.error || b.error || s.error) { setError("Daten konnten nicht geladen werden. Bitte später nochmal öffnen."); return; }
    setExams(e.data as Exam[]); setBlocks(b.data as Block[]); setSessions(s.data as Session[]);
    setTimerState((t.data as TimerState) ?? null);
    setReady(true);
  }, [uid]);

  // Einmal laden, danach live über Realtime (Handy und Laptop bleiben synchron).
  useEffect(() => {
    if (!uid) { setReady(false); setExams([]); setBlocks([]); setSessions([]); setTimerState(null); return; }
    loadAll();
    let t: number | undefined;
    const reload = () => { window.clearTimeout(t); t = window.setTimeout(loadAll, 300); };
    const ch = supabase.channel("pazulic-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "exams", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_blocks", filter: `user_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions", filter: `user_id=eq.${uid}` }, reload)
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

  const saveBlock: Store["saveBlock"] = async (x) => {
    const row = {
      exam_id: x.exam_id ?? null, date: x.date, start_time: x.start_time, end_time: x.end_time, kind: x.kind,
      title: x.title ?? "", topic_ids: x.topic_ids ?? [], planned_minutes: x.planned_minutes ?? 0,
      repeat_weekdays: x.repeat_weekdays && x.repeat_weekdays.length ? x.repeat_weekdays : null,
    };
    const res = x.id ? await supabase.from("plan_blocks").update(row).eq("id", x.id).select().single()
      : await supabase.from("plan_blocks").insert(row).select().single();
    if (res.error) { setError(FAIL); return false; }
    const saved = res.data as Block;
    setBlocks((p) => [...p.filter((b) => b.id !== saved.id), saved]);
    return true;
  };

  const deleteBlock: Store["deleteBlock"] = async (id) => {
    const { error: err } = await supabase.from("plan_blocks").delete().eq("id", id);
    if (err) { setError("Löschen hat nicht geklappt."); return false; }
    setBlocks((p) => p.filter((b) => b.id !== id));
    return true;
  };

  const toggleDone: Store["toggleDone"] = async (b, date) => {
    let patch: Partial<Block>;
    if (b.repeat_weekdays && b.repeat_weekdays.length) {
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

  const setTimer: Store["setTimer"] = async (t) => {
    setTimerState(t);
    if (!t) { await supabase.from("timer_state").delete().eq("user_id", uid!); return; }
    const { error: err } = await supabase.from("timer_state").upsert({ ...t, user_id: uid, updated_at: new Date().toISOString() });
    if (err) setError(FAIL);
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const value = useMemo<Store>(() => ({
    auth, authReady, ready, exams, blocks, sessions, timer, error, clearError: () => setError(null),
    saveExam, deleteExam, saveBlock, deleteBlock, toggleDone, addSession, deleteSession, setTimer, signOut,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [auth, authReady, ready, exams, blocks, sessions, timer, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
