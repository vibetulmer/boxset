# Boxset

Boxset ist deine persönliche Serien-App als installierbare Web-App (PWA). Jede Serie steht als DVD-Box im Regal, jede Staffel ist ein Rücken. Ungesehene Staffeln bleiben leere Hüllen.

- **Suchen**: jede Serie aus der TVmaze-Datenbank (rund 80.000), mit „Komplett gesehen“ in einem Tipp.
- **Durchswipen**: die ~3.000 beliebtesten Serien nacheinander, von den größten Hits abwärts. Rechts = gesehen, links = nie gesehen, hoch = Watchlist (auch per Knopf oder Pfeiltasten, mit Rückgängig).
- **Watchlist**: Serien per Lesezeichen vormerken, mit Restzeit. Komplett gesehene Serien wandern automatisch ins Regal.
- **Genau eintragen**: ganze Serie, einzelne Staffeln (Rücken antippen) oder einzelne Folgen.
- **Durchläufe**: „3× komplett gesehen“ pro Serie, auch pro Staffel, in halben Schritten (1,5×, 2,5×) für Schätzungen.
- **Zeit**: aus den echten Folgenlängen berechnet, pro Serie und insgesamt.
- **Wertung & Ranking**: 1–10 Punkte, daraus die Regalböden S (10), A (9), B (7–8), C (5–6), D (1–4).
- **Offline**: Regal, Ranking und Statistik funktionieren ohne Netz. Nur die Suche braucht Internet.

## Starten (lokal)

Node.js reicht, keine Installation von Paketen nötig:

```bash
node dev-server.mjs
```

Dann <http://localhost:5173> öffnen.

## Aufs Handy bringen

Die App läuft öffentlich auf GitHub Pages: **<https://vibetulmer.github.io/boxset/>** (Repository: <https://github.com/vibetulmer/boxset>).

Auf dem Handy die Adresse öffnen, dann *Zum Startbildschirm hinzufügen* (iPhone: Safari → Teilen-Menü; Android: Chrome-Menü → *App installieren*).

Hinweis: Jede Adresse hat ihren eigenen Speicher. Was du unter `localhost` eingetragen hast, ist auf der Pages-Adresse nicht da. Zum Umziehen: lokal unter *Daten* eine Sicherung herunterladen und auf der neuen Adresse wiederherstellen.

### Änderungen veröffentlichen

1. In `sw.js` die `VERSION` hochzählen (sonst zeigen installierte Apps die alte Version).
2. Committen und pushen:

```bash
git add -A && git commit -m "Beschreibung der Änderung" && git push
```

Nach etwa einer Minute ist die neue Version online. Installierte Apps holen sie beim übernächsten Öffnen.

## Deine Daten

Alles liegt nur im Browser auf dem jeweiligen Gerät (localStorage + IndexedDB). Handy und Laptop teilen also **nicht** automatisch denselben Stand. Unter **Daten** gibt es Export und Import als JSON-Datei für Backups und Gerätewechsel.

## Datenquelle und Lizenz

Seriendaten von [TVmaze](https://www.tvmaze.com/api), lizenziert unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de). Die Namensnennung steht in der App im Fußbereich und unter *Daten*. Für private, nicht-kommerzielle Nutzung ist das unproblematisch; die Lizenz würde sogar kommerzielle Nutzung erlauben, solange TVmaze genannt wird und abgeleitete Datensätze unter derselben Lizenz stehen. API-Limit: etwa 20 Abrufe pro 10 Sekunden, die App drosselt sich selbst.

Folgentitel sind meist im englischen Original.

### Swipe-Liste erweitern

`data/popular.json` ist eine aus TVmaze abgeleitete Liste der beliebtesten Serien (sortiert nach TVmaze-„weight“, dann Bewertung). Neu bauen oder vergrößern, z. B. auf 5.000 Serien (dauert ein paar Minuten wegen des API-Limits):

```bash
node scripts/build-popular.mjs 5000
```

Mit `--cached` wird der zuletzt geladene Gesamtindex wiederverwendet, ohne neu herunterzuladen. Die Datei steht wie die Quelle unter CC BY-SA 4.0.

## Aufbau

```
index.html            App-Hülle, Icons, Navigation
css/app.css           Gestaltung (Regal-Welt)
js/api.js             TVmaze-Zugriff mit Drosselung
js/store.js           deine Einträge + Serien-Cache
js/model.js           Berechnungen (Zeit, Durchläufe, Tiers)
js/views/*.js         Regal, Suche, Serie, Ranking, Statistik, Daten
sw.js                 Offline-Unterstützung
dev-server.mjs        lokaler Testserver
```

Nach Änderungen an Dateien: in `sw.js` die `VERSION` hochzählen, damit installierte Apps die neue Version laden.
