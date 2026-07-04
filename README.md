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
npm test          # legacy regression suite + Vitest unit tests
npm run typecheck # TypeScript, no build
```

`npm test` runs two suites:

* **`test:legacy`** — replays fixture CSVs through the inline `parseCSV()`/`analyze()` still shipped in `index.html` today (the production logic, until the V2 migration reaches its cutover point).
* **`test:unit`** — Vitest tests against the typed domain layer in `src/domain/` (the V2 rewrite target). Same fixtures, same assertions, real unit tests instead of a VM-sandboxed script.

Both currently need to pass independently, since `index.html`'s inline script and `src/domain/` are — for now, deliberately — two copies of the same logic. See `handover.md` for the migration plan.

To preview a migrated component standalone: `npm run dev`, then open `/src/dev/transactions-preview.html` or `/src/dev/overview-preview.html`.

🏗️ V2 Migration (in progress)

The app is being incrementally rewritten into a typed, componentized architecture while staying deployable as a static site at every step (no functionality changes until each phase is verified equivalent):

* ✅ **Phase 0** — Vite + TypeScript build pipeline, proven to produce a byte-identical `dist/index.html` from the untouched source.
* ✅ **Phase 1** — Domain layer (`parseCSV`, `analyze`, formatting/stats helpers) ported to typed, unit-tested modules in `src/domain/`. Not yet wired into `index.html`.
* ✅ **Phase 2** — Typed state store (`src/state/`) designed to replace the `G`/`MC`/`TX` globals: a small generic `createStore()` plus a typed `AppState` and action functions (`loadFile`, `setTimelineView`, `setTransactionFilters`, …). Not yet wired into `index.html` — same reasoning as Phase 1.
* 🔶 **Phase 3 (started)** — Tabs migrated to components one at a time.
  - **Transaktionen**: `src/features/transactions/` — pure selectors (filter/sort/paginate/KPIs) + a `lit-html` view wired to the Phase 2 store.
  - **Übersicht**: `src/features/overview/` — pure selectors (KPIs, ratios, alerts, chart data, merchants/income-sources/recurring-expenses lists) + a `lit-html` view. Charts now use `chart.js` as a real npm dependency (registered via `Chart.register(...registerables)` in `src/charts/chartManager.ts`) instead of the CDN global, with shared theming in `src/charts/chartTheme.ts`.
  - **Kategorien**: `src/features/categories/` — pure selectors (expense-category donut/legend, income-vs-expense-by-type bar, asset-class donut, dividends-by-security) + a `lit-html` view. `getTopMerchants` moved to `src/features/shared/commonSelectors.ts` since both Übersicht and Kategorien need it (re-exported from Übersicht's `selectors.ts` for backward compatibility).
  - All three previewable standalone (`npm run dev`, open `/src/dev/{transactions,overview,categories}-preview.html`), all verified with Playwright against the *built* output — not just unit tests.
  - Not wired into `index.html` yet; remaining tabs (Jahre/Monate → Ausreißer/Prognose → Deep-Dive/Vergleich → Empfehlungen) still to come.
* ⬜ Phase 4 — IndexedDB persistence.
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
