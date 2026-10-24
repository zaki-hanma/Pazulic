import { useState } from "react";
import { useStore } from "../lib/store";
import type { Block, Kind, RepeatRule } from "../lib/types";
import { KINDS, KIND_COLOR, KIND_LABEL, isStudy } from "../lib/types";
import { hhmm, minutesBetween, fmtMin, isoWeekday, parseYmd } from "../lib/dates";
import { isRepeating, learnMinutes, ruleText } from "../lib/plan";
import NewKind from "./NewKind";

const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
type Freq = "none" | RepeatRule["freq"];

interface Props { block?: Block; date: string; onDone: () => void }

export default function BlockForm({ block, date, onDone }: Props) {
  const { exams, saveBlock, deleteBlock, customKinds, skipOccurrence } = useStore();
  const [kind, setKind] = useState<Kind>(block?.kind ?? "lernen");
  const [customId, setCustomId] = useState<string | null>(block?.custom_kind_id ?? null);
  const [newKind, setNewKind] = useState(false);
  const [title, setTitle] = useState(block?.title ?? "");
  const [examId, setExamId] = useState<string>(block?.exam_id ?? exams.find((e) => e.date >= date)?.id ?? "");
  const [topics, setTopics] = useState<string[]>(block?.topic_ids ?? []);
  const [d, setD] = useState(block?.date ?? date);
  const [start, setStart] = useState(hhmm(block?.start_time ?? "17:00"));
  const [end, setEnd] = useState(hhmm(block?.end_time ?? "17:30"));
  // Wiederholung (alte wöchentliche Einträge werden in die neue Regel übernommen)
  const r0: RepeatRule | null = block?.repeat_rule ?? (block?.repeat_weekdays?.length ? { freq: "weekly", interval: 1, weekdays: block.repeat_weekdays } : null);
  const [freq, setFreq] = useState<Freq>(r0?.freq ?? "none");
  const [interval, setInterval] = useState(String(r0?.interval ?? 1));
  const [weekdays, setWeekdays] = useState<number[]>(r0?.weekdays ?? []);
  const [monthMode, setMonthMode] = useState<"day" | "nth">(r0?.monthMode ?? "day");
  const [nth, setNth] = useState(r0?.nth ?? 1);
  const [until, setUntil] = useState(r0?.until ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const study = isStudy(kind);
  const exam = exams.find((e) => e.id === examId);
  const dur = minutesBetween(start, end);
  const planned = study ? learnMinutes(start, end) : 0;

  const toggleTopic = (id: string) => setTopics((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const toggleWd = (n: number) => setWeekdays((r) => (r.includes(n) ? r.filter((x) => x !== n) : [...r, n].sort()));
  const rule: RepeatRule | null = freq === "none" ? null : {
    freq, interval: Math.max(1, parseInt(interval, 10) || 1),
    ...(freq === "weekly" ? { weekdays: weekdays.length ? weekdays : [isoWeekday(d)] } : {}),
    ...(freq === "monthly" ? (monthMode === "nth" ? { monthMode, nth, nthWeekday: isoWeekday(d) } : { monthMode, monthDay: parseYmd(d).getDate() }) : {}),
    until: until || null,
  };
  const preview = rule ? ruleText({ ...(block ?? {}), date: d, repeat_rule: rule } as Block) : "";
  const pickKind = (k: Kind, c: string | null) => { setKind(k); setCustomId(c); };


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (dur <= 0) { setMsg("Die End-Zeit muss nach der Start-Zeit sein."); return; }
    let t = title.trim();
    if (!t && study && exam) t = topics.map((id) => exam.topics.find((x) => x.id === id)?.short || exam.topics.find((x) => x.id === id)?.name).filter(Boolean).join(" + ");
    if (!t) t = customId ? customKinds.find((x) => x.id === customId)?.name ?? KIND_LABEL[kind] : KIND_LABEL[kind];
    setBusy(true);
    const ok = await saveBlock({
      id: block?.id, kind, title: t, date: d, start_time: start, end_time: end,
      exam_id: study ? examId || null : null, topic_ids: study ? topics : [], planned_minutes: planned, repeat_weekdays: null, repeat_rule: rule, custom_kind_id: customId,
    });
    setBusy(false);
    if (ok) onDone();
  }

  async function remove(all: boolean) {
    if (!block) return;
    if (!all) { if (window.confirm("Nur den Termin an diesem Tag löschen?") && (await skipOccurrence(block, date))) onDone(); return; }
    if (!window.confirm(isRepeating(block) ? "Diesen Eintrag mit ALLEN Wiederholungen löschen?" : "Diesen Eintrag löschen?")) return;
    if (await deleteBlock(block.id)) onDone();
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="lbl">Art</label>
      <div className="chips">
        {KINDS.map((k) => (
          <button type="button" key={k} className={"chip" + (kind === k && !customId ? " on" : "")} style={{ ["--c" as string]: KIND_COLOR[k] }} onClick={() => pickKind(k, null)}>
            <i className="dot" />{KIND_LABEL[k]}
          </button>
        ))}
        {customKinds.map((c) => (
          <button type="button" key={c.id} className={"chip" + (customId === c.id ? " on" : "")} style={{ ["--c" as string]: c.color }} onClick={() => pickKind("sonstiges", c.id)}>
            <i className="dot" />{c.name}
          </button>
        ))}
        <button type="button" className="chip" style={{ ["--c" as string]: "var(--yellow)" }} onClick={() => setNewKind(true)}>+ Eigene Art</button>
      </div>
      {newKind && <NewKind onSaved={(k) => { pickKind("sonstiges", k.id); setNewKind(false); }} onCancel={() => setNewKind(false)} />}

      {study && (
        <>
          <label className="lbl" htmlFor="f-exam">Klausur</label>
          <select id="f-exam" value={examId} onChange={(e) => { setExamId(e.target.value); setTopics([]); }}>
            <option value="">– keine Klausur –</option>
            {exams.map((x) => <option key={x.id} value={x.id}>{x.short_name || x.subject} ({x.date.split("-").reverse().join(".")})</option>)}
          </select>
          {exam && exam.topics.length > 0 && (
            <>
              <label className="lbl">Themen</label>
              <div className="chips">
                {exam.topics.map((t) => (
                  <button type="button" key={t.id} className={"chip" + (topics.includes(t.id) ? " on" : "")} style={{ ["--c" as string]: "var(--blue)" }} onClick={() => toggleTopic(t.id)}>
                    {t.short || t.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <label className="lbl" htmlFor="f-title">Titel {study ? "(leer = Themen-Namen)" : "(optional)"}</label>
      <input id="f-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={study ? "z. B. Karteikarten" : customKinds.find((x) => x.id === customId)?.name ?? KIND_LABEL[kind]} maxLength={80} />

      <div className="row3">
        <div><label className="lbl" htmlFor="f-date">{freq !== "none" ? "Ab Datum" : "Datum"}</label><input id="f-date" type="date" value={d} onChange={(e) => setD(e.target.value)} required /></div>
        <div><label className="lbl" htmlFor="f-start">Von</label><input id="f-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
        <div><label className="lbl" htmlFor="f-end">Bis</label><input id="f-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
      </div>
      <p className="muted small">
        Dauer: {dur > 0 ? fmtMin(dur) : "–"}
        {study && dur > 0 && <> · Ziel-Lernzeit: <b className="mono">{fmtMin(planned)}</b> (Pomodoro 25 + 5)</>}
      </p>

      <label className="lbl" htmlFor="f-rep">Wiederholen</label>
      <select id="f-rep" value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
        <option value="none">Nicht wiederholen</option>
        <option value="daily">Täglich / alle X Tage</option>
        <option value="weekly">Wöchentlich / alle X Wochen</option>
        <option value="monthly">Monatlich / alle X Monate</option>
        <option value="yearly">Jährlich</option>
      </select>
      {freq !== "none" && (
        <div className="repeat-box">
          <div className="inline">
            <span>alle</span>
            <input className="num" inputMode="numeric" value={interval} onChange={(e) => setInterval(e.target.value.replace(/\D/g, ""))} aria-label="Abstand" />
            <span>{freq === "daily" ? "Tage" : freq === "weekly" ? "Wochen" : freq === "monthly" ? "Monate" : "Jahre"}</span>
          </div>
          {freq === "weekly" && (
            <div className="chips">
              {WD.map((w, i) => (
                <button type="button" key={w} className={"chip sq" + ((weekdays.length ? weekdays : [isoWeekday(d)]).includes(i + 1) ? " on" : "")} style={{ ["--c" as string]: "var(--yellow)" }} onClick={() => toggleWd(i + 1)}>{w}</button>
              ))}
            </div>
          )}
          {freq === "monthly" && (
            <div className="chips">
              <button type="button" className={"chip" + (monthMode === "day" ? " on" : "")} style={{ ["--c" as string]: "var(--yellow)" }} onClick={() => setMonthMode("day")}>am {parseYmd(d).getDate()}. des Monats</button>
              {[1, 2, 3, 4, -1].map((n) => (
                <button type="button" key={n} className={"chip" + (monthMode === "nth" && nth === n ? " on" : "")} style={{ ["--c" as string]: "var(--yellow)" }} onClick={() => { setMonthMode("nth"); setNth(n); }}>
                  {n === -1 ? "letzten" : n + "."} {WD[isoWeekday(d) - 1]}
                </button>
              ))}
            </div>
          )}
          <div className="inline">
            <label className="lbl" htmlFor="f-until" style={{ margin: 0 }}>Ende (optional)</label>
            <input id="f-until" type="date" value={until} min={d} onChange={(e) => setUntil(e.target.value)} />
          </div>
          <p className="ok small">↻ {preview}</p>
          <p className="muted small">Tipp: Der Wochentag kommt vom Datum oben (z. B. für „letzter Mittwoch im Monat“ ein Mittwoch-Datum wählen).</p>
        </div>
      )}

      {msg && <p className="err">{msg}</p>}
      <div className="form-actions">
        {block && isRepeating(block) && <button type="button" className="btn danger" onClick={() => remove(false)}>Nur diesen Tag löschen</button>}
        {block && <button type="button" className="btn danger" onClick={() => remove(true)}>{isRepeating(block) ? "Alle löschen" : "Löschen"}</button>}
        <button className="btn primary" disabled={busy}>{busy ? "Speichert …" : "Speichern"}</button>
      </div>
    </form>
  );
}
