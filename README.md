# Satzbuch

Kostenloses Trainingstagebuch für Krafttraining. Läuft im Browser auf iPhone und Mac, auch ohne Internet.

**App öffnen:** https://tr4shcookey.github.io/satzbuch/

## Auf dem iPhone installieren
1. Adresse oben in **Safari** öffnen.
2. Unten auf **Teilen** tippen, dann **Zum Home-Bildschirm**.
3. Das Satzbuch startet danach wie eine normale App.

## Daten
- Alle Daten bleiben auf deinem Gerät (im Browser-Speicher). In diesem Repository liegen keine persönlichen Daten.
- Unter **Ich → Daten → Sicherung speichern** legst du eine Datei in iCloud Drive ab. Auf dem anderen Gerät lädst du sie mit **Sicherung laden**.

## Aufbau
- `index.html`, `app.css`: Seite und Gestaltung (hell/dunkel)
- `data.js`: 123 Übungen und 5 fertige Pläne
- `core.js`: Speicher, Rechnungen (1RM, Rekorde, Vorschläge), Blätter, Diagramme
- `views.js`: Heute, Training, Übungen, Verlauf, Ich
- `workout.js`: laufendes Training, Pausen-Timer, Zusammenfassung
- `sw.js`: Offline-Speicher. Vor jedem Update `python3 tools/release.py` ausführen.
