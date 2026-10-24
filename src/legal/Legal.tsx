import { Link } from "react-router-dom";
import { OWNER } from "./info";
import Logo from "../components/Logo";
import { useStore } from "../lib/store";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  const { auth } = useStore();
  return (
    <div className="app">
      <div className="bg" style={{ backgroundImage: "url(./backgrounds/bibliothek.jpg)" }} />
      <div className="bg-shade" />
      <main className="legal">
        <div className="legal-top"><Logo size={36} /><Link to="/" className="link">← {auth ? "Zurück zur App" : "Zur Anmeldung"}</Link></div>
        <article className="card legal-card">
          <h1>{title}</h1>
          {children}
        </article>
      </main>
    </div>
  );
}

const Address = () => (
  <p>
    {OWNER.name}<br />
    {OWNER.street || <i className="muted">[Straße und Hausnummer folgen]</i>}<br />
    {OWNER.city || <i className="muted">[PLZ und Ort folgen]</i>}<br />
    Deutschland<br />
    E-Mail: <a className="link" href={`mailto:${OWNER.email}`}>{OWNER.email}</a>
  </p>
);

export function Impressum() {
  return (
    <Frame title="Impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <Address />
      <h2>Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)</h2>
      <p>{OWNER.name}, Anschrift wie oben.</p>
      <h2>Hinweis</h2>
      <p>Pazulic ist ein privates, nicht-kommerzielles Projekt. Es gibt keine Werbung und keine Kosten.</p>
      <h2>Haftung</h2>
      <p>Die Inhalte wurden mit Sorgfalt erstellt. Für Richtigkeit, Vollständigkeit und Aktualität (z. B. Ferientermine, Notenberechnung) wird keine Gewähr übernommen. Verbindlich sind immer die Angaben deiner Schule bzw. des Kultusministeriums.</p>
      <p className="muted small">Stand: Oktober 2026 · <Link className="link" to="/datenschutz">Datenschutzerklärung</Link></p>
    </Frame>
  );
}

export function Datenschutz() {
  return (
    <Frame title="Datenschutzerklärung">
      <p>Hier steht in einfachen Worten, welche Daten Pazulic speichert, warum und wo. Kurz gesagt: Pazulic speichert nur, was du selbst einträgst. Es gibt keine Werbung, kein Tracking und keine Analyse-Tools.</p>

      <h2>1. Verantwortlicher</h2>
      <Address />

      <h2>2. Welche Daten?</h2>
      <ul>
        <li><b>Konto:</b> deine E-Mail-Adresse und dein Passwort. Das Passwort wird nur verschlüsselt (als „Hash“) gespeichert – niemand kann es lesen.</li>
        <li><b>Deine Einträge:</b> Klausuren, Themen, Plan-Einträge, Lernzeiten, langfristige Ziele, Fächer und Noten.</li>
        <li><b>Google Kalender (freiwillig):</b> nur wenn du ihn verbindest – dann die geheime iCal-Adresse deines Kalenders.</li>
        <li><b>Technische Daten:</b> Beim Aufruf der Seite verarbeiten die Server automatisch z. B. deine IP-Adresse, Datum/Uhrzeit und Browser-Typ (Server-Logs). Das ist nötig, damit die Seite funktioniert und sicher bleibt.</li>
      </ul>

      <h2>3. Wofür und auf welcher Rechtsgrundlage?</h2>
      <ul>
        <li>Damit die App funktioniert (Anmeldung, Speichern, Synchronisieren zwischen Handy und Laptop): Art. 6 Abs. 1 lit. b DSGVO (Nutzung des Dienstes).</li>
        <li>Server-Logs für Betrieb und Sicherheit: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).</li>
        <li>Google Kalender: Art. 6 Abs. 1 lit. a DSGVO (deine Einwilligung). Du kannst die Verbindung jederzeit in den Einstellungen trennen.</li>
      </ul>

      <h2>4. Wo werden die Daten gespeichert?</h2>
      <ul>
        <li><b>Datenbank und Anmeldung: Supabase</b> (Supabase Inc.). Die Datenbank liegt in der <b>EU (Irland)</b>. Jede Person sieht nur ihre eigenen Daten – das prüft die Datenbank selbst (Row Level Security). Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO).</li>
        <li><b>Webseite: GitHub Pages</b> (GitHub Inc., USA). GitHub liefert nur die App-Dateien aus und verarbeitet dabei Server-Logs (z. B. IP-Adresse). GitHub ist unter dem EU-US Data Privacy Framework zertifiziert. Deine Einträge liegen nicht bei GitHub.</li>
        <li><b>Google Kalender (nur wenn verbunden):</b> Ein Supabase-Server ruft deinen Kalender bei Google (Google Ireland Ltd. / Google LLC) ab und gibt die Termine an deine App weiter. Pazulic schreibt nichts in deinen Google Kalender.</li>
      </ul>

      <h2>5. Speicher im Browser (keine Cookies)</h2>
      <p>Pazulic nutzt keine Cookies. Im Speicher deines Browsers („Local Storage“) werden nur deine Anmeldung und kleine Einstellungen gespeichert (z. B. ob du Liste oder Kalender sehen willst). Das ist technisch nötig (§ 25 Abs. 2 TDDDG).</p>

      <h2>6. Schriften</h2>
      <p>Alle Schriften sind in der App enthalten. Es werden keine Daten an Google Fonts oder andere Schrift-Anbieter gesendet.</p>

      <h2>7. Wie lange?</h2>
      <p>Deine Daten bleiben gespeichert, bis du sie löschst oder dein Konto löschst. Wenn du dein Konto löschst (Einstellungen → „Konto löschen“), werden alle deine Daten sofort und endgültig gelöscht. Server-Logs werden von den Anbietern nach kurzer Zeit automatisch gelöscht.</p>

      <h2>8. Deine Rechte</h2>
      <p>Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Eine Einwilligung kannst du jederzeit widerrufen. Viele Rechte kannst du direkt in der App nutzen: Einträge ändern oder löschen, „Sicherung herunterladen“ (alle deine Daten als Datei) und „Konto löschen“. Sonst schreib eine E-Mail an die Adresse oben.</p>
      <p>Du kannst dich auch bei einer Datenschutz-Aufsichtsbehörde beschweren, z. B. bei der <b>Landesbeauftragten für den Datenschutz Niedersachsen</b>, Prinzenstraße 5, 30159 Hannover.</p>

      <h2>9. Keine automatischen Entscheidungen</h2>
      <p>Der Auto-Plan und die Noten-Prognose sind nur Vorschläge und Rechenhilfen. Es gibt keine automatisierte Entscheidung im Sinne von Art. 22 DSGVO.</p>

      <p className="muted small">Stand: Oktober 2026 · <Link className="link" to="/impressum">Impressum</Link></p>
    </Frame>
  );
}
