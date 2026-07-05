import { html, render, type TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import type { ChartConfiguration } from 'chart.js';
import { BASE, darkAxes, xScale, yScale } from '../../charts/chartTheme';
import { mountChart } from '../../charts/chartManager';
import { fmt, fmtD, PAL, typeLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import {
  computeAlerts,
  computeFinancialRatios,
  computeOverviewRates,
  getIncomeSources,
  getLast6MonthsChartData,
  getOverviewKpis,
  getRecurringExpenses,
  getSavingsRateTrendData,
  getTopExpenseCategoriesData,
  getTopMerchants,
  getTopTransactions,
  getVolumeByTypeChartData,
  type KpiCard,
} from './selectors';

export function mountOverviewView(container: HTMLElement, store: Store<AppState>): () => void {
  return subscribeSelected(store, (s) => [s.analysis], (state) => {
    render(view(state.analysis), container);
    if (state.analysis) mountCharts(container, state.analysis);
  });
}

function view(a: Analysis | null): TemplateResult {
  if (!a) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;

  const rates = computeOverviewRates(a);
  const kpis = getOverviewKpis(a, rates);
  const ratios = computeFinancialRatios(a, rates);
  const merchants = getTopMerchants(a, 10);
  const incomeSources = getIncomeSources(a);
  const recurring = getRecurringExpenses(a, 8);
  const alerts = computeAlerts(a, rates);
  const topTx = getTopTransactions(a, 12);

  return html`
    <div class="g6" style="margin-bottom:1.2rem;">${kpis.map(kpiCard)}</div>

    <div class="g2" style="margin-bottom:1.2rem;">
      ${chartCard('Letzte 6 Monate — Einnahmen vs. Ausgaben', 'ov-bar')}
      ${chartCard('Volumen nach Transaktionstyp', 'ov-donut')}
    </div>
    <div class="g2" style="margin-bottom:1.2rem;">
      ${chartCard('Monatlicher Trend — Sparquote', 'ov-sr')}
      ${chartCard('Top-5 Ausgabenkategorien', 'ov-catbar')}
    </div>

    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Finanz-Kennzahlen</span></div>
        <div>${ratios.map((r) => html`
          <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.82rem;">
            <span style="color:var(--text-muted)">${r.label}</span>
            <strong style="color:${r.good ? 'var(--income)' : 'var(--text-dim)'}">${r.value}</strong>
          </div>
        `)}</div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Top-Händler / Empfänger</span></div>
        <div style="overflow-x:auto">
          <table class="dt">
            <thead><tr><th>Händler</th><th>Zahlungen</th><th>Ø Betrag</th><th>Gesamt</th></tr></thead>
            <tbody>${merchants.map((m) => html`
              <tr><td>${m.name}</td><td>${m.count}×</td><td class="neg">${m.avg}</td><td class="neg">${m.total}</td></tr>
            `)}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Einnahmenquellen</span></div>
        <div>
          ${incomeSources.length === 0
            ? html`<div style="padding:.5rem;color:var(--text-muted);font-size:.82rem;">Keine Einnahmen erkannt.</div>`
            : incomeSources.map((s) => html`
                <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.82rem;">
                  <div><span style="color:var(--text)">${s.label}</span> <span style="color:var(--text-muted);font-size:.72rem;">(${s.count}×)</span></div>
                  <div style="display:flex;align-items:center;gap:.8rem;">
                    <div style="width:60px;background:var(--surface3);border-radius:3px;height:4px;overflow:hidden;">
                      <div style="width:${s.pct}%;height:100%;background:var(--income);border-radius:3px;"></div>
                    </div>
                    <strong class="pos" style="min-width:80px;text-align:right;">${s.total}</strong>
                    <span style="color:var(--text-muted);min-width:40px;text-align:right;">${s.pctLabel}</span>
                  </div>
                </div>
              `)}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Wiederkehrende Ausgaben</span></div>
        <div>
          ${recurring.rows.length === 0
            ? html`<div style="padding:.5rem;color:var(--text-muted);font-size:.82rem;">Keine wiederkehrenden Zahlungen erkannt.</div>`
            : html`
                ${recurring.rows.map((s) => html`
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.82rem;">
                    <div><span style="color:var(--text)">${s.name}</span> <span style="color:var(--text-muted);font-size:.72rem;">(${s.monthCount} Monate)</span></div>
                    <div style="display:flex;align-items:center;gap:.6rem;">
                      <span class="neg">${s.perMonth}/Mo</span>
                      <span style="color:var(--text-muted);font-size:.72rem;">≈ ${s.perYear}/Jahr</span>
                    </div>
                  </div>
                `)}
                <div style="padding:.5rem 0;font-size:.78rem;color:var(--text-muted);border-top:1px solid rgba(255,255,255,.08);margin-top:.3rem;">
                  Gesamt: <strong style="color:var(--expense)">${recurring.totalPerMonth}/Mo</strong>
                  (≈ ${recurring.totalPerYear}/Jahr)
                </div>
              `}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Auffälligkeiten auf einen Blick</span></div>
      <div>
        ${alerts.length === 0
          ? html`<div class="ins-desc" style="padding:.5rem">Keine besonderen Auffälligkeiten.</div>`
          : alerts.map((al) => html`
              <div class="insight"><div class="dot ${al.color}"></div><div class="ins-desc">${unsafeHTML(al.text)}</div></div>
            `)}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Größte Einzeltransaktionen</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Datum</th><th>Name / Beschreibung</th><th>Typ</th><th>Betrag</th></tr></thead>
          <tbody>${topTx.map((r) => html`
            <tr>
              <td>${fmtD(r._date)}</td>
              <td>${r._name || r._desc || '—'}</td>
              <td><span class="badge bb">${typeLabel(r._type)}</span></td>
              <td class=${r._amt >= 0 ? 'pos' : 'neg'}>${fmt(r._amt)}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>
  `;
}

function kpiCard(k: KpiCard): TemplateResult {
  return html`
    <div class="kpi ${k.cls}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.cls}">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `;
}

function chartCard(title: string, chartKey: string): TemplateResult {
  return html`
    <div class="card">
      <div class="card-header"><span class="card-title">${title}</span></div>
      <div class="chart-wrap short"><canvas data-chart=${chartKey}></canvas></div>
    </div>
  `;
}

function getCanvas(container: HTMLElement, key: string): HTMLCanvasElement {
  const el = container.querySelector<HTMLCanvasElement>(`[data-chart="${key}"]`);
  if (!el) throw new Error(`chart canvas "${key}" not found`);
  return el;
}

function mountCharts(container: HTMLElement, a: Analysis): void {
  const last6 = getLast6MonthsChartData(a);
  mountChart(getCanvas(container, 'ov-bar'), {
    type: 'bar',
    data: {
      labels: last6.labels,
      datasets: [
        { label: 'Einnahmen', data: last6.income, backgroundColor: 'rgba(16,185,129,.7)', borderRadius: 4 },
        { label: 'Ausgaben', data: last6.expense, backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 4 },
      ],
    },
    options: {
      ...BASE,
      interaction: { mode: 'index', intersect: false },
      scales: darkAxes(),
      plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
    } as ChartConfiguration<'bar'>['options'],
  });

  const volume = getVolumeByTypeChartData(a);
  mountChart(getCanvas(container, 'ov-donut'), {
    type: 'doughnut',
    data: {
      labels: volume.labels,
      datasets: [{ data: volume.values, backgroundColor: PAL.slice(0, volume.labels.length), borderWidth: 0 }],
    },
    options: {
      ...BASE,
      cutout: '65%',
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10 } } },
    } as ChartConfiguration<'doughnut'>['options'],
  });

  const srData = getSavingsRateTrendData(a);
  mountChart(getCanvas(container, 'ov-sr'), {
    type: 'line',
    data: {
      labels: srData.labels,
      datasets: [
        {
          label: 'Sparquote', data: srData.savingsRate, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 3,
          pointBackgroundColor: '#f59e0b', tension: 0.3, fill: { target: 'origin', above: 'rgba(245,158,11,.1)' },
        },
        {
          label: 'Ziel 20%', data: srData.target, borderColor: 'rgba(16,185,129,.4)', borderDash: [5, 5],
          borderWidth: 1, pointRadius: 0, fill: false,
        },
      ],
    },
    options: {
      ...BASE,
      scales: { x: xScale(), y: { ...yScale(false), ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => v + '%' } } },
      plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + Number(c.parsed.y).toFixed(1) + '%' } } },
    } as ChartConfiguration<'line'>['options'],
  });

  const topCats = getTopExpenseCategoriesData(a, 5);
  mountChart(getCanvas(container, 'ov-catbar'), {
    type: 'bar',
    data: {
      labels: topCats.labels,
      datasets: [{ data: topCats.values, backgroundColor: PAL.slice(0, 5).map((c) => c + 'CC'), borderRadius: 4 }],
    },
    options: {
      ...BASE,
      indexAxis: 'y',
      scales: { x: yScale(), y: { ...xScale(), ticks: { color: '#94a3b8', font: { size: 9 } } } },
      plugins: { ...BASE.plugins, legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.parsed.x ?? 0) } } },
    } as ChartConfiguration<'bar'>['options'],
  });
}
