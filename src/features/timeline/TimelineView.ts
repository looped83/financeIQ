import { html, render, type TemplateResult } from 'lit-html';
import type { ChartConfiguration } from 'chart.js';
import { mountChart } from '../../charts/chartManager';
import { BASE, darkAxes, xScale, yScale } from '../../charts/chartTheme';
import { fmt } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState, TimelineView as TimelineViewMode } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import {
  computeMainChartData,
  getCumulativeIncExpChartData,
  getDividendChartData,
  getFixVarTimelineData,
  getInvestChartData,
  getMerchantTimelineData,
  getMonthlyNetChartData,
} from './selectors';

const VIEW_OPTIONS: { mode: TimelineViewMode; label: string }[] = [
  { mode: 'daily', label: 'Täglich' },
  { mode: 'monthly', label: 'Monatlich' },
  { mode: 'quarterly', label: 'Quartalsweise' },
];

export function mountTimelineView(container: HTMLElement, store: Store<AppState>, actions: AppActions): () => void {
  return subscribeSelected(store, (s) => [s.analysis, s.timelineView], (state) => {
    render(view(state.analysis, state.timelineView, actions), container);
    if (state.analysis) mountTimelineCharts(container, state.analysis, state.timelineView);
  });
}

function view(a: Analysis | null, timelineView: TimelineViewMode, actions: AppActions): TemplateResult {
  if (!a) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;

  return html`
    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header">
        <span class="card-title">Kumulierter Cashflow (nur Barumsätze)</span>
        <div class="controls">
          ${VIEW_OPTIONS.map((o) => html`
            <button class="cb ${timelineView === o.mode ? 'active' : ''}" @click=${() => actions.setTimelineView(o.mode)}>${o.label}</button>
          `)}
        </div>
      </div>
      <div class="chart-wrap tall"><canvas data-chart="tl-main"></canvas></div>
      <div style="margin-top:.6rem;font-size:.75rem;color:var(--text-muted);">Gestrichelt = Gleitender Durchschnitt &nbsp;|&nbsp; Tägliche Ansicht: 30-Tage-MA &nbsp;|&nbsp; Monatlich: 3-Monats-MA &nbsp;|&nbsp; Quartalsweise: 2-Quartals-MA</div>
    </div>
    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Monatlicher Netto-Cashflow</span></div>
        <div class="chart-wrap"><canvas data-chart="tl-net"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Dividenden-Einkommensverlauf</span></div>
        <div class="chart-wrap"><canvas data-chart="tl-div"></canvas></div>
      </div>
    </div>
    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Investitionsvolumen — Käufe &amp; Verkäufe</span></div>
        <div class="chart-wrap"><canvas data-chart="tl-inv"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Einnahmen vs. Ausgaben (kumuliert getrennt)</span></div>
        <div class="chart-wrap"><canvas data-chart="tl-inex"></canvas></div>
      </div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-header"><span class="card-title">Ausgaben nach Top-Händlern</span></div>
        <div class="chart-wrap tall"><canvas data-chart="tl-merchants"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Fixkosten vs. variable Ausgaben</span></div>
        <div class="chart-wrap tall"><canvas data-chart="tl-fixvar"></canvas></div>
      </div>
    </div>
  `;
}

function getCanvas(container: HTMLElement, key: string): HTMLCanvasElement | null {
  return container.querySelector<HTMLCanvasElement>(`[data-chart="${key}"]`);
}

function mountTimelineCharts(container: HTMLElement, a: Analysis, timelineView: TimelineViewMode): void {
  const mainCanvas = getCanvas(container, 'tl-main');
  if (mainCanvas) {
    const main = computeMainChartData(a, timelineView);
    mountChart(mainCanvas, {
      type: 'line',
      data: {
        labels: main.labels,
        datasets: [
          {
            label: 'Kumuliert', data: main.cumData as number[], borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 0,
            fill: { target: 'origin', above: 'rgba(59,130,246,.08)', below: 'rgba(239,68,68,.1)' }, tension: 0.3,
          },
          { label: 'Gleit. Ø', data: main.maData as number[], borderColor: '#f59e0b', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: 0.3 },
        ],
      },
      options: {
        ...BASE, interaction: { mode: 'index', intersect: false },
        scales: {
          x: main.isDate ? { type: 'time', time: { unit: 'month' }, grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8b9bb5', font: { size: 10 } } } : xScale(),
          y: yScale(),
        },
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'line'>['options'],
    });
  }

  const netCanvas = getCanvas(container, 'tl-net');
  if (netCanvas) {
    const net = getMonthlyNetChartData(a);
    mountChart(netCanvas, {
      type: 'bar',
      data: { labels: net.labels, datasets: [{ label: 'Netto-Cashflow', data: net.values, backgroundColor: net.colors, borderRadius: 4 }] },
      options: {
        ...BASE, scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `Netto: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }

  const divCanvas = getCanvas(container, 'tl-div');
  if (divCanvas) {
    const div = getDividendChartData(a);
    mountChart(divCanvas, {
      type: 'bar',
      data: { labels: div.labels, datasets: [{ label: 'Dividenden netto', data: div.values, backgroundColor: 'rgba(139,92,246,.75)', borderRadius: 4 }] },
      options: {
        ...BASE, scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `Dividende: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }

  const invCanvas = getCanvas(container, 'tl-inv');
  if (invCanvas) {
    const inv = getInvestChartData(a);
    mountChart(invCanvas, {
      type: 'bar',
      data: {
        labels: inv.labels,
        datasets: [
          { label: 'Käufe', data: inv.buys, backgroundColor: 'rgba(59,130,246,.7)', borderRadius: 4 },
          { label: 'Verkäufe', data: inv.sells, backgroundColor: 'rgba(139,92,246,.7)', borderRadius: 4 },
        ],
      },
      options: { ...BASE, scales: darkAxes() } as ChartConfiguration<'bar'>['options'],
    });
  }

  const inexCanvas = getCanvas(container, 'tl-inex');
  if (inexCanvas) {
    const inex = getCumulativeIncExpChartData(a);
    mountChart(inexCanvas, {
      type: 'line',
      data: {
        labels: inex.labels,
        datasets: [
          { label: 'Kum. Einnahmen', data: inex.cumInc, borderColor: '#10b981', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3 },
          { label: 'Kum. Ausgaben', data: inex.cumExp, borderColor: '#ef4444', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3 },
        ],
      },
      options: {
        ...BASE, interaction: { mode: 'index', intersect: false }, scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'line'>['options'],
    });
  }

  const MERCHANT_COLORS = [
    'rgba(59,130,246,.75)', 'rgba(139,92,246,.75)', 'rgba(16,185,129,.75)',
    'rgba(245,158,11,.75)', 'rgba(239,68,68,.75)', 'rgba(236,72,153,.75)',
  ];

  const merchCanvas = getCanvas(container, 'tl-merchants');
  if (merchCanvas) {
    const merch = getMerchantTimelineData(a);
    mountChart(merchCanvas, {
      type: 'bar',
      data: {
        labels: merch.labels,
        datasets: merch.merchants.map((name, i) => ({
          label: name,
          data: merch.series[i]!,
          backgroundColor: MERCHANT_COLORS[i % MERCHANT_COLORS.length],
          borderRadius: 2,
        })),
      },
      options: {
        ...BASE, interaction: { mode: 'index', intersect: false },
        scales: { ...darkAxes(), x: { ...darkAxes().x, stacked: true }, y: { ...darkAxes().y, stacked: true } },
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }

  const fvCanvas = getCanvas(container, 'tl-fixvar');
  if (fvCanvas) {
    const fv = getFixVarTimelineData(a);
    mountChart(fvCanvas, {
      type: 'bar',
      data: {
        labels: fv.labels,
        datasets: [
          { label: 'Fixkosten', data: fv.fixed, backgroundColor: 'rgba(59,130,246,.7)', borderRadius: 2 },
          { label: 'Variable', data: fv.variable, backgroundColor: 'rgba(245,158,11,.7)', borderRadius: 2 },
        ],
      },
      options: {
        ...BASE, interaction: { mode: 'index', intersect: false },
        scales: { ...darkAxes(), x: { ...darkAxes().x, stacked: true }, y: { ...darkAxes().y, stacked: true } },
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }
}
