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

In `analyze()` werden nur Transaktionen ab **01.01.2024** berücksichtigt:
```js
.filter(r => r._date && r._date >= new Date('2024-01-01'))
```

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

## Offene PRs

- PR #14: Deep-Dive Fixes, Transaktionen-Tab, Vergleich-Fix, Handover-Docs
