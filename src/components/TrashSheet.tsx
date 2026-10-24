import { useStore } from "../lib/store";
import { useGoogle, HIDE_ALL } from "../lib/google";
import { isRepeating, ruleText } from "../lib/plan";
import { hhmm, longDate } from "../lib/dates";
import Sheet from "./Sheet";

/** Papierkorb: gelöschte Einträge, gelöschte Tage und ausgeblendete Google-Termine wiederherstellen. */
export default function TrashSheet({ onClose }: { onClose: () => void }) {
  const { trash, blocks, restoreBlock, purgeBlock, unskipOccurrence, googleMarks, saveGoogleMark } = useStore();
  const { titles } = useGoogle();
  const skipped = blocks.flatMap((b) => (b.skip_dates ?? []).map((d) => ({ b, d }))).sort((a, b) => b.d.localeCompare(a.d));
  const hidden = googleMarks.filter((m) => m.hidden);
  const empty = !trash.length && !skipped.length && !hidden.length;
  const delDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("de-DE") : "");

  return (
    <Sheet title="🗑 Papierkorb" onClose={onClose}>
      <div className="form">
        {empty && <p className="muted">Der Papierkorb ist leer.</p>}

        {trash.length > 0 && <>
          <h3>Gelöschte Einträge</h3>
          <p className="muted small">Werden nach 30 Tagen endgültig gelöscht. Gelöschte Einträge zählen nicht in der Analyse.</p>
          <ul className="trash">
            {trash.map((b) => (
              <li key={b.id}>
                <span><b>{b.title}</b><small className="muted">{isRepeating(b) ? "↻ " + ruleText(b) : longDate(b.date)} · {hhmm(b.start_time)}–{hhmm(b.end_time)} · gelöscht am {delDate(b.deleted_at)}</small></span>
                <span className="trash-actions">
                  <button className="btn primary small" onClick={() => restoreBlock(b.id)}>Wiederherstellen</button>
                  <button className="btn danger small" onClick={() => window.confirm(`„${b.title}“ endgültig löschen? Das kann man nicht rückgängig machen.`) && purgeBlock(b.id)}>Endgültig</button>
                </span>
              </li>
            ))}
          </ul>
        </>}

        {skipped.length > 0 && <>
          <h3>Gelöschte Tage aus Wiederholungen</h3>
          <ul className="trash">
            {skipped.map(({ b, d }) => (
              <li key={b.id + d}>
                <span><b>{b.title}</b><small className="muted">{longDate(d)} · {hhmm(b.start_time)}–{hhmm(b.end_time)}</small></span>
                <span className="trash-actions"><button className="btn primary small" onClick={() => unskipOccurrence(b, d)}>Wiederherstellen</button></span>
              </li>
            ))}
          </ul>
        </>}

        {hidden.length > 0 && <>
          <h3>Ausgeblendete Google-Termine</h3>
          <ul className="trash">
            {hidden.map((m) => (
              <li key={m.uid + m.date}>
                <span><b>{m.title || titles.get(m.uid) || "Google-Termin"}</b><small className="muted">{m.date === HIDE_ALL ? "alle Termine dieser Serie" : longDate(m.date)}</small></span>
                <span className="trash-actions"><button className="btn primary small" onClick={() => saveGoogleMark({ uid: m.uid, date: m.date, hidden: false })}>Wiederherstellen</button></span>
              </li>
            ))}
          </ul>
        </>}
      </div>
    </Sheet>
  );
}
