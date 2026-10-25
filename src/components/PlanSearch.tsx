import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { useGoogle } from "../lib/google";
import { addDays, hhmm, shortDate, today } from "../lib/dates";
import { occurrencesOn } from "../lib/plan";
import { googleKind, kindInfo } from "../lib/labels";

interface Hit { date: string; time: string; title: string; sub: string; color: string; g?: boolean }

/** Suche in Plan-Einträgen, Google-Terminen und Klausuren (ca. 3 Monate zurück bis 1 Jahr voraus). */
export default function PlanSearch({ onPick }: { onPick: (date: string) => void }) {
  const { blocks, exams, customKinds, googleMarks, googleRules } = useStore();
  const google = useGoogle().byDate;
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const hits = useMemo<Hit[]>(() => {
    if (query.length < 2) return [];
    const out: Hit[] = [];
    const from = addDays(today(), -90), to = addDays(today(), 365);
    const base = (b: typeof blocks[number]) => (b.title + " " + kindInfo(b.kind, b.custom_kind_id, customKinds).label).toLowerCase();
    const cand = blocks.filter((b) => base(b).includes(query) || Object.values(b.day_notes ?? {}).some((n) => n.toLowerCase().includes(query)));
    if (cand.length) {
      for (let d = from; d <= to; d = addDays(d, 1)) {
        for (const o of occurrencesOn(cand, d)) {
          const note = o.block.day_notes?.[d] ?? "";
          if (!base(o.block).includes(query) && !note.toLowerCase().includes(query)) continue;
          const k = kindInfo(o.block.kind, o.block.custom_kind_id, customKinds);
          out.push({ date: d, time: hhmm(o.block.start_time), title: o.block.title, sub: k.label + (note ? " · 📝 " + note : ""), color: k.color });
        }
      }
    }
    for (const [d, list] of google) {
      for (const ev of list) {
        const gk = googleKind(ev.title, googleMarks.find((x) => x.uid === ev.uid && x.date === d), googleRules);
        const k = kindInfo(gk.kind, gk.custom, customKinds);
        const note = googleMarks.find((x) => x.uid === ev.uid && x.date === d)?.note ?? "";
        if ((ev.title + " " + k.label + " " + note).toLowerCase().includes(query)) out.push({ date: d, time: ev.allDay ? "ganzt." : ev.start, title: ev.title, sub: "Google · " + k.label + (note ? " · 📝 " + note : ""), color: k.color, g: true });
      }
    }
    for (const e of exams) {
      if ((e.subject + " " + (e.short_name ?? "") + " " + e.topics.map((t) => t.name).join(" ")).toLowerCase().includes(query))
        out.push({ date: e.date, time: e.time.slice(0, 5), title: "Klausur: " + (e.short_name || e.subject), sub: e.subject, color: "var(--red)" });
    }
    const t = today();
    // Erst kommende (nach Datum), dann vergangene (neueste zuerst)
    return [...out.filter((h) => h.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
      ...out.filter((h) => h.date < t).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))];
  }, [query, blocks, exams, google, customKinds, googleMarks, googleRules]);

  const t = today();
  const firstPast = hits.findIndex((h) => h.date < t);
  return (
    <section className="card search-card">
      <div className="search">
        <span aria-hidden>🔍</span>
        <input type="text" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen: Termine, Notizen, z. B. Fahrstunde, KLR …" aria-label="Im Plan suchen" />
        {q && <button className="icon-btn" onClick={() => setQ("")} aria-label="Suche leeren">✕</button>}
      </div>
      {query.length >= 2 && (
        hits.length === 0 ? <p className="muted small">Nichts gefunden.</p> : (
          <>
            <p className="muted small">{hits.length > 100 ? "100+ " : hits.length + " "}Treffer</p>
            <ul className="occ-list hits">
              {hits.slice(0, 100).map((h, i) => (
                <li key={i}>
                  {i === firstPast && <p className="muted small hits-sep">Vergangen</p>}
                  <button className="hit" style={{ ["--c" as string]: h.color }} onClick={() => { onPick(h.date); setQ(""); }}>
                    <span className="mono small hit-date">{shortDate(h.date)}<small>{h.time}</small></span>
                    <span className="occ-text"><b>{h.title}</b><small className="muted">{h.g && <span className="gtag">G</span>} {h.sub}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </section>
  );
}
