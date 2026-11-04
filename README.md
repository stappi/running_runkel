# Running Runkel

Ein Jump 'n' Run für den Browser: Eine Runkel flieht in Hardinghausens Feldern vor fliegenden Holzknüppeln und weicht Baumstämmen, Wildschweinen, Kühen und Traktoren aus. Das Spiel kommt ohne Frameworks und Build-Schritt aus und läuft nur mit HTML, CSS und JavaScript.

## Starten

`index.html` per Doppelklick öffnen. Für den Test auf dem Handy muss der Ordner über einen Webserver erreichbar sein, zum Beispiel über GitHub Pages oder lokal so:

```bash
python -m http.server 8123
```

## Steuerung

| Aktion | Laptop | Mobilgerät |
|---|---|---|
| Laufen | ← → oder A D | ◀ ▶ |
| Springen | Leertaste, W oder ↑ | ▲ |
| Ducken | S oder ↓ | ▼ |
| Pause | P oder Esc | Pausetaste oben rechts |
| Ton an/aus | M | Notentaste oben rechts |
| Vollbild | Taste oben rechts | Taste oben rechts |

Auf Android hält das Vollbild das Querformat fest. Das iPhone kennt kein Vollbild für Webseiten; liegt das Spiel auf einer Webadresse, startet es nach „Teilen → Zum Home-Bildschirm“ von dort ohne Browserleisten.

## Regeln

- Ziel ist das Zielschild am Ende jedes Feldes. Wer alle drei Level schafft, bringt die Runkel heil nach Hause.
- Samen bringen je 10 Punkte, goldene Runkeln 200, jedes Herz im Ziel 100. Die Punkte zählen für den Bestwert je Level.
- Die Runkel hat 3 Herzen. Jede aktivierte Vogelscheuche ist ein Rücksetzpunkt und gibt ein Herz zurück.
- Knüppel kommen von hinten, ein rotes Warnsymbol am linken Rand zeigt die Flughöhe. Wer trödelt, bekommt mehr davon.
- Stämme, Kühe und Traktoren sind von oben sicher und von der Seite gefährlich. Wildschweine lassen sich mit einem Sprung auf den Kopf kurz betäuben.
- Jedes Level versteckt 3 goldene Runkeln. Bestwerte und freigeschaltete Levels speichert der Browser.

## Projektaufbau

| Pfad | Inhalt |
|---|---|
| `js/runkel-rig.js` | Animation der Figur: Haltungen, biegsame Blätter und Mimik je Zustand |
| `js/levels.js` | Leveldaten als Textraster, die Legende steht am Dateianfang |
| `js/game.js`, `player.js`, `entities.js`, `physics.js`, `level.js` | Spiellogik und Zeichnen der Welt |
| `js/scenery.js` | Münsterländische Kulisse im Stil von Runkel Royal: Höfe, Wallhecken, Kopfweiden, Kirchtürme |
| `js/main.js`, `hud.js`, `input.js`, `audio.js`, `assets.js` | Schleife, Menüs, Anzeige, Eingabe, Ton, Laden |
| `assets/sprites` | Aus den Vorlagen geschnittene Teile, erzeugt von `tools/slice-sprites.ps1` |
| `assets/svg` | Gegner und Objekte |

## Testen

`node tools/playtest.js` prüft die Levelraster und lässt einen Bot jedes Level mehrfach spielen.

Im Browser helfen diese Adressen:

- `?debug=1` zeigt Hitboxen und Bildrate.
- `?debug=1&level=2` startet direkt in Level 2.
- `?debug=rig` zeigt alle Animationen der Figur auf einer Seite.
