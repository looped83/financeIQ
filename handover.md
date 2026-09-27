# FinanceIQ — Handover-Dokument

## Projektübersicht

**FinanceIQ** ist ein CSV-Analytics-Dashboard für die Analyse von Finanztransaktionen (Trade Republic, Sparkasse, DKB u.a.). Nach Abschluss der V2-Migration (Phase 0–5) und anschließendem UI-Refactoring ist die Anwendung eine typisierte, komponentenbasierte TypeScript-App, gebaut mit Vite, deployed über GitHub Actions auf GitHub Pages.

- **Sprache:** Deutsch (UI), `de-DE` Locale, Euro-Formatierung
- **Design:** Dark Mode (warmes Anthrazit, Akzent Orange, Systemschrift), feste Seitenleiste auf Desktop und Tablet (ab 768 px), Leiste unten + „Mehr“-Sheet auf Smartphones; Diagramm-Legenden als HTML immer links über dem Plot (`chartBox(..., series)`), Chart.js-Legend-Plugin nicht registriert
- **Stack:** TypeScript, Vite, `lit-html` (~5kb, Template-Literal-basiert, kein virtuelles DOM), Chart.js + `chartjs-adapter-date-fns` (echte npm-Dependencies, nicht mehr CDN), Vitest
- **Deployment:** GitHub Pages via `.github/workflows/pages-vite.yml`, das bei jedem Push auf `main` baut und deployed. Pages-Source ist auf "GitHub Actions" umgestellt und **läuft produktiv** (verifiziert: Build+Deploy grün, App vom Nutzer live getestet und funktionsfähig bestätigt).

## Aktuelle Architektur (Stand nach Dark-Mode-Redesign)

```
index.html                — Upload-Screen als statisches Markup (malt ohne JS/Chart.js),
                             leere Container für Seitenleiste, Kopf, Seiten, Mobil-Navigation
src/
  main.ts                 — Einstieg: Store, Upload/Drag&Drop, Hash-Routing, Seiten lazy mounten
                             (eine dynamische import()-Datei pro Seite), Sitzung wiederherstellen
  shell/                  — routes.ts (6 Bereiche + Unterseiten, #/bereich/unterseite),
                             shell.ts (Seitenleiste, Seitenkopf mit Zeitraum, Mobil-Leiste, Mehr-Sheet),
                             gatedStore.ts (versteckte Seiten rendern nicht — kein Chart-Neuaufbau im Hintergrund)
  ui/                     — components.ts (card, kpiGrid, segmented, barList, insight, chartBox …),
                             icons.ts (Inline-SVG), page.ts (gemeinsamer Seiten-Lebenszyklus)
  styles/                 — tokens.css (alle Design-Werte) + app.css (Layout & Komponenten)
  theme/palette.ts        — Farben, die Chart.js als Strings braucht; palette.test.ts prüft den
                             Gleichlauf mit tokens.css
  charts/                 — chartManager.ts (registriert nur Bar/Line/Doughnut, globales Theme),
                             chartTheme.ts (Achsen, Tooltips), registry.ts (Charts sauber abbauen)
  domain/                 — parseCSV, analyze (= enrich + aggregate), period.ts (Zeitraum-Presets,
                             Blättern, Labels), Formatierung (de-DE, auch Prozent: „26,3 %“)
  state/                  — AppState mit fullAnalysis (ganze Historie), analysis (auf Zeitraum
                             gefiltert) und period; appStore.ts, store.ts
  features/<bereich>/     — selectors.ts (reine, getestete Logik) + <Name>View.ts (lit-html)
  persistence/            — IndexedDB-Sitzung (nur noch die geladene Datei)
test/fixtures/            — CSV-Fixtures für die Vitest-Suite
```

### Navigation (6 Bereiche)

| Route | Bereich | Modul | Zeitraum |
|-------|---------|-------|----------|
| `#/uebersicht` | Übersicht | overview/OverviewView | ja |
| `#/cashflow/verlauf` | Cashflow › Verlauf | timeline/TimelineView | ja |
| `#/cashflow/monate` | Cashflow › Monate | monthly/MonthlyView | ja |
| `#/cashflow/prognose` | Cashflow › Prognose | forecast/ForecastView | nein (ganze Historie) |
| `#/ausgaben` | Ausgaben | spending/SpendingView | ja |
| `#/investments` | Investment | investments/InvestmentsView | ja |
| `#/vergleich/monate` | Vergleich › Monate | monthcompare/MonthCompareView | nein |
| `#/vergleich/jahre` | Vergleich › Jahre | yearly/YearlyView | nein |
| `#/transaktionen` | Transaktionen | transactions/TransactionsView | ja |

Jede Seite nutzt `mountPage()` aus `ui/page.ts`: neu zeichnen, wenn sich die gewählten State-Slices ändern, vorher alte Charts abbauen, beim Unmount alles aufräumen. Seiten werden erst beim ersten Öffnen geladen; ist eine Seite verborgen, hält `createGatedStore` ihre Updates zurück und spielt beim Wiederanzeigen nur den letzten Stand einmal ab.

### Globaler Zeitraum

Der Zeitraum im Seitenkopf (‹ Label › + Presets: Gesamter Zeitraum, Letzte 12/3 Monate, Letzter Monat, je Kalenderjahr) setzt `period`. `setPeriod()` filtert `fullAnalysis.enriched` auf die Monate und ruft `aggregate()` erneut auf — die CSV wird nicht neu geparst, alle Selektoren bleiben unverändert. Presets beziehen sich auf den **letzten Monat in den Daten**, nicht auf heute. Prognose und Vergleich lesen immer `fullAnalysis`. Die früheren Jahr-/Monat-/Datumsfilter der Transaktionen sind dadurch entfallen; dort gibt es jetzt Schnellfilter (Alle, Einnahmen, Ausgaben, Investments, Dividenden), Typ, Suche und Sortierung.

## Dark-Mode-Redesign (2026-09)

- **Farben:** warmes Anthrazit, Orange nur für Bedienelemente (nie als Datenfarbe). Datenfarben sind auf Rot-Grün-Schwäche geprüft: Einnahmen `#39ad79`, Ausgaben `#d02b31` (Text: `#f09191`), Investiert `#3987e5`, Dividenden Gold `#c98500`. Kategorien nutzen eine feste Reihenfolge aus 6 Farben, alles darüber fällt in „Sonstige“.
- **Entdopplung:** Kumulierter Cashflow, Netto-Cashflow und Sparquote gibt es nur noch je einmal (Cashflow › Verlauf bzw. › Monate). Die Übersicht ist ein schlankes Dashboard (4 Kennzahlen, Einnahmen vs. Ausgaben, „Wohin das Geld geht“, Kennzahlen, Wiederkehrendes, Hinweise & Empfehlungen). Risikoampel (doppelt zu den Hinweisen), Kennzahlen-Balken im Monatsvergleich (doppelt zur Tabelle), beste/schwächste Monate (in der Monatstabelle markiert) und die KPI-Kacheln der Transaktionen sind entfallen.
- **Aufgeräumt:** Vergleichs-Tab (zweite CSV), Deep-Dive-View, Kategorien-/Ausreißer-/Empfehlungen-Views und alle `src/dev/*-preview`-Seiten entfernt; noch genutzte Logik liegt in `features/shared`, `spending`, `investments`. `design-system/` (beschrieb das alte Navy-Theme) ist durch `src/styles/tokens.css` ersetzt.
- **Kleinere Korrekturen:** Pfeile in der Jahrestabelle zeigen bei Ausgaben die echte Richtung; Käufe/Verkäufe zählen im Monatsvergleich nicht mehr als Ausgaben; Ausreißer auf der Ausgaben-Seite nur noch Ausgaben.

## UI-Refactoring (Post-Migration)

### Übersicht-Tab: Deep-Dive-Integration & Streamlining

- **Deep-Dive-Tab in Übersicht integriert:** Net-Cashflow & Sparquote-Chart, kumulierter Saldo, Kategorie-Stack, Trends & Muster, beste/schlechteste Monate — alles jetzt Teil der Übersicht
- **Redundante Sektionen zusammengeführt:** "Trends & Muster" + "Auffälligkeiten" → eine Kachel; "Sparquote-Chart" + "Netto-Cashflow & Sparquote" → eine Kachel
- **"Größte Einzeltransaktionen" entfernt** (war redundant mit Transaktionen-Tab)
- **Neuer "Monatlicher Trend"-Chart** als Ersatz für die weggefallene Kachel (Balkendiagramm mit Einnahmen/Ausgaben/Netto über alle Monate, nutzt `getAllMonthsTrendData` aus `overview/selectors.ts`)
- **"Monatliche Detailübersicht"** nach Monate-Tab verschoben

### Einheitliches Tabellen-Schema

Alle Detail-Tabellen folgen dem gleichen Schema mit Delta-Pfeilen (▲/▼):

- **Monate → "Monatliche Detailübersicht":** Spalten Monat, Einnahmen (▲/▼), Ausgaben (▲/▼), Netto, Sparquote, Dividenden, Investiert, Karten-Tx, Gesamt-Tx. Heute `getMonthlyDetailRows` in `monthly/selectors.ts` (rechnet direkt aus den Monatssummen). Zeilen-Highlighting für besten/schwächsten Monat (`is-best`/`is-worst`).
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

Der eigenständige CSV-Vergleich-Tab wurde komplett entfernt (Button, Content-Div, TAB_LOADER-Eintrag). Die Monatsvergleich-Funktionalität deckt den Anwendungsfall ab. Der Feature-Code wurde beim Redesign entfernt.

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

- `npm test` — Vitest-Suite gegen `src/` (aktuell 216 Tests, 24 Test-Dateien). Das ist die einzige Regressionsabsicherung.
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
- **Bekannte Schwäche (unverändert übernommen):** `analyze().subscriptions` erkennt „wiederkehrend“ an gleichem Namen + gerundetem Betrag in ≥ 2 Monaten. Bei vielen Kartenzahlungen entstehen Zufallstreffer (z. B. zweimal 45 € bei REWE) — die Summe „Wiederkehrende Ausgaben“ ist dann zu hoch. Die CV-basierte Fixkosten-Erkennung (`getFixedCostNames`) ist robuster.

## PR-Historie (chronologisch)

| PR  | Beschreibung |
|-----|-------------|
| #33 | Phase 5 Cutover — Inline-Script entfernt |
| #34 | Post-Cutover-Fix: CSV-Upload-Fehler sichtbar machen |
| #40 | Deep-Dive in Übersicht integriert, Emojis entfernt (gemerged) |
| #46 | Tabellen vereinheitlicht, Detail-Tabelle nach Monate, Vergleich-Tab entfernt; Monatsvergleich-Detailsektionen + Zeitverlauf-Charts (Top-Händler, Fixkosten vs. Variable); Dividenden-Steuer seitenweit entfernt; CV-basierte Fixkosten-Erkennung + Empfänger-Extraktion aus Beschreibung (offen) |
| — | Dark-Mode-Redesign: Tokens, App-Shell mit 6 Bereichen, globaler Zeitraum, Entdopplung, Aufräumen (Branch `claude/redesign-darkmode-3o1v8a`) |
