import { html, type TemplateResult } from 'lit-html';
import { mountChart } from '../../charts/chartManager';
import { axes, INDEX_TOOLTIP } from '../../charts/chartTheme';
import type { AppActions } from '../../state/appStore';
import type { AppState } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { alpha, SERIES } from '../../theme/palette';
import { card, chartBox, getCanvas, insight, kpiGrid, segmented, type Kpi } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import { computeForecast, type ForecastKpi, type ForecastResult } from './selectors';

const HORIZONS = [3, 6, 12].map((m) => ({ value: String(m), label: `${m} Monate` }));
/** One color for actual and forecast — the dash marks the projection. */
const IST = SERIES[0];
const PROGNOSE = IST;
const DOT: Record<ForecastKpi['cls'], Kpi['dot']> = { income: 'income', expense: 'expense', invest: 'invest' };

/** Always forecasts from the whole history — a trend needs every month it can get. */
export function mountForecastView(container: HTMLElement, store: Store<AppState>, actions: AppActions): Unsubscribe {
  return mountPage(container, store, (s) => [s.fullAnalysis, s.forecastMonths], (state) => {
    const a = state.fullAnalysis;
    if (!hasData(a)) return { view: noData() };
    const result = computeForecast(a, state.forecastMonths);
    return { view: view(result, state.forecastMonths, actions), charts: () => charts(container, result) };
  });
}

function view(r: ForecastResult, months: number, actions: AppActions): TemplateResult {
  return html`
    ${card({
      title: 'Cashflow-Prognose',
      sub: 'Kumuliertes Netto · linearer Trend mit 95-%-Konfidenzband',
      actions: segmented('Horizont', HORIZONS, String(months), (m) => actions.setForecastMonths(Number(m))),
    }, chartBox('fc-main', 'Kumulierter Cashflow mit Prognose', 'lg', [
      { label: 'Ist-Verlauf', color: IST, mark: 'line' },
      { label: 'Prognose', color: PROGNOSE, mark: 'dash' },
      { label: '95-%-Konfidenzband', color: alpha(PROGNOSE, 0.35) },
    ]))}

    ${kpiGrid(r.kpis.map((k) => ({ label: k.label, value: k.value, sub: k.sub, dot: DOT[k.cls] })))}

    ${card({ title: 'Szenarien' }, html`
      <div class="insights">${r.scenarios.map(insight)}</div>
    `)}
  `;
}

function charts(root: HTMLElement, r: ForecastResult): void {
  const { chart } = r;
  mountChart(getCanvas(root, 'fc-main'), {
    type: 'line',
    data: {
      labels: chart.labels,
      datasets: [
        { label: 'Ist-Verlauf', data: chart.historical, borderColor: IST, backgroundColor: IST, pointRadius: 2 },
        { label: 'Prognose', data: chart.forecast, borderColor: PROGNOSE, backgroundColor: PROGNOSE, borderDash: [6, 4], pointRadius: 2 },
        {
          label: '95 % oben', data: chart.ciUpper, borderColor: alpha(PROGNOSE, 0.35), borderWidth: 1,
          backgroundColor: alpha(PROGNOSE, 0.12), fill: '+1',
        },
        { label: '95 % unten', data: chart.ciLower, borderColor: alpha(PROGNOSE, 0.35), borderWidth: 1 },
      ],
    },
    options: { ...INDEX_TOOLTIP, scales: axes() },
  });
}
