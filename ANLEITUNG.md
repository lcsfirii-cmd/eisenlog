# Eisenlog – so kommt die App aufs iPhone

Die App besteht aus ein paar Dateien in diesem Ordner. Damit dein iPhone sie öffnen kann,
müssen sie einmal ins Internet. Das geht kostenlos mit **GitHub Pages**. Du brauchst dafür
nur den PC und den Browser, kein Programm.

Deine Trainingsdaten landen dabei **nicht** im Internet. Online liegt nur die leere App.
Die Daten bleiben auf dem Handy.

---

## 1. Einmalig: online stellen (ca. 10 Minuten)

1. Geh auf **github.com** und leg ein kostenloses Konto an. Merk dir deinen Benutzernamen.
2. Oben rechts auf **+** → **New repository**.
   - Name: `eisenlog`
   - **Public** auswählen (nur dann ist GitHub Pages kostenlos)
   - Unten auf **Create repository**.
3. Auf der nächsten Seite auf den Link **uploading an existing file** klicken.
4. Öffne am PC den Ordner `eisenlog` und zieh **alles darin** ins Browserfenster:
   `index.html`, `app.css`, `app.js`, `logic.js`, `sw.js`, `manifest.webmanifest`
   und den Ordner `icons`. (Diese Anleitung darf mit, muss aber nicht.)
5. Unten auf **Commit changes**.
6. Oben auf **Settings** → links **Pages**.
   - Bei „Branch“: **main** und **/(root)** wählen → **Save**.
7. 1–2 Minuten warten, Seite neu laden. Oben steht dann deine Adresse:
   `https://DEIN-NAME.github.io/eisenlog/`

## 2. Einmalig: aufs iPhone holen

1. Öffne die Adresse auf dem iPhone in **Safari** (nicht Chrome).
2. Unten auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Ab jetzt die App **immer über das Symbol** auf dem Home-Bildschirm öffnen.
   Sie läuft dann wie eine normale App und auch ohne Internet im Studio.

> Wichtig: Die App im Safari-Tab und die App auf dem Home-Bildschirm haben getrennte
> Speicher. Trainier nur mit dem Symbol auf dem Home-Bildschirm.

## 3. Alte Daten übernehmen (optional)

1. In der alten Eisenlog-Version: Einstellungen → **Kopieren**.
2. In der neuen App: Zahnrad oben rechts → **Text einfügen** → einfügen → **Übernehmen**.

## 4. Sicherung (einmal pro Woche)

Die App erinnert dich nach 7 Tagen oben mit einem Hinweis.

- **Sichern:** Zahnrad → **Sicherung speichern** → **In Dateien sichern** → iCloud Drive.
- **Zurückholen** (z. B. neues Handy): Zahnrad → **Sicherung laden** → Datei auswählen.
  Was schon da ist, wird nicht doppelt übernommen.

## 5. Später: neue Version einspielen

1. Claude ändert die Dateien hier im Ordner und zählt die Version in `sw.js` hoch.
2. Auf GitHub in deinem Projekt `eisenlog`: **Add file** → **Upload files** →
   die geänderten Dateien hineinziehen → **Commit changes**. Gleiche Namen werden ersetzt.
3. 1–2 Minuten warten. Dann die App auf dem iPhone öffnen.
   Oben erscheint **„Neue Version ist da“** → **Aktualisieren**. Deine Daten bleiben.

## Bitte nie ändern

- **Die Adresse** (Benutzername und Projektname `eisenlog`). Das iPhone ordnet die Daten
  der Adresse zu. Neue Adresse = leere App. Falls es doch passiert: Sicherung laden.
- **Safari-Verlauf und Website-Daten löschen** löscht auch die App-Daten. Vorher sichern.
