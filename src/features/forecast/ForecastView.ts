import { html, render, type TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import type { ChartConfiguration } from 'chart.js';
import { mountChart } from '../../charts/chartManager';
import { BASE, xScale, yScale } from '../../charts/chartTheme';
import { fmt } from '../../domain/format';
import type { AppActions } from '../../state/appStore';
import type { AppState } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import { computeForecast, type ForecastResult } from './selectors';

const FORECAST_OPTIONS = [3, 6, 12] as const;

export function mountForecastView(container: HTMLElement, store: Store<AppState>, actions: AppActions): () => void {
  return subscribeSelected(store, (s) => [s.analysis, s.forecastMonths], (state) => {
    const result = state.analysis ? computeForecast(state.analysis, state.forecastMonths) : null;
    render(view(result, state.forecastMonths, actions), container);
    if (result) mountForecastChart(container, result);
  });
}

function view(result: ForecastResult | null, forecastMonths: number, actions: AppActions): TemplateResult {
  if (!result) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;

  return html`
    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header">
        <span class="card-title">Cashflow-Prognose (Lineartrend + Konfidenzband)</span>
        <div class="controls">
          ${FORECAST_OPTIONS.map((m) => html`
            <button class="cb ${forecastMonths === m ? 'active' : ''}" @click=${() => actions.setForecastMonths(m)}>${m} Monate</button>
          `)}
        </div>
      </div>
      <div class="chart-wrap tall"><canvas data-chart="fc-main"></canvas></div>
    </div>
    <div class="g3" style="margin-bottom:1.2rem;">
      ${result.kpis.map((k) => html`
        <div class="kpi ${k.cls}">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value ${k.cls}" style="font-size:1.35rem">${k.value}</div>
          <div class="kpi-sub">${k.sub}</div>
        </div>
      `)}
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Szenarien &amp; Milestones</span></div>
      <div>
        ${result.scenarios.map((s) => html`
          <div class="insight"><div class="dot ${s.color}"></div><div><div class="ins-title">${s.title}</div><div class="ins-desc">${unsafeHTML(s.desc)}</div></div></div>
        `)}
      </div>
    </div>
  `;
}

function mountForecastChart(container: HTMLElement, result: ForecastResult): void {
  const canvas = container.querySelector<HTMLCanvasElement>('[data-chart="fc-main"]');
  if (!canvas) return;
  const { chart } = result;

  mountChart(canvas, {
    type: 'line',
    data: {
      labels: chart.labels,
      datasets: [
        { label: 'Ist-Verlauf', data: chart.historical, borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#3b82f6', tension: 0.3, spanGaps: false },
        { label: 'Prognose', data: chart.forecast, borderColor: '#f59e0b', borderWidth: 2, borderDash: [6, 4], pointRadius: 3, pointBackgroundColor: '#f59e0b', tension: 0.3, spanGaps: false },
        { label: '95% CI oben', data: chart.ciUpper, borderColor: 'rgba(245,158,11,.2)', borderWidth: 1, pointRadius: 0, fill: '+1', backgroundColor: 'rgba(245,158,11,.08)', tension: 0.3, spanGaps: false },
        { label: '95% CI unten', data: chart.ciLower, borderColor: 'rgba(245,158,11,.2)', borderWidth: 1, pointRadius: 0, tension: 0.3, spanGaps: false },
      ],
    },
    options: {
      ...BASE,
      interaction: { mode: 'index', intersect: false },
      scales: { x: xScale(), y: yScale() },
      plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
    } as ChartConfiguration<'line'>['options'],
  });
}
