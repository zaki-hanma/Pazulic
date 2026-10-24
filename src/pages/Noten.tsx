import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { Grade, GradeKind } from "../lib/types";
import {
  KIND_NAME, SUBJECTS, WORD, areaNote, currentYear, fmt1, fmtNum, gradeColor, gradeValue, pct, reportSubjects,
  roundGrade, subjectOf, subjectResults, yearLabel,
} from "../lib/grades";
import { shortDate } from "../lib/dates";
import Sheet from "../components/Sheet";

function GradeForm({ year, grade, onDone }: { year: string; grade?: Grade; onDone: () => void }) {
  const { saveGrade, deleteGrade } = useStore();
  const [subject, setSubject] = useState(grade?.subject ?? "LF5");
  const [title, setTitle] = useState(grade?.title ?? "");
  const [kind, setKind] = useState<GradeKind>(grade?.kind ?? "klausur");
  const [date, setDate] = useState(grade?.date ?? "");
  const [points, setPoints] = useState(grade?.points != null ? String(grade.points).replace(".", ",") : "");
  const [max, setMax] = useState(grade?.max_points != null ? String(grade.max_points).replace(".", ",") : "");
  const [text, setText] = useState(grade?.grade_text ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let p = num(points), m = num(max), t = text.trim() || null;
    if (p != null && Number.isNaN(p)) { setMsg("Punkte: bitte nur Zahlen."); return; }
    if (m != null && Number.isNaN(m)) { setMsg("Max. Punkte: bitte nur Zahlen."); return; }
    // Max. Punkte leer → die Zahl ist direkt die Note
    if (m == null && p != null && !t) { t = String(p).replace(".", ","); p = null; }
    if (p == null && !t) { setMsg("Bitte Punkte oder eine Note eintragen."); return; }
    setBusy(true);
    const ok = await saveGrade({ id: grade?.id, school_year: year, subject, title: title.trim() || KIND_NAME[kind], kind, date: date || null, points: p, max_points: m, grade_text: t });
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="lbl" htmlFor="n-s">Fach / Lernfeld</label>
      <select id="n-s" value={subject} onChange={(e) => setSubject(e.target.value)}>
        {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
      </select>
      <label className="lbl" htmlFor="n-t">Name der Leistung</label>
      <input id="n-t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Klausur 1 (Kaufvertrag)" />
      <label className="lbl">Art</label>
      <div className="chips">
        {(Object.keys(KIND_NAME) as GradeKind[]).map((k) => (
          <button type="button" key={k} className={"chip" + (kind === k ? " on" : "")} style={{ ["--c" as string]: "var(--yellow)" }} onClick={() => setKind(k)}>{KIND_NAME[k]}</button>
        ))}
      </div>
      <div className="row3">
        <div><label className="lbl" htmlFor="n-d">Datum</label><input id="n-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="n-p">Punkte</label><input id="n-p" inputMode="decimal" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="43" /></div>
        <div><label className="lbl" htmlFor="n-m">max. Punkte</label><input id="n-m" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="62" /></div>
      </div>
      <p className="muted small">max. Punkte leer → die Zahl bei „Punkte“ ist direkt die Note.</p>
      <label className="lbl" htmlFor="n-g">Note der Lehrkraft (optional, z. B. 3−)</label>
      <input id="n-g" value={text} onChange={(e) => setText(e.target.value)} placeholder="Wenn leer, rechnet die App aus den Prozent" maxLength={6} />
      {msg && <p className="err">{msg}</p>}
      <div className="form-actions">
        {grade && <button type="button" className="btn danger" onClick={async () => { if (window.confirm("Diese Note löschen?") && (await deleteGrade(grade.id))) onDone(); }}>Löschen</button>}
        <button className="btn primary" disabled={busy}>{busy ? "Speichert …" : "Speichern"}</button>
      </div>
    </form>
  );
}

function ReportForm({ year, onDone }: { year: string; onDone: () => void }) {
  const { reportGrades, saveReportGrade } = useStore();
  const keys = [...SUBJECTS.filter((s) => s.key !== "LF0").map((s) => s.key), "BEREICH_UEBERGREIFEND", "BEREICH_BEZOGEN"];
  const label = (k: string) => (k === "BEREICH_UEBERGREIFEND" ? "Berufsübergreifend (Bereich)" : k === "BEREICH_BEZOGEN" ? "Berufsbezogen (Bereich)" : subjectOf(k)?.name ?? k);
  const init = Object.fromEntries(keys.map((k) => [k, String(reportGrades.find((r) => r.school_year === year && r.subject === k)?.grade ?? "")]));
  const [vals, setVals] = useState<Record<string, string>>(init);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    for (const k of keys) {
      if (vals[k] === init[k]) continue;
      const n = vals[k] ? parseInt(vals[k], 10) : null;
      await saveReportGrade({ school_year: year, subject: k, grade: n && n >= 1 && n <= 6 ? n : null });
    }
    setBusy(false); onDone();
  }
  return (
    <form className="form" onSubmit={submit}>
      <p className="muted small">Trag die Noten aus deinem echten Zeugnis ein (1–6). Leer = nicht erteilt.</p>
      <div className="report-edit">
        {keys.map((k) => (
          <label key={k}><span>{label(k)}</span>
            <select value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}>
              <option value="">–</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="form-actions"><button className="btn primary" disabled={busy}>{busy ? "Speichert …" : "Speichern"}</button></div>
    </form>
  );
}

function Cmp({ prog, real }: { prog: number | null; real: number | null | undefined }) {
  if (prog == null || real == null) return null;
  if (prog === real) return <span className="pill" style={{ ["--c" as string]: "var(--green)" }}>passt</span>;
  return real < prog ? <span className="pill" style={{ ["--c" as string]: "var(--blue)" }}>besser</span> : <span className="pill" style={{ ["--c" as string]: "var(--red)" }}>schlechter</span>;
}

export default function Noten() {
  const { grades, reportGrades } = useStore();
  const cur = currentYear();
  const years = useMemo(() => [...new Set([...grades.map((g) => g.school_year), cur])].sort(), [grades, cur]);
  const [year, setYear] = useState(cur);
  const [edit, setEdit] = useState<Grade | "new" | null>(null);
  const [report, setReport] = useState(false);
  const archive = year < cur;

  const results = useMemo(() => subjectResults(grades, year), [grades, year]);
  const rep = useMemo(() => reportSubjects(results), [results]);
  const ueber = rep.filter((r) => r.subject.area === "ueber");
  const bez = rep.filter((r) => r.subject.area === "bezogen");
  const total = areaNote(rep);
  const yg = grades.filter((g) => g.school_year === year)
    .sort((a, b) => SUBJECTS.findIndex((s) => s.key === a.subject) - SUBJECTS.findIndex((s) => s.key === b.subject) || (a.date ?? "").localeCompare(b.date ?? ""));
  const real = (k: string) => reportGrades.find((r) => r.school_year === year && r.subject === k)?.grade;

  const area = (title: string, list: typeof rep, key: string) => {
    const n = areaNote(list);
    return (
      <div className="report-area">
        <div className="row-between report-head">
          <b>{title}</b>
          <span>{n == null ? "–" : <><b style={{ color: gradeColor(roundGrade(n)) }}>{roundGrade(n)}</b> {WORD[roundGrade(n)]} <span className="muted small">({fmt1(n)})</span></>}
            {archive && <> · Zeugnis: <b>{real(key) ?? "–"}</b> <Cmp prog={n == null ? null : roundGrade(n)} real={real(key)} /></>}</span>
        </div>
        {list.map((r) => {
          const z = r.note == null ? null : roundGrade(r.note);
          return (
            <div key={r.key} className="report-row">
              <span>{r.subject.name}</span>
              <span className="mono small muted">{fmt1(r.note)}</span>
              <span><b style={{ color: gradeColor(z) }}>{z ?? "–"}</b> <span className="small">{z ? WORD[z] : ""}</span></span>
              {archive && <span className="small">{real(r.key) ?? "–"} <Cmp prog={z} real={real(r.key)} /></span>}
            </div>
          );
        })}
        {list.length === 0 && <p className="muted small">Noch keine Noten.</p>}
      </div>
    );
  };

  return (
    <div className="page">
      <header className="page-head row-between">
        <h1>Noten</h1>
        <button className="btn primary small" onClick={() => setEdit("new")}>+ Note</button>
      </header>

      <div className="seg wide">
        {years.map((y) => (
          <button key={y} className={y === year ? "on" : ""} onClick={() => setYear(y)}>
            {yearLabel(y)}<small className="seg-sub">{y < cur ? " · Archiv" : y === cur ? " · aktuell" : ""}</small>
          </button>
        ))}
      </div>

      <section className="card total-card">
        <span className="muted small">Gesamtschnitt {yearLabel(year)}</span>
        <div className="total mono" style={{ color: gradeColor(total) }}>{fmt1(total)}</div>
        <span className="muted small">{total == null ? "Noch keine Noten in diesem Schuljahr." : `≈ ${WORD[roundGrade(total)]} · gewichtet nach Stunden`}</span>
      </section>

      {results.length > 0 && (
        <section className="tiles">
          {results.map((r) => (
            <div key={r.key} className="card tile" style={{ ["--c" as string]: gradeColor(r.note) }}>
              <span className="small muted tile-name">{r.subject.name}</span>
              <b className="mono tile-note">{fmt1(r.note)}</b>
              <span className="small muted">{r.count} {r.count === 1 ? "Note" : "Noten"} · schr. {r.subject.written} % / mdl. {100 - r.subject.written} %</span>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Alle Noten</h2>
        {yg.length === 0 ? <p className="muted">Noch keine Noten. Tippe auf „+ Note“.</p> : (
          <div className="gtable">
            <div className="grow ghead"><span>Fach</span><span>Leistung</span><span>Punkte</span><span>%</span><span>Note</span><span /></div>
            {yg.map((g) => {
              const v = gradeValue(g), p = pct(g);
              return (
                <div key={g.id} className="grow">
                  <span className="gsub">{g.subject}</span>
                  <button className="glead" onClick={() => setEdit(g)}>
                    <b>{g.title}</b>
                    <small className="muted">{KIND_NAME[g.kind]}{g.date ? " · " + shortDate(g.date) : ""}</small>
                  </button>
                  <span className="mono small">{g.points != null ? `${fmtNum(g.points)} / ${fmtNum(g.max_points)}` : "–"}</span>
                  <span className="mono small">{p != null ? Math.round(p) + " %" : "–"}</span>
                  <span className="gnote" style={{ color: gradeColor(v) }}>{g.grade_text || (v ?? "–")}</span>
                  <button className="icon-btn" aria-label="Bearbeiten" onClick={() => setEdit(g)}>✎</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Zeugnis-Prognose</h2>
          {archive && <button className="btn ghost small" onClick={() => setReport(true)}>Echtes Zeugnis eintragen</button>}
        </div>
        {area("Berufsübergreifender Lernbereich", ueber, "BEREICH_UEBERGREIFEND")}
        {area("Berufsbezogener Lernbereich", bez, "BEREICH_BEZOGEN")}
        <p className="muted small">Fachnote = schriftlich × Anteil + mündlich × Anteil · Zeugnisnote kaufmännisch gerundet (bis x,49 ab, ab x,50 auf) · LF0 zählt 1:1 mit LF2.</p>
      </section>

      <section className="card">
        <h2>Notenschlüssel (IHK)</h2>
        <div className="scale">
          {[[1, "ab 92 %"], [2, "ab 81 %"], [3, "ab 67 %"], [4, "ab 50 %"], [5, "ab 30 %"], [6, "unter 30 %"]].map(([n, t]) => (
            <div key={n} style={{ ["--c" as string]: gradeColor(n as number) }}><b>{n}</b><small>{t}</small></div>
          ))}
        </div>
        <p className="muted small">Hat die Lehrkraft eine Note geschrieben, zählt immer diese. Tendenzen: 2+ = 1,7 · 2− = 2,3 usw.</p>
      </section>

      {edit && <Sheet title={edit === "new" ? "Neue Note" : "Note bearbeiten"} onClose={() => setEdit(null)}><GradeForm year={year} grade={edit === "new" ? undefined : edit} onDone={() => setEdit(null)} /></Sheet>}
      {report && <Sheet title={`Zeugnis ${yearLabel(year)}`} onClose={() => setReport(false)}><ReportForm year={year} onDone={() => setReport(false)} /></Sheet>}
    </div>
  );
}
