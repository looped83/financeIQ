FinanceIQ – CSV Analytics Dashboard

A modern analytics dashboard for visualizing and analyzing personal finance data from CSV files — optimized for banks and brokers such as Trade Republic, Sparkasse, DKB, and more.

⸻

🚀 Features

📊 Comprehensive Financial Analytics

FinanceIQ provides an interactive interface for analyzing financial data across 9 advanced analytics tabs:

* Overview & Trends
* Yearly Breakdown
* Monthly Breakdown
* Category Analysis
* Outlier Detection
* Cashflow Forecasting
* Comparative Analytics
* Recommendations & Insights
* KPI Dashboard

⸻

📈 Visualizations & KPIs

Track and visualize:

* Income vs Expenses
* Monthly Net Cashflow
* Dividend Growth
* Investment Volume
* Cumulative Cashflow
* Savings Rate
* Risk Indicators
* Merchant & Category Rankings
* Asset Class Distribution

⸻

🤖 AI-Powered Insights

Built-in intelligent analysis includes:

* Automated financial insights
* Statistical outlier detection (>2σ)
* Recurring payments & subscription detection
* Cashflow forecasting with confidence intervals
* Financial milestones & scenario analysis

⸻

⚖️ CSV Comparison Engine

Compare two CSV files side-by-side:

* Monthly deltas
* Year-over-year comparisons
* KPI benchmarking
* Category comparison
* Auto-generated insights

⸻

🧩 Supported Data Sources

* Trade Republic
* Sparkasse
* DKB
* Additional banks & brokers supporting CSV exports

⸻

🖥️ Tech Stack

* HTML5
* CSS3
* JavaScript
* Chart.js
* CSV Parsing & Data Aggregation

📤 Usage

1. Upload your CSV file
2. FinanceIQ automatically processes the data
3. Navigate through analytics tabs
4. Explore forecasts and insights
5. Optionally upload a second CSV for comparison

⸻

🔒 Privacy

All analysis runs locally in the browser.
No financial data is uploaded to external servers.

⸻

📸 Highlights

* Interactive charts
* Responsive dashboard UI
* Dark mode ready
* Fast CSV processing
* Fully local analytics without backend infrastructure

⸻

🧪 Testing

```
npm install
npm test          # Vitest unit tests
npm run typecheck # TypeScript, no build
```

`npm test` runs the Vitest suite against `src/` — the real, typed domain/state/feature/persistence layers that `index.html` now actually runs (since Phase 5's cutover; see below). The former `test:legacy` suite, which replayed fixtures through the inline `parseCSV()`/`analyze()` that used to live directly in `index.html`, has been retired: that inline script no longer exists, so there's nothing left for it to test.

To preview a migrated component standalone: `npm run dev`, then open `/src/dev/transactions-preview.html` or `/src/dev/overview-preview.html`.

🏗️ V2 Migration (complete)

The app was incrementally rewritten into a typed, componentized architecture while staying deployable as a static site at every step (no functionality changes until each phase was verified equivalent — apart from Phase 4's persistence, a deliberate, additive new capability, and Phase 5's cutover itself):

* ✅ **Phase 0** — Vite + TypeScript build pipeline, proven to produce a byte-identical `dist/index.html` from the untouched source.
* ✅ **Phase 1** — Domain layer (`parseCSV`, `analyze`, formatting/stats helpers) ported to typed, unit-tested modules in `src/domain/`. Not yet wired into `index.html`.
* ✅ **Phase 2** — Typed state store (`src/state/`) designed to replace the `G`/`MC`/`TX` globals: a small generic `createStore()` plus a typed `AppState` and action functions (`loadFile`, `setTimelineView`, `setTransactionFilters`, …). Not yet wired into `index.html` — same reasoning as Phase 1.
* ✅ **Phase 3 (complete)** — All 11 tabs migrated to components, one at a time.
  - **Transaktionen**: `src/features/transactions/` — pure selectors (filter/sort/paginate/KPIs) + a `lit-html` view wired to the Phase 2 store.
  - **Zeitverlauf**: `src/features/timeline/` — 5 charts (cumulative cashflow with a 3-way daily/monthly/quarterly view toggle plus 30-day/3-month/2-quarter moving average, monthly net cashflow, dividend income, buy/sell volume, and separate cumulative income/expense curves). The daily view uses a Chart.js time-scale x-axis, so `chartjs-adapter-date-fns` was added as a real npm dependency (registered once in `src/charts/chartManager.ts`). Wired to the Phase 2 store's `timelineView`/`setTimelineView`.
  - **Übersicht**: `src/features/overview/` — pure selectors (KPIs, ratios, alerts, chart data, merchants/income-sources/recurring-expenses lists) + a `lit-html` view. Charts now use `chart.js` as a real npm dependency (registered via `Chart.register(...registerables)` in `src/charts/chartManager.ts`) instead of the CDN global, with shared theming in `src/charts/chartTheme.ts`.
  - **Kategorien**: `src/features/categories/` — pure selectors (expense-category donut/legend, income-vs-expense-by-type bar, asset-class donut, dividends-by-security) + a `lit-html` view. `getTopMerchants` moved to `src/features/shared/commonSelectors.ts` since both Übersicht and Kategorien need it (re-exported from Übersicht's `selectors.ts` for backward compatibility).
  - **Jahre**: `src/features/yearly/` — handles both of the original's two modes (single-year quarterly breakdown, multi-year comparison with YoY deltas) as one component that switches on `isMultiYear()`.
  - **Monate**: `src/features/monthly/` — grouped bar, cumulative balance line, savings-rate line, detail table with best/worst-month highlighting.
  - **Ausreißer**: `src/features/outliers/` — KPI cards, risk-light list, recurring-expenses table (reuses `getRecurringExpenses` from `shared/commonSelectors.ts`), and the z-score outlier table. No charts.
  - **Prognose**: `src/features/forecast/` — linear-trend cashflow forecast with a 95% confidence band, wired to the Phase 2 store's `forecastMonths`/`setForecastMonths` so the 3/6/12-month toggle buttons are real interactive state, not just a demo. Uses `linReg` from the Phase 1 domain layer.
  - **Deep-Dive**: `src/features/deepdive/` — the largest tab (KPIs, 4 charts, month-over-month changes, improved/worsened, best/worst months, trends, attention items, recommendations, detail table). Re-analyzes each month of the uploaded CSV in isolation (`buildMonthlySnapshots`) the same way the original did. The month-picker for "Veränderungen zum Vormonat" is wired to the store's `deepDiveSelectedMonth`/`setDeepDiveMonth`, defaulting to the most recent month on first render.
  - **Vergleich**: `src/features/compare/` — uploads a second CSV and compares it against the primary analysis: 3-column KPI grid with deltas, a metric-switchable monthly bar chart (Einnahmen/Ausgaben/Netto-Cashflow/Investitionen), a net-delta-per-month chart, a category-delta chart, auto-generated insights, and a full KPI delta table. Months are aligned by calendar month number (`buildMonthAlign`) regardless of the two files' years, so e.g. a 2024 file compares cleanly against a 2025 file. Wired to the store's `compare.analysis`/`compare.metric` via `loadCompareFile`/`setCompareMetric`/`resetCompare`.
  - **Empfehlungen**: `src/features/recommendations/` — `computeRecommendations(a)` (15 rule-based recommendations: cashflow, savings rate, investment rate, dividends & concentration risk, fees, taxes, large expenses, subscriptions, cashflow volatility, portfolio diversification, card-spending ratio, emergency fund, spending/income trends, merchant concentration, weekend spending), sorted by priority, plus a `RecommendationsView.ts` rendering them as a prioritized insight list with color-coded dots and category badges. No charts, no store-backed interactivity — same as the original tab.
  - All 11 previewable standalone (`npm run dev`, open `/src/dev/{transactions,overview,categories,yearly,monthly,outliers,forecast,deepdive,compare,recommendations,timeline}-preview.html`), all verified with Playwright against the *built* output — not just unit tests.
  - All 11 original tabs are now migrated to components; not yet wired into `index.html` (Phase 5's job).
* ✅ **Phase 4** — IndexedDB persistence. New capability, not present in the original at all: `src/persistence/` stores the uploaded CSV(s) so a page reload doesn't lose your data.
  - `kvStore.ts` — a minimal async key-value abstraction (`get`/`set`/`delete`), plus an in-memory implementation used by unit tests.
  - `indexedDbStore.ts` — the real, browser-only IndexedDB-backed implementation of that abstraction. Not unit-tested (no IndexedDB in Node); verified with Playwright against the built preview instead.
  - `sessionPersistence.ts` — serializes/deserializes a `{ primary, compare }` session (filename + raw CSV text for each) as JSON, tolerating corrupt or missing data.
  - `sessionBootstrap.ts` — `restoreSession()` re-parses persisted CSV text and replays it through the same `loadFile`/`loadCompareFile` actions a real upload uses; `persistPrimaryFile()`/`persistCompareFile()` save without clobbering the other slot; `clearPersistedSession()` wipes it.
  - `src/dev/persistence-preview.{html,ts}` — demo page (Übersicht-Tab + upload inputs + status line + "Gespeicherte Daten löschen" button). Verified with Playwright: upload → reload the page → data is restored automatically, then clear → reload → back to empty.
* ✅ **Phase 5 — Cutover.** `index.html` no longer carries any inline logic: its ~1,650-line `<script>` block and all 11 tabs' hand-written per-tab markup are gone, replaced by 11 empty `<div id="tab-N">` containers and a single `<script type="module" src="/src/main.ts">`. The two Chart.js CDN `<script>` tags are gone too — `chart.js` and `chartjs-adapter-date-fns` are real npm dependencies now. **This is the one phase where the long-held "`dist/index.html` stays byte-identical" invariant deliberately ends** — that invariant existed specifically to keep the live site unaffected while `src/` was still just parallel, unwired infrastructure; Phase 5 is the point where it gets wired in for real.
  - `src/main.ts` — the new entry point. Creates the Phase 2 store, mounts all 11 tab components, wires the upload screen (file input + drag & drop) and the "⟳ Neue Datei" reset button, and calls `restoreSession()` on startup so a previously-persisted CSV reloads automatically (Phase 4, now live). Each tab is mounted lazily, the first time it's actually clicked — mounting a Chart.js canvas while its container is `display:none` produces a broken, zero-size chart, and this also matches the original's own lazy `TAB_FNS`/`rendered` behavior.
  - **Bug found and fixed during cutover verification:** `mountDeepDiveView` auto-selects the most recent month if none is selected yet, by calling `actions.setDeepDiveMonth()` from inside its own render function and relying on that action's state change to synchronously re-trigger the same render (a pattern documented in Phase 3). That only works if the view has already subscribed to the store *before* its first render — true in every dev-preview page (mounted before any file is loaded) and in the standalone Vitest tests, but false for a tab lazily mounted *after* data is already loaded, which is exactly what happens the first time a real user clicks the Deep-Dive tab. Fixed by subscribing before the first render in `DeepDiveView.ts`. Caught by an end-to-end Playwright run through all 11 tabs against the real cutover build — the kind of integration bug that per-tab isolated testing structurally can't see.
  - The `test:legacy` regression suite (`test/run.cjs`, VM-sandboxed against `index.html`'s inline script) is retired — there's no inline script left to test. `npm test` is now just the Vitest suite, which is the sole regression guard on the actual production logic.
  - `.github/workflows/pages-vite.yml` now triggers on push to `main` (previously `workflow_dispatch` only, from its Phase 0 proof-of-concept days). **Manual step still required:** GitHub Pages' source setting needs to be switched from "Deploy from a branch" to "GitHub Actions" in the repo's Settings → Pages — that's a repository setting, not something a workflow file or a code change can flip on its own.
  - Verified with Playwright against the actual built `index.html` (not a `/src/dev/` preview): upload a real CSV, click through all 11 tabs and confirm each renders without console errors, exercise interactive controls (forecast month toggle, Deep-Dive month picker, Vergleich's second-file upload, transaction table), reset back to the upload screen, and reload the page to confirm the persisted session restores automatically.
  - 18 new unit tests against the in-memory store; `dist/index.html` stays byte-identical.
* ⬜ Phase 5 — Cut over: `index.html`'s inline script is replaced by the `src/` bundle, GitHub Pages source switches to the Actions-based deploy.

⸻

🛠️ Roadmap

* PDF export
* Multi-bank mapping
* AI spending coach
* Budget planning
* Portfolio tracking
* Mobile optimization

⸻

📄 License

MIT License

⸻

👤 Author

Developed by looped83

⸻

🌐 Live Demo

👉 https://looped83.github.io/financeiq/
