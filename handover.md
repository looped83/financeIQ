# FinanceIQ — Handover-Dokument

## Projektübersicht

**FinanceIQ** ist ein CSV-Analytics-Dashboard für die Analyse von Finanztransaktionen (Trade Republic, Sparkasse, DKB u.a.). Nach Abschluss der V2-Migration (Phase 0–5, siehe unten) ist die Anwendung eine typisierte, komponentenbasierte TypeScript-App, gebaut mit Vite, deployed über GitHub Actions auf GitHub Pages.

- **Sprache:** Deutsch (UI), `de-DE` Locale, Euro-Formatierung
- **Design:** Dark Theme, responsive (Flexbox/Grid)
- **Stack:** TypeScript, Vite, `lit-html` (~5kb, Template-Literal-basiert, kein virtuelles DOM), Chart.js + `chartjs-adapter-date-fns` (echte npm-Dependencies, nicht mehr CDN), Vitest
- **Deployment:** GitHub Pages via `.github/workflows/pages-vite.yml`, das bei jedem Push auf `main` baut und deployed. Pages-Source ist auf "GitHub Actions" umgestellt und **läuft produktiv** (verifiziert: Build+Deploy grün, App vom Nutzer live getestet und funktionsfähig bestätigt).

## Aktuelle Architektur (Stand nach Phase 5)

```
index.html                — dünne Shell: Upload-Screen-Markup, Topbar mit 11 Tab-Buttons,
                             11 leere <div id="tab-N"> Container, <style> (unverändert seit
                             vor der Migration), <script type="module" src="/src/main.ts">
src/
  main.ts                 — Einstiegspunkt: Store erzeugen, Upload/Drag&Drop/Reset verdrahten,
                             Tabs lazy mounten (beim ersten Klick), Sitzung beim Start
                             wiederherstellen (restoreSession)
  domain/                 — parseCSV, findCol, analyze, linReg, Formatierungs-Helper (fmt,
                             fmtP, mLabel, typeLabel, …) — reine, typisierte Funktionen, siehe
                             "Kernkonzepte" unten
  state/                  — appState.ts (AppState-Typ), appStore.ts (createAppStore → {store,
                             actions}), store.ts (generischer createStore<T>())
  features/<tab>/         — je Tab: selectors.ts (reine Chart-/KPI-/Tabellen-Logik, Vitest-
                             getestet) + <Tab>View.ts (lit-html-Komponente, abonniert den
                             Store). Tabs: overview, timeline, deepdive, yearly, monthly,
                             categories, outliers, forecast, compare, recommendations,
                             transactions
  features/shared/        — commonSelectors.ts (getTopMerchants, getRecurringExpenses —
                             von mehreren Tabs genutzt)
  charts/                 — chartTheme.ts (BASE/xScale/yScale/darkAxes), chartManager.ts
                             (mountChart(), WeakMap-basiert, registriert Chart.js + den
                             Datums-Adapter einmalig)
  persistence/             — IndexedDB-Sitzungspersistenz (siehe Phase 4 unten)
  dev/<tab>-preview.{html,ts} — 11 eigenständige Vite-Entry-Seiten zum isolierten Ausprobieren
                             einzelner Komponenten, ohne index.html anzurühren
test/fixtures/             — CSV-Fixtures für die Vitest-Suite
```

Jeder Tab folgt demselben Muster: `mount<Tab>View(container, store[, actions])` rendert einmalig und abonniert den Store für reaktive Re-Renders. `main.ts` mountet jeden Tab **lazy**, beim ersten Klick auf den jeweiligen Button — ein Chart.js-Canvas in einem `display:none`-Container zu mounten würde einen kaputten Chart mit Nullgröße erzeugen.

## Kernkonzepte (Datenmodell — `src/domain/analyze.ts`)

### Datenfluss

```
CSV-Upload → parseCSV(text) → rows[] → analyze(rows) → Analysis-Objekt → Store (via loadFile) → alle Tab-Views reaktiv
```

### Datumsfilter

Nur Transaktionen ab **01.01.2024** werden berücksichtigt (Konstante `MIN_DATE` in `analyze.ts`):
```ts
.filter(r => r._date !== null && r._date >= MIN_DATE)
```

### Brutto/Netto bei Dividenden, Zinsen, Steuerkorrekturen

Wichtig für jeden, der an `analyze()` arbeitet: Das `amount`-Feld vieler CSV-Exporte (z.B. Trade Republic) ist bei `DIVIDEND`/`INTEREST_PAYMENT`/`TAX_OPTIMIZATION`-Zeilen der **Bruttobetrag vor Steuerabzug** — die tatsächlich geflossene Summe ist `amount + tax` (tax trägt bereits das richtige Vorzeichen). Bei `BUY`/`SELL` bleibt `amount` unverändert (Kostenbasis/Erlös ohne Steuer/Gebühr, Gebühr wird separat in `totalFee` erfasst):

```ts
const amt = (isBuy || isSell) ? rawAmt : rawAmt + tax;
```

Als Konsequenz schließt `expCat` (Ausgaben nach Kategorie) Dividenden/Zinsen explizit aus, da vereinzelte Korrekturbuchungen (Storno einer Dividende) netto negativ sein können, ohne eine echte Ausgabenkategorie zu sein.

### Analysis-Objekt

`analyze()` liefert (typisiert in `src/domain/types.ts`):

- **Rohdaten:** `enriched`, `cash`, `inc`, `exp`, `buys`, `sells`, `divs`
- **Aggregate:** `totalInc`, `totalExp`, `totalInv`, `totalSold`, `totalDiv`, `netBal`, `totalFee`, `totalTax`
- **Zeitlich:** `months` (Objekt pro Monat), `mKeys` (sortierte Monats-Keys), `years`, `yKeys`
- **Kategorien:** `byType`, `byAsset`, `byAssetClass`, `expCat`, `merchants`
- **Statistik:** `outliers`, `subscriptions` (wiederkehrende Ausgaben), `avgInc`, `avgExp`, `avgNet`, `mean`, `std`, `mc`

### Enrichment-Felder (pro Transaktion)

`_amt`, `_fee`, `_tax`, `_date`, `_month`, `_year`, `_type`, `_cat`, `_name`, `_asset`, `_desc`, `_isBuy`, `_isSell`, `_isDiv`, `_isInterest`, `_isCard`

## Testing

- `npm test` — Vitest-Suite gegen `src/` (aktuell ~200 Tests). Das ist die einzige Regressionsabsicherung; die frühere `test:legacy`-Suite (VM-Sandbox gegen `index.html`s Inline-Script) wurde in Phase 5 entfernt, da es kein Inline-Script mehr gibt, gegen das sie laufen könnte.
- `npm run typecheck` — TypeScript-Check ohne Build (`tsc --noEmit`).
- Fixtures unter `test/fixtures/` decken u.a. ab: Datumsfilter, Brutto/Netto-Dividendenlogik, Korrekturbuchungen, BUY/SELL-Gebührenbehandlung, deutsche CSV-Spaltennamen mit Semikolon-Trennung.
- Vor jedem Merge auf `main`: `npm run typecheck && npm test && npm run build` — der Workflow `.github/workflows/pages-vite.yml` führt genau das bei jedem Push auf `main` aus, bevor deployed wird.

## V2-Migration — Historie (Phase 0–5, abgeschlossen)

Ziel war ein schrittweiser Umbau von einer Single-File-Inline-Script-App auf TypeScript + Komponenten + State-Store, ohne die laufende GitHub-Pages-Auslieferung zwischenzeitlich zu gefährden (Strangler-Fig-Ansatz — bei jedem Zwischenschritt blieb `dist/index.html` byte-identisch zum bisherigen Original, bis Phase 5 den bewussten Cutover vollzog).

- **Phase 0 (fertig):** Vite + TypeScript-Build-Pipeline. `vite.config.ts`, `tsconfig.json`, Workflow `.github/workflows/pages-vite.yml` (zunächst nur `workflow_dispatch`, ersetzte die damalige Pages-Deployment noch nicht). `npm run build` erzeugte eine zur damaligen `index.html` byte-identische `dist/index.html`.
- **Phase 1 (fertig):** Domain-Layer (`parseCSV`, `findCol`, `analyze`, `linReg`, Formatierungs-Helper) nach `src/domain/*.ts` portiert, typisiert, mit Vitest-Unit-Tests. `index.html` blieb dabei zunächst unangetastet (bewusste, befristete Dopplung der Logik).
- **Phase 2 (fertig):** Typisierter State-Store in `src/state/` als Ersatz für die früheren `G`/`MC`/`TX`-Globals:
  - `store.ts` — generisches, framework-loses `createStore<T>()` (get/set/subscribe)
  - `appState.ts` — `AppState`-Typ + `initialAppState()`
  - `appStore.ts` — `createAppStore()` liefert `{ store, actions }`; Actions bilden die damaligen Verhaltensdetails 1:1 nach (z.B. dass `cmpMetric`/`compare.metric` beim Laden/Zurücksetzen einer Vergleichsdatei **nicht** zurückgesetzt wird, nur `resetAll()` tut das; jede Filter-/Sortierungsänderung bei Transaktionen setzt die Pagination auf Seite 0 zurück)
- **Phase 3 (fertig, alle 11 Tabs):** Tabs einzeln auf lit-html-Komponenten umgestellt (Details zu jedem Tab siehe README.md — dort bleibt die Tab-für-Tab-Beschreibung ausführlich erhalten). Bemerkenswert:
  - **Zeitverlauf-Tab nachträglich ergänzt:** beim Vorbereiten von Phase 5 fiel auf, dass er in Phase 3 versehentlich übersprungen worden war (`timelineView`/`setTimelineView` existierten im Store bereits, aber keine Komponente konsumierte sie). Nachgeholt inkl. Tests, bevor der Cutover stattfand.
  - `chart.js` wurde zur echten npm-Dependency (`Chart.register(...registerables)` statt CDN-Global).
  - Mehrere faithful-port-Eigenheiten des Originals bewusst 1:1 übernommen und im Code dokumentiert (z.B. `!a1.expCat[c]`-Falsy-Check statt Key-Existence-Check beim Vergleichs-Tab; `!prev`-Check statt reinem Null-Check bei Deep-Dive-Deltas).
- **Phase 4 (fertig):** IndexedDB-Sitzungspersistenz in `src/persistence/` — echte neue Funktionalität, die es im Original nicht gab: ein Seiten-Reload verliert die hochgeladene(n) CSV(s) nicht mehr. Speichert bewusst den rohen CSV-Text (nicht die fertige `Analysis`), damit ein Restore immer durch dieselbe `parseCSV`+`analyze`-Pipeline läuft wie ein echter Upload.
- **Phase 5 (fertig): Cutover.** `index.html` enthält keine Inline-Logik mehr: das frühere ~1.650-Zeilen-`<script>`-Block sowie die handgeschriebene Pro-Tab-Markup aller 11 Tabs sind weg, ersetzt durch 11 leere `<div id="tab-N">`-Container und ein einziges `<script type="module" src="/src/main.ts">`. Die Chart.js-CDN-`<script>`-Tags sind ebenfalls weg. **Hier endete bewusst die bis dahin durchgehaltene "`dist/index.html` bleibt byte-identisch"-Garantie** — die galt nur, solange `src/` noch unverdrahtete Parallel-Infrastruktur war.
  - **Bug gefunden und behoben bei der Cutover-Verifikation:** `mountDeepDiveView` wählt automatisch den letzten Monat, falls noch keiner gewählt ist, per Selbst-Trigger (`actions.setDeepDiveMonth()` aus der eigenen Render-Funktion heraus, verlässt sich auf synchrones Re-Notify desselben Subscribers). Das funktioniert nur, wenn die View schon subscribed hat, BEVOR sie zum ersten Mal rendert — traf auf jede isolierte Dev-Preview/Vitest-Situation zu, aber nicht mehr, wenn ein Tab lazy gemountet wird, NACHDEM Daten schon geladen sind (genau der Fall beim ersten echten Klick auf Deep-Dive im Cutover-Build). Fix: in `DeepDiveView.ts` wird jetzt vor dem ersten Render subscribed. Gefunden durch einen Playwright-Durchlauf durch alle 11 Tabs gegen den echten gebauten `index.html` — ein Integrationsfehler, den isoliertes Pro-Tab-Testen strukturell nicht sehen konnte.
  - `test:legacy` (VM-Sandbox gegen `index.html`s Inline-Script) entfernt — `npm test` ist seither nur noch die Vitest-Suite.
  - PR #33 gemerged, Actions-Workflow lief grün (Build **und** Deploy erfolgreich) — Pages-Source war zu dem Zeitpunkt bereits auf "GitHub Actions" gestellt.

### Post-Cutover-Fix: CSV-Upload-Fehler sichtbar machen (PR #34)

Kurz nach dem Live-Gang meldete der Nutzer: "Wenn ich die Seite öffne und eine CSV hochlade, kommt gar nichts." Befund: Falls `parseCSV()`/`analyze()` für eine reale CSV-Datei eine Exception wirft, brach `main.ts`s `loadPrimaryFile()` vorher ab, ohne den Upload-Screen je auszublenden — die App wirkte komplett unresponsive, ohne jede Fehlermeldung. Fix: der Parse-/Analyse-Schritt ist jetzt in `try/catch` gewrappt; im Fehlerfall erscheint ein `alert()` mit der Fehlermeldung (zusätzlich in die Konsole geloggt). PR #34 gemerged, Nutzer hat danach bestätigt: **"Jetzt klappt alles"** — die App läuft produktiv fehlerfrei.

## Ursprüngliche Architektur (vor der Migration — historische Referenz)

Vor Phase 5 war `index.html` eine Single-File-App (HTML + CSS + Inline-`<script>`, ~2.200 Zeilen, Chart.js via CDN). Zur Einordnung, falls alte Commits/PRs referenziert werden:

- **Globaler State:** `G` (Haupt-State: `rows`, `a`, `charts`, `fcMonths`, `tlView`, `cmpData`, `cmpMetric`, `fileName`), `MC` (Deep-Dive: `snapshots[]`, `months[]`, `selectedMonth`), `TX` (Transaktionen: `all`, `filtered[]`, `page`, `perPage`)
- **Tab-Reihenfolge:** 0 Übersicht, 1 Zeitverlauf, 2 Deep-Dive, 3 Jahre, 4 Monate, 5 Kategorien, 6 Ausreißer, 7 Prognose, 8 Vergleich, 9 Empfehlungen, 10 Transaktionen — dieselbe Reihenfolge gilt unverändert für die heutigen `tab-N`-Container und Store-Module
- **Lazy Rendering:** Tabs wurden erst beim ersten Klick gerendert (`rendered`-Set + `TAB_FNS`-Array) — dasselbe Prinzip gilt heute für das lazy Mounting in `main.ts`
- Alle domänenspezifischen Konzepte (Datumsfilter, Brutto/Netto-Logik, Analysis-Felder) sind unverändert in den heutigen Code portiert — siehe "Kernkonzepte" oben, das ist keine separate Historie, sondern durchgehend gültig.

## Wichtige Hinweise

- **Wording:** "Wiederkehrende Ausgaben" statt "Abos/Abonnements" — bewusste Entscheidung
- **CSV-Kompatibilität:** Trade Republic, Sparkasse, DKB und weitere (automatische Spalten-Erkennung über `findCol()`)
- **`data/`-Verzeichnis:** Enthält monatliche CSV-Snapshots, wird vom Deep-Dive-Tab nicht mehr genutzt (Legacy) — Deep-Dive arbeitet direkt mit den Monaten der hochgeladenen CSV

## Offene PRs

Keine offenen PRs — der aktuelle Stand von `main` enthält Phase 0–5 der V2-Migration sowie den Post-Cutover-Fix (PR #34), alles gemerged und live deployed.
