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
- **Phase 2 (offen):** Typisierter State-Store statt `G`/`MC`/`TX`-Globals.
- **Phase 3 (offen):** Tabs einzeln auf Komponenten umstellen (Reihenfolge: Transaktionen → Übersicht → Kategorien/Jahre/Monate → Ausreißer/Prognose → Deep-Dive/Vergleich → Empfehlungen).
- **Phase 4 (offen):** IndexedDB-Persistenz.
- **Phase 5 (offen):** Cutover — `index.html`s Inline-Script wird durch den `src/`-Bundle ersetzt, Pages-Source wird auf den neuen Workflow umgestellt.

## Offene PRs

- PR #14: Deep-Dive Fixes, Transaktionen-Tab, Vergleich-Fix, Handover-Docs, V2-Migration Phase 0+1
