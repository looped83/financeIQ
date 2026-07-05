import { html, render, type TemplateResult } from 'lit-html';
import type { ChartConfiguration } from 'chart.js';
import { mountChart } from '../../charts/chartManager';
import { BASE, darkAxes } from '../../charts/chartTheme';
import { fmt } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import {
  computeQuarterlyBreakdown,
  getQuarterlyChartData,
  getYearlyChartData,
  getYearlyKpiCards,
  getYearlyTableRows,
  isMultiYear,
} from './selectors';

export function mountYearlyView(container: HTMLElement, store: Store<AppState>): () => void {
  return subscribeSelected(store, (s) => [s.analysis], (state) => {
    render(view(state.analysis), container);
    if (state.analysis) mountCharts(container, state.analysis);
  });
}

function view(a: Analysis | null): TemplateResult {
  if (!a) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;
  return isMultiYear(a) ? multiYearView(a) : singleYearView(a);
}

function singleYearView(a: Analysis): TemplateResult {
  const breakdown = computeQuarterlyBreakdown(a);
  return html`
    <div class="section-note">Datensatz enthält nur <strong>${breakdown.year}</strong> — Quartalsansicht. Lade eine mehrjährige CSV für den Jahresvergleich.</div>
    <div class="g4" style="margin-bottom:1.2rem;">
      ${(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
        const qa = breakdown.quarters[q];
        const cls = qa.net >= 0 ? 'income' : 'expense';
        return html`
          <div class="kpi ${cls}">
            <div class="kpi-label">${q} ${breakdown.year}</div>
            <div class="kpi-value ${cls}">${fmt(qa.net)}</div>
            <div class="kpi-sub">Einnahmen: ${fmt(qa.income)}</div>
            <div class="kpi-sub">Ausgaben: ${fmt(Math.abs(qa.expense))}</div>
          </div>
        `;
      })}
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Quartals-Breakdown ${breakdown.year}</span></div>
      <div class="chart-wrap tall"><canvas data-chart="yr-q"></canvas></div>
    </div>
  `;
}

function multiYearView(a: Analysis): TemplateResult {
  const cards = getYearlyKpiCards(a);
  const rows = getYearlyTableRows(a);
  const gridClass = `g${Math.min(cards.length, 4)}`;

  return html`
    <div class="${gridClass}" style="margin-bottom:1.2rem;">
      ${cards.map((c) => html`
        <div class="kpi ${c.netPositive ? 'balance' : 'expense'}">
          <div class="kpi-label">${c.year}</div>
          <div class="kpi-value ${c.netPositive ? 'invest' : 'expense'}">${c.net}</div>
          <div class="kpi-sub">Einnahmen: ${c.income}</div>
          <div class="kpi-sub">Ausgaben: ${c.expense}</div>
          ${c.yoyIncomeChange !== null
            ? html`<div class="kpi-trend ${c.yoyIncomeUp ? 'up' : 'down'}">${c.yoyIncomeChange} Einnahmen YoY</div>`
            : ''}
        </div>
      `)}
    </div>
    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Jahresvergleich — Alle Kennzahlen</span></div>
      <div class="chart-wrap tall"><canvas data-chart="yr-bar"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Jahres-Übersicht</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Jahr</th><th>Einnahmen</th><th>Ausgaben</th><th>Netto</th><th>Investiert</th><th>Dividenden</th><th>Gebühren</th><th>Steuern</th><th>Sparquote</th></tr></thead>
          <tbody>${rows.map((r) => html`
            <tr class=${r.isBest ? 'row-best' : r.isWorst ? 'row-worst' : ''}>
              <td><strong>${r.year}</strong></td>
              <td class="pos">${r.income}</td><td class="neg">${r.expense}</td>
              <td class=${r.netPositive ? 'pos' : 'neg'}>${r.net}</td>
              <td class="neu">${r.invested}</td><td style="color:var(--dividend)">${r.dividend}</td>
              <td>${r.fees}</td><td>${r.tax}</td>
              <td class=${r.savingsRateCls}>${r.savingsRate}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>
  `;
}

function getCanvas(container: HTMLElement, key: string): HTMLCanvasElement | null {
  return container.querySelector<HTMLCanvasElement>(`[data-chart="${key}"]`);
}

function mountCharts(container: HTMLElement, a: Analysis): void {
  if (isMultiYear(a)) {
    const canvas = getCanvas(container, 'yr-bar');
    if (!canvas) return;
    const data = getYearlyChartData(a);
    mountChart(canvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          { label: 'Einnahmen', data: data.income, backgroundColor: 'rgba(16,185,129,.75)', borderRadius: 4 },
          { label: 'Ausgaben', data: data.expense, backgroundColor: 'rgba(239,68,68,.75)', borderRadius: 4 },
          { label: 'Investiert', data: data.invested, backgroundColor: 'rgba(59,130,246,.75)', borderRadius: 4 },
          { label: 'Dividenden', data: data.dividend, backgroundColor: 'rgba(139,92,246,.75)', borderRadius: 4 },
        ],
      },
      options: {
        ...BASE,
        interaction: { mode: 'index', intersect: false },
        scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  } else {
    const canvas = getCanvas(container, 'yr-q');
    if (!canvas) return;
    const data = getQuarterlyChartData(computeQuarterlyBreakdown(a));
    mountChart(canvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          { label: 'Einnahmen', data: data.income, backgroundColor: 'rgba(16,185,129,.75)', borderRadius: 4 },
          { label: 'Ausgaben', data: data.expense, backgroundColor: 'rgba(239,68,68,.75)', borderRadius: 4 },
          { label: 'Investiert', data: data.invested, backgroundColor: 'rgba(59,130,246,.75)', borderRadius: 4 },
          { label: 'Dividenden', data: data.dividend, backgroundColor: 'rgba(139,92,246,.75)', borderRadius: 4 },
        ],
      },
      options: {
        ...BASE,
        interaction: { mode: 'index', intersect: false },
        scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }
}
