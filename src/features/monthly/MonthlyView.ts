import { html, render, type TemplateResult } from 'lit-html';
import type { ChartConfiguration } from 'chart.js';
import { mountChart } from '../../charts/chartManager';
import { BASE, darkAxes, xScale, yScale } from '../../charts/chartTheme';
import { fmt, mLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import {
  getMonthlyCumulativeChartData,
  getMonthlyGroupedChartData,
  getMonthlySavingsRateChartData,
} from './selectors';
import { buildMonthlySnapshots, computeDetailTableRows } from '../deepdive/selectors';

export function mountMonthlyView(container: HTMLElement, store: Store<AppState>): () => void {
  return subscribeSelected(store, (s) => [s.analysis], (state) => {
    render(view(state.analysis), container);
    if (state.analysis) mountCharts(container, state.analysis);
  });
}

function deltaArrow(direction: 'up' | 'down' | null): TemplateResult | '' {
  if (!direction) return '';
  const color = direction === 'up' ? 'var(--income)' : 'var(--expense)';
  const arrow = direction === 'up' ? '▲' : '▼';
  return html`<span style="font-size:.68rem;color:${color}">${arrow}</span>`;
}

function view(a: Analysis | null): TemplateResult {
  if (!a) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;
  const snapshots = buildMonthlySnapshots(a);
  const detailRows = snapshots.length >= 2 ? computeDetailTableRows(snapshots) : [];

  return html`
    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Einnahmen, Ausgaben &amp; Investitionen je Monat</span></div>
      <div class="chart-wrap tall"><canvas data-chart="mo-grouped"></canvas></div>
    </div>
    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Kumulierter Netto-Saldo</span></div>
        <div class="chart-wrap"><canvas data-chart="mo-cum"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Monatliche Sparquote</span></div>
        <div class="chart-wrap"><canvas data-chart="mo-savings"></canvas></div>
      </div>
    </div>
    ${detailRows.length > 0 ? html`
      <div class="card">
        <div class="card-header"><span class="card-title">Monatliche Detailübersicht</span></div>
        <div style="overflow-x:auto">
          <table class="dt">
            <thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Netto</th><th>Sparquote</th><th>Dividenden</th><th>Investiert</th><th>Steuern</th><th>Karten-Tx</th><th>Gesamt-Tx</th></tr></thead>
            <tbody>${detailRows.map((d) => html`
              <tr class=${d.isBest ? 'row-best' : d.isWorst ? 'row-worst' : ''}>
                <td><strong>${d.month}</strong></td>
                <td class="pos">${d.income} ${deltaArrow(d.incomeDelta)}</td>
                <td class="neg">${d.expense} ${deltaArrow(d.expenseDelta)}</td>
                <td class=${d.netPositive ? 'pos' : 'neg'}>${d.net}</td>
                <td class=${d.savingsRateCls}>${d.savingsRate}</td>
                <td style="color:var(--dividend)">${d.dividend}</td>
                <td class="neu">${d.invested}</td>
                <td style="color:var(--text-muted)">${d.tax}</td>
                <td style="color:var(--text-muted)">${d.cardCount}×</td>
                <td style="color:var(--text-muted)">${d.txCount}</td>
              </tr>
            `)}</tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

function getCanvas(container: HTMLElement, key: string): HTMLCanvasElement {
  const el = container.querySelector<HTMLCanvasElement>(`[data-chart="${key}"]`);
  if (!el) throw new Error(`chart canvas "${key}" not found`);
  return el;
}

function mountCharts(container: HTMLElement, a: Analysis): void {
  const grouped = getMonthlyGroupedChartData(a);
  mountChart(getCanvas(container, 'mo-grouped'), {
    type: 'bar',
    data: {
      labels: grouped.labels,
      datasets: [
        { label: 'Einnahmen', data: grouped.income, backgroundColor: 'rgba(16,185,129,.75)', borderRadius: 3 },
        { label: 'Ausgaben', data: grouped.expense, backgroundColor: 'rgba(239,68,68,.75)', borderRadius: 3 },
        { label: 'Investiert', data: grouped.invested, backgroundColor: 'rgba(59,130,246,.75)', borderRadius: 3 },
      ],
    },
    options: {
      ...BASE,
      interaction: { mode: 'index', intersect: false },
      scales: darkAxes(),
      plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
    } as ChartConfiguration<'bar'>['options'],
  });

  const cumulative = getMonthlyCumulativeChartData(a);
  mountChart(getCanvas(container, 'mo-cum'), {
    type: 'line',
    data: {
      labels: cumulative.labels,
      datasets: [
        {
          label: 'Kum. Saldo', data: cumulative.cumBal, borderColor: '#8b5cf6', borderWidth: 2, pointRadius: 3,
          pointBackgroundColor: '#8b5cf6', fill: { target: 'origin', above: 'rgba(139,92,246,.1)' }, tension: 0.3,
        },
      ],
    },
    options: {
      ...BASE,
      scales: darkAxes(),
      plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `Saldo: ${fmt(c.parsed.y ?? 0)}` } } },
    } as ChartConfiguration<'line'>['options'],
  });

  const savings = getMonthlySavingsRateChartData(a);
  mountChart(getCanvas(container, 'mo-savings'), {
    type: 'line',
    data: {
      labels: savings.labels,
      datasets: [
        {
          label: 'Sparquote %', data: savings.savingsRate, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 3,
          pointBackgroundColor: '#f59e0b',
          fill: { target: { value: 0 }, above: 'rgba(245,158,11,.1)', below: 'rgba(239,68,68,.1)' },
          tension: 0.3,
        },
      ],
    },
    options: {
      ...BASE,
      scales: { x: xScale(), y: { ...yScale(false), ticks: { color: '#8b9bb5', font: { size: 10 }, callback: (v) => v + '%' } } },
      plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `Sparquote: ${Number(c.parsed.y ?? 0).toFixed(1)}%` } } },
    } as ChartConfiguration<'line'>['options'],
  });
}
