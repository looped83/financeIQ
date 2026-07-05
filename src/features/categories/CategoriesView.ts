import { html, render, type TemplateResult } from 'lit-html';
import type { ChartConfiguration } from 'chart.js';
import { mountChart } from '../../charts/chartManager';
import { BASE, xScale, yScale } from '../../charts/chartTheme';
import { fmt, PAL, typeLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import {
  getAssetClassChartData,
  getDividendsBySecurity,
  getExpenseCategoryDonutData,
  getExpenseCategoryLegend,
  getIncomeExpenseByTypeData,
  getTopMerchants,
} from './selectors';

export function mountCategoriesView(container: HTMLElement, store: Store<AppState>): () => void {
  return subscribeSelected(store, (s) => [s.analysis], (state) => {
    render(view(state.analysis), container);
    if (state.analysis) mountCharts(container, state.analysis);
  });
}

function view(a: Analysis | null): TemplateResult {
  if (!a) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;

  const legend = getExpenseCategoryLegend(a, 10);
  const merchants = getTopMerchants(a, 15);
  const dividends = getDividendsBySecurity(a);

  return html`
    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Ausgaben nach Typ</span></div>
        <div class="chart-wrap"><canvas data-chart="cat-donut"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Ranking &amp; Anteil</span></div>
        <ul class="leg">
          ${legend.map((r, i) => html`
            <li>
              <div class="leg-label"><div class="leg-dot" style="background:${PAL[i % PAL.length]}"></div>${r.label}</div>
              <div>
                <strong>${r.value}</strong> <span style="color:var(--text-muted);font-size:.73rem">${r.pctLabel}</span>
                <div class="pb-wrap" style="width:70px"><div class="pb-fill" style="width:${r.pct}%;background:${PAL[i % PAL.length]}"></div></div>
              </div>
            </li>
          `)}
        </ul>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Einnahmen &amp; Ausgaben je Kategorie</span></div>
      <div class="chart-wrap tall"><canvas data-chart="cat-bar"></canvas></div>
    </div>

    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Investitionen nach Asset-Klasse</span></div>
        <div class="chart-wrap short"><canvas data-chart="cat-asset"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Top-Händler (Kartenzahlungen)</span></div>
        <div style="overflow-x:auto">
          <table class="dt">
            <thead><tr><th>Händler</th><th>Zahlungen</th><th>Gesamt</th><th>Ø je Zahlung</th></tr></thead>
            <tbody>${merchants.map((m) => html`
              <tr><td>${m.name}</td><td>${m.count}×</td><td class="neg">${m.total}</td><td class="neg">${m.avg}</td></tr>
            `)}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Dividenden nach Wertpapier</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Wertpapier</th><th>Zahlungen</th><th>Brutto</th><th>Steuern</th><th>Netto</th><th>Anteil</th></tr></thead>
          <tbody>${dividends.map((d) => html`
            <tr>
              <td>${d.name}</td><td>${d.count}×</td>
              <td class="pos">${d.brutto}</td><td class="neg">${d.steuer}</td><td class="pos">${d.netto}</td>
              <td style="color:var(--text-muted)">${d.pctLabel}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>
  `;
}

function getCanvas(container: HTMLElement, key: string): HTMLCanvasElement {
  const el = container.querySelector<HTMLCanvasElement>(`[data-chart="${key}"]`);
  if (!el) throw new Error(`chart canvas "${key}" not found`);
  return el;
}

function mountCharts(container: HTMLElement, a: Analysis): void {
  const donut = getExpenseCategoryDonutData(a, 10);
  mountChart(getCanvas(container, 'cat-donut'), {
    type: 'doughnut',
    data: { labels: donut.labels, datasets: [{ data: donut.values, backgroundColor: PAL.slice(0, donut.labels.length), borderWidth: 0, hoverOffset: 8 }] },
    options: {
      ...BASE,
      cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmt(Number(c.parsed))} (${((Number(c.parsed) / donut.total) * 100).toFixed(1)}%)` } },
      },
    } as ChartConfiguration<'doughnut'>['options'],
  });

  const byType = getIncomeExpenseByTypeData(a, 12);
  mountChart(getCanvas(container, 'cat-bar'), {
    type: 'bar',
    data: {
      labels: byType.labels.map(typeLabel),
      datasets: [
        { label: 'Einnahmen', data: byType.income, backgroundColor: 'rgba(16,185,129,.75)', borderRadius: 4 },
        { label: 'Ausgaben', data: byType.expense, backgroundColor: 'rgba(239,68,68,.75)', borderRadius: 4 },
      ],
    },
    options: {
      ...BASE,
      indexAxis: 'y',
      scales: { x: yScale(), y: xScale() },
      plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.x ?? 0)}` } } },
    } as ChartConfiguration<'bar'>['options'],
  });

  const assetClass = getAssetClassChartData(a);
  mountChart(getCanvas(container, 'cat-asset'), {
    type: 'doughnut',
    data: { labels: assetClass.labels, datasets: [{ data: assetClass.values, backgroundColor: PAL.slice(0, assetClass.labels.length), borderWidth: 0 }] },
    options: {
      ...BASE,
      cutout: '55%',
      plugins: { legend: { position: 'right', labels: { color: '#b0bfd0', font: { size: 10 }, boxWidth: 10 } } },
    } as ChartConfiguration<'doughnut'>['options'],
  });
}
