# FinanceIQ — Handover-Dokument

## Projektübersicht

**FinanceIQ** ist ein CSV-Analytics-Dashboard für die Analyse von Finanztransaktionen (Trade Republic, Sparkasse, DKB u.a.). Nach Abschluss der V2-Migration (Phase 0–5) und anschließendem UI-Refactoring ist die Anwendung eine typisierte, komponentenbasierte TypeScript-App, gebaut mit Vite, deployed über GitHub Actions auf GitHub Pages.

- **Sprache:** Deutsch (UI), `de-DE` Locale, Euro-Formatierung
- **Design:** Dark Theme, responsive (Flexbox/Grid)
- **Stack:** TypeScript, Vite, `lit-html` (~5kb, Template-Literal-basiert, kein virtuelles DOM), Chart.js + `chartjs-adapter-date-fns` (echte npm-Dependencies, nicht mehr CDN), Vitest
- **Deployment:** GitHub Pages via `.github/workflows/pages-vite.yml`, das bei jedem Push auf `main` baut und deployed. Pages-Source ist auf "GitHub Actions" umgestellt und **läuft produktiv** (verifiziert: Build+Deploy grün, App vom Nutzer live getestet und funktionsfähig bestätigt).

## Aktuelle Architektur (Stand nach UI-Refactoring)

```
index.html                — dünne Shell: Upload-Screen-Markup, Topbar mit 10 Tab-Buttons,
                             10 leere <div id="tab-N"> Container, <style>, 
                             <script type="module" src="/src/main.ts">
src/
  main.ts                 — Einstiegspunkt: Store erzeugen, Upload/Drag&Drop/Reset verdrahten,
                             Tabs lazy mounten (beim ersten Klick), Sitzung beim Start
                             wiederherstellen (restoreSession).
                             TAB_LOADERS-Array mit 10 Einträgen, Index = tab-N ID.
  domain/                 — parseCSV, findCol, analyze, linReg, Formatierungs-Helper (fmt,
                             fmtP, fmtPP, mLabel, typeLabel, …) — reine, typisierte Funktionen
  state/                  — appState.ts (AppState-Typ), appStore.ts (createAppStore → {store,
                             actions}), store.ts (generischer createStore<T>())
  features/<tab>/         — je Tab: selectors.ts (reine Chart-/KPI-/Tabellen-Logik, Vitest-
                             getestet) + <Tab>View.ts (lit-html-Komponente, abonniert den
                             Store). Aktive Tabs:
                               overview, timeline, yearly, monthly, monthcompare,
                               categories, outliers, forecast, recommendations, transactions
                             Entfernte/zusammengeführte Tabs:
                               deepdive (in overview integriert, selectors.ts wird noch
                                 von overview und monthly importiert)
                               compare (komplett entfernt aus TAB_LOADERS, Code noch vorhanden)
  features/shared/        — commonSelectors.ts (getTopMerchants, getRecurringExpenses,
                             getFixedCostNames — von mehreren Tabs genutzt)
  charts/                 — chartTheme.ts (BASE/xScale/yScale/darkAxes), chartManager.ts
                             (mountChart(), WeakMap-basiert, registriert Chart.js + den
                             Datums-Adapter einmalig)
  persistence/            — IndexedDB-Sitzungspersistenz (siehe Phase 4 unten)
  styles/                 — base.css (CSS-Variablen: --text, --text-muted, --text-dim)
  dev/<tab>-preview.{html,ts} — eigenständige Vite-Entry-Seiten zum isolierten Ausprobieren
                             einzelner Komponenten
test/fixtures/            — CSV-Fixtures für die Vitest-Suite
```

### Tab-Reihenfolge (10 Tabs)

| Index | Tab-Button       | Modul                    |
|-------|------------------|--------------------------|
| 0     | Übersicht        | overview/OverviewView    |
| 1     | Zeitverlauf      | timeline/TimelineView    |
| 2     | Jahre            | yearly/YearlyView        |
| 3     | Monate           | monthly/MonthlyView      |
| 4     | Monatsvergleich  | monthcompare/MonthCompareView |
| 5     | Kategorien       | categories/CategoriesView |
| 6     | Ausreißer        | outliers/OutliersView    |
| 7     | Prognose         | forecast/ForecastView    |
| 8     | Empfehlungen     | recommendations/RecommendationsView |
| 9     | Transaktionen    | transactions/TransactionsView |

Jeder Tab folgt demselben Muster: `mount<Tab>View(container, store[, actions])` rendert einmalig und abonniert den Store für reaktive Re-Renders. `main.ts` mountet jeden Tab **lazy**, beim ersten Klick auf den jeweiligen Button — ein Chart.js-Canvas in einem `display:none`-Container zu mounten würde einen kaputten Chart mit Nullgröße erzeugen.

## UI-Refactoring (Post-Migration)

### Übersicht-Tab: Deep-Dive-Integration & Streamlining

- **Deep-Dive-Tab in Übersicht integriert:** Net-Cashflow & Sparquote-Chart, kumulierter Saldo, Kategorie-Stack, Trends & Muster, beste/schlechteste Monate — alles jetzt Teil der Übersicht
- **Redundante Sektionen zusammengeführt:** "Trends & Muster" + "Auffälligkeiten" → eine Kachel; "Sparquote-Chart" + "Netto-Cashflow & Sparquote" → eine Kachel
- **"Größte Einzeltransaktionen" entfernt** (war redundant mit Transaktionen-Tab)
- **Neuer "Monatlicher Trend"-Chart** als Ersatz für die weggefallene Kachel (Balkendiagramm mit Einnahmen/Ausgaben/Netto über alle Monate, nutzt `getAllMonthsTrendData` aus `overview/selectors.ts`)
- **"Monatliche Detailübersicht"** nach Monate-Tab verschoben

### Einheitliches Tabellen-Schema

Alle Detail-Tabellen folgen dem gleichen Schema mit Delta-Pfeilen (▲/▼):

- **Monate → "Monatliche Detailübersicht":** Spalten Monat, Einnahmen (▲/▼), Ausgaben (▲/▼), Netto, Sparquote, Dividenden, Investiert, Karten-Tx, Gesamt-Tx. Nutzt `buildMonthlySnapshots` und `computeDetailTableRows` aus `deepdive/selectors.ts`. Zeilen-Highlighting für besten/schlechtesten Monat (`row-best`/`row-worst`).
- **Jahre → "Jahres-Übersicht":** Einnahmen (▲/▼ YoY) und Ausgaben (▲/▼ YoY). Gebühren in `var(--text-muted)`.
- **Monatsvergleich → "Detailvergleich":** Fettgedruckte Labels, Werte in `var(--text-dim)`, Delta-Spalte mit ▲/▼-Pfeilen.

### Monatsvergleich-Tab: Detailsektionen

Zwischen der Erkenntnisse/Kategorie-Zeile und dem Detailvergleich rendert der Tab fünf datenreiche Vergleichssektionen (Selektoren in `monthcompare/selectors.ts`):

1. **Händler-Vergleich** (`getMerchantComparison`) — Top-Händler mit Anzahl, Summe und Delta pro Monat, inkl. visueller Balken.
2. **Neue & weggefallene Händler** (`getUniqueMerchants`) — Händler, die nur in einem der beiden Monate auftauchen.
3. **Top-Einzelausgaben** (`getTopSingleExpenses`) — größte Einzeltransaktionen je Monat mit Datum.
4. **Dividenden-Vergleich** (`getDividendComparison`) — Ausschüttungen (Anzahl) und Dividendensumme je Monat mit Delta (Netto, siehe Dividenden-Abschnitt unten).
5. **Wiederkehrende Ausgaben** (`getRecurringExpensesDelta`) — geteilte Fixkosten beider Monate mit Delta, nutzt `getFixedCostNames`.

### Zeitverlauf-Tab: zwei zusätzliche Charts

- **Ausgaben nach Top-Händlern** (Stacked Bar, `getMerchantTimelineData`) — die 6 größten Händler nach Ausgaben, gestapelt über alle Monate.
- **Fixkosten vs. variable Ausgaben** (Stacked Bar, `getFixVarTimelineData`) — trennt monatliche Ausgaben in Fixkosten (blau) und Variable (bernstein) anhand von `getFixedCostNames`.

### Fixkosten-Erkennung (`getFixedCostNames` in `commonSelectors.ts`)

Ein Händler gilt als **Fixkosten**, wenn er (1) in mindestens 3 Monaten als Ausgabe auftaucht **und** (2) sein Monatsbetrag stabil ist (Variationskoeffizient std/mean ≤ 0,30). Damit werden Miete, Versicherungen, Fitness, Strom, Handy erfasst, während häufige aber schwankende Ausgaben (Supermärkte, Drogerien, Amazon) korrekt als variabel gelten. Der Schwellwert wurde an echten Daten kalibriert: Miete/Versicherung/Fitness liegen bei CV 0,0–0,22, Supermärkte/Shopping bei 0,39+.

### Vergleich-Tab entfernt

Der eigenständige CSV-Vergleich-Tab wurde komplett entfernt (Button, Content-Div, TAB_LOADER-Eintrag). Die Monatsvergleich-Funktionalität deckt den Anwendungsfall ab. Der Feature-Code unter `features/compare/` existiert noch im Dateisystem, wird aber nicht mehr geladen.

### Weitere UI-Verbesserungen

- **Emojis entfernt** aus allen Tab-Buttons
- **Nav-Schriftgröße erhöht** auf `.85rem`
- **Kontrast verbessert:** CSS-Variablen `--text:#f1f5f9; --text-muted:#8b9bb5; --text-dim:#b0bfd0;` und Chart-Achsen-Farben angepasst (in `chartTheme.ts` und `base.css`)
- **Transaktionen:** Filter/Sort-Controls in den Card-Header integriert (neben Suche), eigene CSS-Klassen `.tx-input`/`.tx-select`

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

### Dividenden kommen netto an — keine Steuer-Ausweisung

Wichtig für jeden, der an `analyze()` arbeitet: Bei `DIVIDEND`/`INTEREST_PAYMENT`/`TAX_OPTIMIZATION`-Zeilen ist das `amount`-Feld der Betrag vor Steuerabzug; die tatsächlich geflossene Summe ist `amount + tax` (tax trägt bereits das richtige Vorzeichen). Bei `BUY`/`SELL` bleibt `amount` unverändert (Kostenbasis/Erlös ohne Steuer/Gebühr, Gebühr wird separat in `totalFee` erfasst):

```ts
const amt = (isBuy || isSell) ? rawAmt : rawAmt + tax;
```

`_amt` ist damit durchgängig der **netto zugeflossene Betrag**. Da die Dividenden bereits mit Steuerabzug ankommen, wird die Steuer **nirgends mehr separat ausgewiesen** — Brutto/Steuer/Netto-Aufschlüsselungen wurden seitenweit entfernt (Kategorien, Jahre, Monate, Monatsvergleich, Übersicht-Kennzahlen, Empfehlungen). Es gibt daher kein `totalTax` mehr und `YearAgg`/`ByAssetAgg` tragen kein `tax`-Feld. Dividenden werden überall nur noch als Nettobetrag angezeigt.

Als Konsequenz schließt `expCat` (Ausgaben nach Kategorie) Dividenden/Zinsen explizit aus, da vereinzelte Korrekturbuchungen (Storno einer Dividende) netto negativ sein können, ohne eine echte Ausgabenkategorie zu sein.

### Händlername aus Beschreibung ableiten

Banküberweisungen (Miete, Versicherung, Nebenkosten) kommen oft mit leerem `name`-Feld an — der Empfänger steht nur in der Beschreibung (z.B. `"Outgoing transfer for Jens Spitzner (DE47…)"` oder `"Sepa Direct Debit transfer to Vodafone GmbH (DE13…)"`). `analyze()` extrahiert den Empfänger per `payeeFromDescription()` aus der Beschreibung, wenn die Namensspalte leer ist. Ohne das würden diese wiederkehrenden Kosten in einem namenlosen „Sonstiges"-Topf zusammenfallen und die Fixkosten-Erkennung in den frühen Monaten (Überweisungen statt benannter Buchungen) zu niedrig ausfallen. Da dies auf der Domain-Ebene passiert, profitieren Händlerlisten, Vergleiche und Fixkosten-Erkennung gleichermaßen.

### Analysis-Objekt

`analyze()` liefert (typisiert in `src/domain/types.ts`):

- **Rohdaten:** `enriched`, `cash`, `inc`, `exp`, `buys`, `sells`, `divs`
- **Aggregate:** `totalInc`, `totalExp`, `totalInv`, `totalSold`, `totalDiv`, `netBal`, `totalFee`
- **Zeitlich:** `months` (Objekt pro Monat), `mKeys` (sortierte Monats-Keys), `years`, `yKeys`
- **Kategorien:** `byType`, `byAsset`, `byAssetClass`, `expCat`, `merchants`
- **Statistik:** `outliers`, `subscriptions` (wiederkehrende Ausgaben), `avgInc`, `avgExp`, `avgNet`, `mean`, `std`, `mc`

### Enrichment-Felder (pro Transaktion)

`_amt`, `_fee`, `_tax`, `_date`, `_month`, `_year`, `_type`, `_cat`, `_name`, `_asset`, `_desc`, `_isBuy`, `_isSell`, `_isDiv`, `_isInterest`, `_isCard`

## Testing

- `npm test` — Vitest-Suite gegen `src/` (aktuell 221 Tests, 20 Test-Dateien). Das ist die einzige Regressionsabsicherung.
- `npm run typecheck` — TypeScript-Check ohne Build (`tsc --noEmit`).
- Fixtures unter `test/fixtures/` decken u.a. ab: Datumsfilter, Netto-Dividendenlogik (`amount + tax`), Korrekturbuchungen, BUY/SELL-Gebührenbehandlung, deutsche CSV-Spaltennamen mit Semikolon-Trennung.
- Vor jedem Merge auf `main`: `npm run typecheck && npm test && npm run build` — der Workflow `.github/workflows/pages-vite.yml` führt genau das bei jedem Push auf `main` aus, bevor deployed wird.

## V2-Migration — Historie (Phase 0–5, abgeschlossen)

Ziel war ein schrittweiser Umbau von einer Single-File-Inline-Script-App auf TypeScript + Komponenten + State-Store, ohne die laufende GitHub-Pages-Auslieferung zwischenzeitlich zu gefährden (Strangler-Fig-Ansatz — bei jedem Zwischenschritt blieb `dist/index.html` byte-identisch zum bisherigen Original, bis Phase 5 den bewussten Cutover vollzog).

- **Phase 0 (fertig):** Vite + TypeScript-Build-Pipeline.
- **Phase 1 (fertig):** Domain-Layer nach `src/domain/*.ts` portiert, typisiert, mit Vitest-Unit-Tests.
- **Phase 2 (fertig):** Typisierter State-Store in `src/state/`.
- **Phase 3 (fertig, alle Tabs):** Tabs einzeln auf lit-html-Komponenten umgestellt. Chart.js wurde zur echten npm-Dependency.
- **Phase 4 (fertig):** IndexedDB-Sitzungspersistenz in `src/persistence/`.
- **Phase 5 (fertig): Cutover.** `index.html` enthält keine Inline-Logik mehr. PR #33 gemerged.

### Post-Cutover-Fix (PR #34)

CSV-Upload-Fehler sichtbar gemacht: Falls `parseCSV()`/`analyze()` eine Exception wirft, erscheint jetzt ein `alert()` mit der Fehlermeldung.

## Wichtige Hinweise

- **Wording:** "Wiederkehrende Ausgaben" statt "Abos/Abonnements" — bewusste Entscheidung
- **CSV-Kompatibilität:** Trade Republic, Sparkasse, DKB und weitere (automatische Spalten-Erkennung über `findCol()`)
- **`data/`-Verzeichnis:** Enthält monatliche CSV-Snapshots (Legacy) — nicht mehr aktiv genutzt
- **`features/deepdive/`:** Selectors werden noch von `overview/` und `monthly/` importiert (`buildMonthlySnapshots`, `computeDetailTableRows`). Die View-Datei wird nicht mehr gemountet.
- **`features/compare/`:** Code noch vorhanden, aber nicht mehr in TAB_LOADERS referenziert und kein Tab-Button mehr in `index.html`.

## PR-Historie (chronologisch)

| PR  | Beschreibung |
|-----|-------------|
| #33 | Phase 5 Cutover — Inline-Script entfernt |
| #34 | Post-Cutover-Fix: CSV-Upload-Fehler sichtbar machen |
| #40 | Deep-Dive in Übersicht integriert, Emojis entfernt (gemerged) |
| #46 | Tabellen vereinheitlicht, Detail-Tabelle nach Monate, Vergleich-Tab entfernt; Monatsvergleich-Detailsektionen + Zeitverlauf-Charts (Top-Händler, Fixkosten vs. Variable); Dividenden-Steuer seitenweit entfernt; CV-basierte Fixkosten-Erkennung + Empfänger-Extraktion aus Beschreibung (offen) |
