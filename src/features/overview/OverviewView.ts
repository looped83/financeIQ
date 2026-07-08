import { html, render, type TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import type { ChartConfiguration } from 'chart.js';
import { BASE, darkAxes, xScale, yScale } from '../../charts/chartTheme';
import { mountChart } from '../../charts/chartManager';
import { fmt, mLabel, PAL } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import {
  computeAlerts,
  computeFinancialRatios,
  computeOverviewRates,
  getAllMonthsTrendData,
  getIncomeSources,
  getLast6MonthsChartData,
  getOverviewKpis,
  getRecurringExpenses,
  getTopExpenseCategoriesData,
  getTopMerchants,
  getVolumeByTypeChartData,
  type KpiCard,
} from './selectors';
import {
  buildMonthlySnapshots,
  computeBestWorstMonths,
  computeDeepDiveChartsData,
  computeTrends,
} from '../deepdive/selectors';

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

  const snapshots = buildMonthlySnapshots(a);
  const hasSnapshots = snapshots.length >= 2;
  const trends = hasSnapshots ? computeTrends(snapshots) : [];
  const { best, worst } = hasSnapshots ? computeBestWorstMonths(snapshots) : { best: [], worst: [] };

  return html`
    <div class="g6" style="margin-bottom:1.2rem;">${kpis.map(kpiCard)}</div>

    <div class="g2" style="margin-bottom:1.2rem;">
      ${chartCard('Letzte 6 Monate — Einnahmen vs. Ausgaben', 'ov-bar')}
      ${chartCard('Volumen nach Transaktionstyp', 'ov-donut')}
    </div>
    <div class="g2" style="margin-bottom:1.2rem;">
      ${hasSnapshots ? html`
        <div class="card">
          <div class="card-header"><span class="card-title">Netto-Cashflow & Sparquote</span></div>
          <div class="chart-wrap tall"><canvas data-chart="ov-dd-net"></canvas></div>
        </div>
      ` : chartCard('Netto-Cashflow & Sparquote', 'ov-dd-net')}
      <div class="card">
        <div class="card-header"><span class="card-title">Top-5 Ausgabenkategorien</span></div>
        <div class="chart-wrap tall"><canvas data-chart="ov-catbar"></canvas></div>
      </div>
    </div>

    <div class="g2" style="margin-bottom:1.2rem;">
      ${hasSnapshots ? html`
        <div class="card">
          <div class="card-header"><span class="card-title">Kumulierter Netto-Cashflow</span></div>
          <div class="chart-wrap"><canvas data-chart="ov-dd-cumnet"></canvas></div>
        </div>
      ` : ''}
      <div class="card">
        <div class="card-header"><span class="card-title">Einnahmen vs. Ausgaben — Gesamttrend</span></div>
        <div class="chart-wrap"><canvas data-chart="ov-trend"></canvas></div>
      </div>
    </div>

    ${hasSnapshots ? html`
      <div class="card" style="margin-bottom:1.2rem;">
        <div class="card-header"><span class="card-title">Ausgaben nach Kategorie im Zeitverlauf</span></div>
        <div class="chart-wrap"><canvas data-chart="ov-dd-catstack"></canvas></div>
      </div>
    ` : ''}

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
            <thead><tr><th>Händler</th><th>Zahlungen</th><th>Gesamt</th></tr></thead>
            <tbody>${merchants.map((m) => html`
              <tr><td>${m.name}</td><td>${m.count}×</td><td class="neg">${m.total}</td></tr>
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
                <div style="display:grid;grid-template-columns:minmax(0,1fr) 56px auto 42px;align-items:center;gap:.7rem;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.82rem;">
                  <div style="min-width:0;"><span style="color:var(--text)">${s.label}</span> <span style="color:var(--text-muted);font-size:.72rem;">(${s.count}×)</span></div>
                  <div style="background:var(--surface3);border-radius:3px;height:4px;overflow:hidden;">
                    <div style="width:${s.pct}%;height:100%;background:var(--income);border-radius:3px;"></div>
                  </div>
                  <strong class="pos" style="text-align:right;white-space:nowrap;">${s.total}</strong>
                  <span style="color:var(--text-muted);text-align:right;white-space:nowrap;">${s.pctLabel}</span>
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
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.82rem;">
                    <div style="flex:1;min-width:0;"><span style="color:var(--text)">${s.name}</span> <span style="color:var(--text-muted);font-size:.72rem;">(${s.monthCount} Monate)</span></div>
                    <div style="display:flex;align-items:center;gap:.6rem;flex-shrink:0;white-space:nowrap;">
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

    ${hasSnapshots ? html`
      <div class="g2" style="margin-bottom:1.2rem;">
        <div class="card">
          <div class="card-header"><span class="card-title">Beste Monate</span></div>
          <div>
            ${best.map((m, i) => html`
              <div class="insight"><div class="dot green"></div><div style="flex:1">
                <div class="ins-title" style="display:flex;align-items:center;gap:.5rem">#${i + 1} ${mLabel(m.month)}
                  <span class="badge bg">Netto: ${m.net}</span></div>
                <div class="ins-desc">Einnahmen: ${m.income} | Ausgaben: ${m.expense} | Sparquote: ${m.savingsRate}</div>
              </div></div>
            `)}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Schwächste Monate</span></div>
          <div>
            ${worst.map((m, i) => html`
              <div class="insight"><div class="dot ${m.netValue < 0 ? 'red' : 'yellow'}"></div><div style="flex:1">
                <div class="ins-title" style="display:flex;align-items:center;gap:.5rem">#${i + 1} ${mLabel(m.month)}
                  <span class="badge ${m.netValue < 0 ? 'br' : 'by'}">Netto: ${m.net}</span></div>
                <div class="ins-desc">Einnahmen: ${m.income} | Ausgaben: ${m.expense} | Sparquote: ${m.savingsRate}</div>
              </div></div>
            `)}
          </div>
        </div>
      </div>
    ` : ''}

    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Trends & Auffälligkeiten</span></div>
      <div>
        ${hasSnapshots && trends.length > 0 ? trends.map((t) => html`
          <div class="insight"><div class="dot ${t.color}"></div><div style="flex:1">
            <div class="ins-title">${t.title}</div><div class="ins-desc">${t.desc}</div></div></div>
        `) : ''}
        ${alerts.length === 0 && (!hasSnapshots || trends.length === 0)
          ? html`<div class="ins-desc" style="padding:.5rem">Keine besonderen Auffälligkeiten.</div>`
          : alerts.map((al) => {
              const m = al.text.match(/^<strong>(.+?):?<\/strong>\s*(.+)$/);
              const title = m ? m[1] : '';
              const desc = m ? m[2] : al.text;
              return html`
                <div class="insight"><div class="dot ${al.color}"></div><div style="flex:1">
                  ${title ? html`<div class="ins-title">${title}</div>` : ''}
                  <div class="ins-desc">${unsafeHTML(desc)}</div></div></div>
              `;
            })}
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

function getCanvas(container: HTMLElement, key: string): HTMLCanvasElement | null {
  return container.querySelector<HTMLCanvasElement>(`[data-chart="${key}"]`);
}

function mountCharts(container: HTMLElement, a: Analysis): void {
  const last6 = getLast6MonthsChartData(a);
  mountChart(getCanvas(container, 'ov-bar')!, {
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
  mountChart(getCanvas(container, 'ov-donut')!, {
    type: 'doughnut',
    data: {
      labels: volume.labels,
      datasets: [{ data: volume.values, backgroundColor: PAL.slice(0, volume.labels.length), borderWidth: 0 }],
    },
    options: {
      ...BASE,
      cutout: '65%',
      plugins: { legend: { position: 'right', labels: { color: '#b0bfd0', font: { size: 10 }, boxWidth: 10 } } },
    } as ChartConfiguration<'doughnut'>['options'],
  });

  const trendData = getAllMonthsTrendData(a);
  const trendCanvas = getCanvas(container, 'ov-trend');
  if (trendCanvas) {
    mountChart(trendCanvas, {
      type: 'line',
      data: {
        labels: trendData.labels,
        datasets: [
          { label: 'Einnahmen', data: trendData.income, borderColor: '#10b981', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#10b981', tension: 0.3, fill: { target: 'origin', above: 'rgba(16,185,129,.08)' } },
          { label: 'Ausgaben', data: trendData.expense, borderColor: '#ef4444', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#ef4444', tension: 0.3, fill: { target: 'origin', above: 'rgba(239,68,68,.08)' } },
        ],
      },
      options: {
        ...BASE,
        interaction: { mode: 'index', intersect: false },
        scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'line'>['options'],
    });
  }

  const topCats = getTopExpenseCategoriesData(a, 5);
  mountChart(getCanvas(container, 'ov-catbar')!, {
    type: 'bar',
    data: {
      labels: topCats.labels,
      datasets: [{ data: topCats.values, backgroundColor: PAL.slice(0, 5).map((c) => c + 'CC'), borderRadius: 4 }],
    },
    options: {
      ...BASE,
      indexAxis: 'y',
      scales: { x: yScale(), y: { ...xScale(), ticks: { color: '#b0bfd0', font: { size: 9 } } } },
      plugins: { ...BASE.plugins, legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.parsed.x ?? 0) } } },
    } as ChartConfiguration<'bar'>['options'],
  });

  // Deep-Dive charts (only if enough months)
  const snapshots = buildMonthlySnapshots(a);
  if (snapshots.length < 2) return;
  const dd = computeDeepDiveChartsData(snapshots);

  const netCanvas = getCanvas(container, 'ov-dd-net');
  if (netCanvas) {
    mountChart(netCanvas, {
      type: 'bar',
      data: {
        labels: dd.labels,
        datasets: [
          { label: 'Netto-Cashflow', data: dd.net, backgroundColor: dd.net.map((v) => (v >= 0 ? 'rgba(16,185,129,.7)' : 'rgba(239,68,68,.7)')), borderRadius: 4, yAxisID: 'y' },
          { label: 'Sparquote %', data: dd.savingsRate, type: 'line', borderColor: '#f59e0b', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#f59e0b', tension: 0.3, yAxisID: 'y1' },
        ],
      },
      options: {
        ...BASE, interaction: { mode: 'index', intersect: false },
        scales: {
          x: xScale(), y: yScale(),
          y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#f59e0b', font: { size: 10 }, callback: (v) => Number(v).toFixed(0) + '%' } },
        },
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => (c.datasetIndex === 0 ? `Netto: ${fmt(c.parsed.y ?? 0)}` : `Sparquote: ${Number(c.parsed.y ?? 0).toFixed(1)}%`) } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }

  const cumCanvas = getCanvas(container, 'ov-dd-cumnet');
  if (cumCanvas) {
    mountChart(cumCanvas, {
      type: 'line',
      data: {
        labels: dd.labels,
        datasets: [
          { label: 'Kum. Netto', data: dd.cumNet, borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#3b82f6', fill: { target: 'origin', above: 'rgba(16,185,129,.08)', below: 'rgba(239,68,68,.08)' }, tension: 0.3 },
        ],
      },
      options: {
        ...BASE, scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `Kumuliert: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'line'>['options'],
    });
  }

  const catStackCanvas = getCanvas(container, 'ov-dd-catstack');
  if (catStackCanvas) {
    mountChart(catStackCanvas, {
      type: 'bar',
      data: {
        labels: dd.labels,
        datasets: dd.categoryStack.map((series, i) => ({
          label: series.label, data: series.data, backgroundColor: PAL[i % PAL.length] + 'CC', borderRadius: 2,
        })),
      },
      options: {
        ...BASE, scales: { x: xScale(), y: yScale() },
        plugins: {
          ...BASE.plugins, legend: { labels: { color: '#b0bfd0', font: { size: 9 }, boxWidth: 8 } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } },
        },
      } as ChartConfiguration<'bar'>['options'],
    });
  }
}
