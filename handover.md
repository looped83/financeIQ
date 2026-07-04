# FinanceIQ — Handover-Dokument

## Projektübersicht

**FinanceIQ** ist ein Single-File CSV-Analytics-Dashboard (`index.html`, ~2.200 Zeilen) für die Analyse von Finanztransaktionen. Kein Build-System, kein Framework — reines HTML/CSS/JS mit Chart.js (CDN).

- **Sprache:** Deutsch (UI), `de-DE` Locale, Euro-Formatierung
- **Design:** Dark Theme, responsive (Flexbox/Grid)
- **Externe Abhängigkeiten:** Chart.js 4.4.4, chartjs-adapter-date-fns 3.0.0 (beide via CDN)
- **Deployment:** GitHub Pages (automatisch via GitHub Actions bei Push auf `main`)

## Architektur

### Dateistruktur

```
index.html          — Gesamte Anwendung (HTML + CSS + JS)
handover.md         — Dieses Dokument
data/
  months.json       — Manifest für monatliche CSV-Snapshots (Legacy, nicht mehr für Deep-Dive genutzt)
  2026-01.csv       — Monatliche CSV-Dateien (Jan–Jun 2026)
  ...
  2026-06.csv
```

### Aufbau von index.html

| Bereich        | Zeilen (ca.) | Inhalt                                                    |
|----------------|-------------|-----------------------------------------------------------|
| CSS            | 1–141       | CSS-Variablen, Komponenten-Styles (KPI, Cards, Tables…)   |
| HTML Upload    | 145–161     | Upload-Screen mit Drag & Drop                             |
| HTML Dashboard | 163–550     | Topbar + 11 Tab-Content-Divs (tab-0 bis tab-10)           |
| JS State       | ~514        | Globaler State `G`, `MC`, `TX`                            |
| JS CSV Parser  | ~518–540    | `parseCSV()` mit Auto-Delimiter-Erkennung                 |
| JS Analyse     | ~551–692    | `analyze()` — Enrichment, Aggregation, Kennzahlen         |
| JS Helpers     | ~694–720    | `fmt()`, `fmtP()`, `mLabel()`, `typeLabel()`, Chart-Utils |
| JS Tabs        | ~722–2100   | Render-Funktionen für alle 11 Tabs                        |
| JS Navigation  | ~2100–2120  | `showTab()`, `initDashboard()`, `resetDashboard()`        |
| JS Init        | ~2130–2150  | File-Input, Drag & Drop Event-Listener                    |

### Tab-Reihenfolge (Navigation)

| Index | Name          | Button-Label      | Render-Funktion              |
|-------|--------------|-------------------|------------------------------|
| 0     | Übersicht     | 📊 Übersicht      | `renderOverview(a)`           |
| 1     | Zeitverlauf   | 📈 Zeitverlauf    | `renderTimeline(a)`           |
| 2     | Deep-Dive     | 🔍 Deep-Dive      | `renderMonthlyComparison(a)`  |
| 3     | Jahre         | 📆 Jahre          | `renderYearly(a)`             |
| 4     | Monate        | 📅 Monate         | `renderMonthly(a)`            |
| 5     | Kategorien    | 🏷️ Kategorien     | `renderCategories(a)`         |
| 6     | Ausreißer     | ⚠️ Ausreißer      | `renderOutliers(a)`           |
| 7     | Prognose      | 🔮 Prognose       | `renderForecast(a)`           |
| 8     | Vergleich     | ⚖️ Vergleich      | `null` (Upload-basiert)       |
| 9     | Empfehlungen  | 💡 Empfehlungen   | `renderRecommendations(a)`    |
| 10    | Transaktionen | 📋 Transaktionen  | `renderTransactions(a)`       |

### Lazy Rendering

Tabs werden erst beim ersten Klick gerendert (`rendered` Set + `TAB_FNS` Array). `showTab(i)` toggelt CSS-Klassen und ruft die Render-Funktion einmalig auf.

## Kernkonzepte

### Datenfluss

```
CSV-Upload → parseCSV(text) → rows[] → analyze(rows) → G.a (Analysis-Objekt) → Tab-Render
```

### Globaler State

- **`G`** — Haupt-State: `rows`, `a` (Analysis), `charts`, `fcMonths`, `tlView`, `cmpData`, `cmpMetric`, `fileName`
- **`MC`** — Deep-Dive State: `snapshots[]`, `months[]`, `selectedMonth`
- **`TX`** — Transaktionen State: `all`, `filtered[]`, `page`, `perPage` (50)

### Datumsfilter

In `analyze()` werden nur Transaktionen ab **01.01.2024** berücksichtigt (Konstante `MIN_DATE`):
```js
.filter(r => r._date && r._date >= MIN_DATE)
```

### Brutto/Netto bei Dividenden, Zinsen, Steuerkorrekturen

Wichtig für jeden, der an `analyze()` arbeitet: Das `amount`-Feld vieler CSV-Exporte (z.B. Trade Republic) ist bei `DIVIDEND`/`INTEREST_PAYMENT`/`TAX_OPTIMIZATION`-Zeilen der **Bruttobetrag vor Steuerabzug** — die tatsächlich geflossene Summe ist `amount + tax` (tax trägt bereits das richtige Vorzeichen). Bei `BUY`/`SELL` bleibt `amount` unverändert (Kostenbasis/Erlös ohne Steuer/Gebühr, Gebühr wird separat in `totalFee` erfasst). Deshalb:

```js
const amt = (isBuy||isSell) ? rawAmt : rawAmt + tax;
```

Als Konsequenz: `expCat` (Ausgaben-nach-Kategorie) schließt Dividenden/Zinsen explizit aus, da vereinzelte Korrekturbuchungen (Storno einer Dividende) netto negativ sein können, ohne eine echte Ausgabenkategorie zu sein.

### Analysis-Objekt (`G.a`)

`analyze()` liefert ein umfangreiches Objekt mit:

- **Rohdaten:** `enriched`, `cash`, `inc`, `exp`, `buys`, `sells`, `divs`
- **Aggregate:** `totalInc`, `totalExp`, `totalInv`, `totalSold`, `totalDiv`, `netBal`, `totalFee`, `totalTax`
- **Zeitlich:** `months` (Objekt pro Monat), `mKeys` (sortierte Monats-Keys), `years`, `yKeys`
- **Kategorien:** `byType`, `byAsset`, `byAssetClass`, `expCat`, `merchants`
- **Statistik:** `outliers`, `subscriptions` (wiederkehrende Ausgaben), `avgInc`, `avgExp`, `avgNet`, `mean`, `std`, `mc`

### Enrichment-Felder (pro Transaktion)

`_amt`, `_fee`, `_tax`, `_date`, `_month`, `_year`, `_type`, `_cat`, `_name`, `_asset`, `_desc`, `_isBuy`, `_isSell`, `_isDiv`, `_isInterest`, `_isCard`

### Deep-Dive (Tab 2)

Nutzt `buildMCFromCSV(a)` um die Monate der hochgeladenen CSV einzeln zu analysieren. Speichert Snapshots in `MC.snapshots[]`. Jeder Snapshot enthält `{ month, analysis }`. Der Deep-Dive zeigt:

- KPIs (Gesamteinnahmen, -ausgaben, Netto, Sparquote, Dividenden, letzter Monat)
- 4 Charts (Einnahmen vs. Ausgaben, Netto + Sparquote, Kumuliert, Kategorien gestapelt)
- Vormonats-Vergleich (Dropdown-Auswahl)
- Verbessert/Verschlechtert, Beste/Schlechteste Monate
- Trends & Muster, Handlungsbedarf, Empfehlungen
- Monatliche Detailübersicht (Tabelle am Seitenende)

### Transaktionen (Tab 10)

Zeigt alle Transaktionen in einer filterbaren, paginierten Tabelle:

- **KPIs oben:** Einnahmen, Ausgaben, Investitionen, Dividenden (aktualisieren sich dynamisch mit Filtern)
- **Filter:** Jahr, Monat, Zeitraum (von/bis Datum), Kategorie
- **Textsuche:** Durchsucht Name, Beschreibung, Typ und Kategorie
- **Sortierung:** Datum (auf/ab), Betrag (auf/ab)
- **Pagination:** 50 Einträge pro Seite mit Seitennavigation
- **Funktionen:** `renderTransactions(a)`, `applyTxFilters()`, `renderTxKpis()`, `renderTxPage()`, `txPage()`, `resetTxFilters()`

### Empfehlungen (Tab 9)

~15 kategorisierte Empfehlungen mit Prioritäten und Farb-Badges:

| Kategorie    | Themen                                            |
|-------------|---------------------------------------------------|
| Cashflow    | Positiv/Negativ-Status                             |
| Sparen      | Sparquote in 4 Stufen (<10%, 10-20%, 20-35%, 35%+)|
| Investieren | Investitionsrate                                   |
| Dividenden  | Portfolio-Wachstum, Klumpenrisiko                  |
| Kosten      | Gebührenquote                                      |
| Steuern     | Freistellungsauftrag (2.000€)                      |
| Ausgaben    | Großausgaben, Händler-Konzentration                |
| Fixkosten   | Wiederkehrende Ausgaben                            |
| Stabilität  | Cashflow-Volatilität                               |
| Portfolio   | Diversifikation                                    |
| Verhalten   | Kartenzahlungen, Wochenend-Ausgaben                |
| Rücklage    | Notfallrücklage-Rechner                            |
| Trend       | 3-Monats-Trends                                    |

### Vergleich (Tab 8)

Erlaubt Upload einer zweiten CSV für direkten Vergleich (z.B. Vorjahr). Zeigt monatliche Deltas, Kategorie-Vergleiche und automatische Erkenntnisse.

## Chart-Helpers

- `mkChart(id, cfg)` — Erstellt/ersetzt Chart.js-Instanz, speichert in `G.charts[id]`
- `dChart(id)` — Zerstört Chart
- `darkAxes()`, `xScale()`, `yScale()` — Vorkonfigurierte Achsen-Styles
- `BASE` — Basis-Options für alle Charts
- `PAL` — 12-Farben-Palette

## Formatierungs-Helpers

| Funktion  | Ausgabe                       | Beispiel            |
|-----------|-------------------------------|---------------------|
| `fmt(v)`  | Euro mit 2 Dezimalen          | `1.234,56 €`        |
| `fmtN(v)` | Ganzzahl mit Tausender        | `1.235`             |
| `fmtP(v)` | Prozent mit 1 Dezimale        | `23,4%`             |
| `fmtPP(v)`| Prozent mit Vorzeichen        | `+5,2%`             |
| `fmtD(d)` | Datum deutsch                 | `15.03.2026`        |
| `mLabel(mk)` | Monatskürzel              | `Mär 26`            |

## Wichtige Hinweise

- **Wording:** "Wiederkehrende Ausgaben" statt "Abos/Abonnements" — bewusste Entscheidung
- **Header:** Einzeilig — Logo + Tab-Navigation + "Neue Datei" in einer Zeile
- **Kein Dateiname-Hinweis** im Header (entfernt)
- **CSV-Kompatibilität:** Trade Republic, Sparkasse, DKB und weitere (automatische Spalten-Erkennung)
- **`data/`-Verzeichnis:** Enthält monatliche CSV-Snapshots, wird aber vom Deep-Dive nicht mehr genutzt (Legacy). Deep-Dive arbeitet direkt mit den Monaten der hochgeladenen CSV.

## Testing

- `npm test` — läuft `test:legacy` (VM-Sandbox-Test gegen die inline `<script>` in `index.html`, die produktive Logik) **und** `test:unit` (Vitest gegen `src/domain/`, den V2-Zielstand). Beide nutzen dieselben Fixtures unter `test/fixtures/`.
- `npm run typecheck` — TypeScript-Check ohne Build (`tsc --noEmit`).
- Fixtures decken u.a. ab: Datumsfilter, Brutto/Netto-Dividendenlogik, Korrekturbuchungen, BUY/SELL-Gebührenbehandlung, deutsche CSV-Spaltennamen mit Semikolon-Trennung.

## V2-Migration (läuft, siehe README-Abschnitt „V2 Migration")

Ziel: schrittweiser Umbau auf TypeScript + Komponenten + State-Store, ohne die laufende GitHub-Pages-Auslieferung zu gefährden (Strangler-Fig-Ansatz — bei jedem Zwischenschritt bleibt die Seite unverändert deploybar).

- **Phase 0 (fertig):** Vite + TypeScript-Build-Pipeline. `vite.config.ts`, `tsconfig.json`, neuer Workflow `.github/workflows/pages-vite.yml` (nur `workflow_dispatch`, ersetzt die aktuelle Pages-Deployment **nicht** — die läuft unverändert über "Deploy from a branch" weiter, bis bewusst auf "GitHub Actions" umgestellt wird). `npm run build` erzeugt aktuell eine zu `index.html` byte-identische `dist/index.html`.
- **Phase 1 (fertig):** Domain-Layer (`parseCSV`, `findCol`, `analyze`, `linReg`, Formatierungs-Helper) nach `src/domain/*.ts` portiert, typisiert, mit Vitest-Unit-Tests. **Wichtig:** `index.html` wurde dabei bewusst NICHT angefasst — sie behält vorerst ihre eigene (identische) Kopie der Logik inline. Diese Dopplung ist befristete, bekannte Technical Debt der Migration, keine Vergesslichkeit. Die Zusammenführung (index.html bindet den gebauten Bundle ein) passiert erst, wenn `dist/` auch tatsächlich das Deployment-Artefakt wird (Phase 5).
- **Phase 2 (fertig):** Typisierter State-Store in `src/state/` als Ersatz für `G`/`MC`/`TX`:
  - `store.ts` — generisches, framework-loses `createStore<T>()` (get/set/subscribe), kein Redux/Zustand als Dependency
  - `appState.ts` — `AppState`-Typ + `initialAppState()`, spiegelt die heutigen Globals, aber bereinigt:
    - `G.rows` (Rohdaten vor `analyze()`) fällt weg — wird im Code nirgends gelesen, nur einmal geschrieben (totes Feld)
    - `G.charts` (Chart.js-Instanzen) ist bewusst NICHT Teil des State — das sind imperative DOM-Handles, kein App-State; gehört Phase 3 zur jeweiligen Komponente
    - `MC.snapshots` (Deep-Dive-Monatsanalysen) und `TX.filtered` (gefilterte Transaktionen) sind nicht gespeichert — beides lässt sich aus `analysis` + Filtern ableiten, statt dupliziert vorgehalten zu werden
    - Transaktions-Filter (`tx-year`, `tx-search` etc.) existieren heute NUR als DOM-Werte, nirgends in JS — der Store bildet sie erstmals als echten State ab
  - `appStore.ts` — `createAppStore()` liefert `{ store, actions }`; Actions bilden 1:1 die heutigen Verhaltensdetails nach, z.B. dass `cmpMetric` beim Laden/Zurücksetzen einer Vergleichsdatei **nicht** zurückgesetzt wird (nur `resetAll()` tut das), oder dass jede Filter-/Sortierungsänderung bei Transaktionen die Pagination auf Seite 0 zurücksetzt
  - **Wie Phase 1:** noch nicht in `index.html` verdrahtet — reine, unit-getestete Infrastruktur, die Phase 3 anzapft
- **Phase 3 (gestartet, Transaktionen + Übersicht + Kategorien + Jahre + Monate fertig):** Tabs einzeln auf Komponenten umstellen. Als Rendering-Library kommt **lit-html** zum Einsatz (~5kb, Template-Literal-basiert, kein virtuelles DOM, keine transitiven Dependencies) — passt zum bisherigen "Funktion baut Markup"-Stil, aber mit gezieltem statt komplettem Re-Render und echten Event-Listenern statt `onclick="..."`-Strings.
  - `src/features/transactions/` — `selectors.ts` (reine, DOM-freie Filter-/Sortier-/Paginierungs-/KPI-Logik, 21 Tests) + `TransactionsView.ts` (die Komponente, abonniert den Store)
  - `src/features/overview/` — `selectors.ts` (KPIs, Finanz-Kennzahlen, Alerts, Chart-Rohdaten, Top-Händler/Einnahmenquellen/wiederkehrende-Ausgaben-Listen, 1:1 aus `renderOverview()` portiert, 16 Tests) + `OverviewView.ts` (die Komponente, inkl. 4 Chart.js-Charts)
  - `src/features/categories/` — `selectors.ts` (Ausgaben-Kategorien-Donut/Legende, Einnahmen-vs-Ausgaben je Typ, Asset-Klassen-Donut, Dividenden nach Wertpapier, 1:1 aus `renderCategories()` portiert, 7 Tests) + `CategoriesView.ts` (die Komponente, 3 Chart.js-Charts)
  - `src/features/yearly/` — `selectors.ts` (7 Tests) + `YearlyView.ts`. Bildet **beide** Modi des Originals in einer Komponente ab: Ein-Jahres-Datensatz → Quartals-Breakdown (`computeQuarterlyBreakdown`), Mehrjahres-Datensatz → Jahresvergleich mit YoY-Veränderung (`isMultiYear()` entscheidet, welcher Zweig gerendert wird — 1:1 aus `renderYearly()` portiert)
  - `src/features/monthly/` — `selectors.ts` (5 Tests) + `MonthlyView.ts` (gruppierter Balken, kumulierter Saldo, Sparquoten-Trend, Detailtabelle mit Best/Worst-Hervorhebung, 1:1 aus `renderMonthly()` portiert)
  - `src/features/shared/commonSelectors.ts` — **neu**: `getTopMerchants` von Übersicht hierher verschoben, da Kategorien dieselbe Logik braucht (aus `overview/selectors.ts` re-exportiert, keine Breaking Changes für bestehende Imports/Tests)
  - **Entdeckt beim Portieren von `getDividendsBySecurity`:** Die "Brutto"-Spalte (`Netto + Steuer`) rekonstruiert den echten Bruttobetrag nur korrekt, wenn alle Steuerwerte einer Position gleiches Vorzeichen haben. Bei einer Dividenden-Korrekturbuchung mit *positivem* Steuer-Vorzeichen (Erstattung) entsteht eine kleine Diskrepanz (im Test: 90€ berechnet vs. 80€ tatsächliche Rohsumme). Das ist eine bereits in der **aktuell laufenden** `index.html` vorhandene Formel-Eigenheit (`v.total+v.tax`, unverändert 1:1 portiert), kein neuer Fehler dieser Migration — im Test dokumentiert, nicht "repariert", da außerhalb des Auftrags
  - `src/charts/chartTheme.ts` + `chartManager.ts` — gemeinsame Achsen-/Farb-Theming-Helper (`BASE`, `xScale`, `yScale`, `darkAxes`) und ein kleiner Chart.js-Instanz-Manager (`mountChart()`, WeakMap-basiert statt globaler `G.charts`-Registry), jetzt von 4 Tabs genutzt
  - **Chart.js ist jetzt eine echte npm-Dependency** (`chart.js`, registriert via `Chart.register(...registerables)`) statt CDN-Global — Teil des ursprünglichen V2-Plans, macht die neuen Komponenten unabhängig vom externen CDN
  - `src/styles/base.css` — erweitert um `.g3`, `.g6`, `.chart-wrap` (+`.tall`), `.insight`/`.dot`/`.ins-desc` (Alerts), `.leg`/`.leg-label`/`.leg-dot`, `.pb-wrap`/`.pb-fill` (Progress-Bars), `.kpi-trend`, `.row-best`/`.row-worst`, `.section-note` und KPI-Zusatzklassen (`balance`, `warn`, `.kpi-sub`). Weiterhin nur ein Auszug aus `index.html`s Inline-`<style>`, die selbst unangetastet bleibt
  - `src/dev/{transactions,overview,categories,yearly,monthly}-preview.{html,ts}` — je eine eigenständige Vite-Entry-Seite zum echten Ausprobieren (CSV hochladen, live interagieren), ohne `index.html` anzurühren; `vite.config.ts` hat jetzt 6 Rollup-Inputs, `dist/index.html` bleibt dabei weiterhin byte-identisch (verifiziert)
  - **Wichtiger Erkenntnisgewinn beim Testen:** ES-Module lassen sich nicht über `file://` laden (CORS-Block, `origin 'null'`) — anders als die bisherige `index.html` mit ihrem reinen, nicht-modularen `<script>`. Für Playwright-Tests gegen die neuen Komponenten muss `vite preview` (oder `vite dev`) einen echten HTTP-Server bereitstellen. Relevant für Phase 5: der Cutover-Workflow braucht ohnehin schon HTTP-Deployment (GitHub Pages), betrifft also nur lokales Testen.
  - Alerts nutzen `unsafeHTML` (lit-html-Direktive) für die `<strong>`-Tags in den Warnhinweis-Texten — per Playwright verifiziert, dass echte Elemente gerendert werden, kein escapeter Text
  - Noch offen: restliche Tabs (Ausreißer/Prognose → Deep-Dive/Vergleich → Empfehlungen)
- **Phase 4 (offen):** IndexedDB-Persistenz.
- **Phase 5 (offen):** Cutover — `index.html`s Inline-Script wird durch den `src/`-Bundle ersetzt, Pages-Source wird auf den neuen Workflow umgestellt.

## Offene PRs

- PR #14: Deep-Dive Fixes, Transaktionen-Tab, Vergleich-Fix, Handover-Docs, V2-Migration Phase 0–3
