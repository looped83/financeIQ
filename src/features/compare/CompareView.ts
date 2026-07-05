import { html, render, type TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import type { ChartConfiguration } from 'chart.js';
import { mountChart } from '../../charts/chartManager';
import { BASE, darkAxes, xScale, yScale } from '../../charts/chartTheme';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { fmt } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState, CompareMetric } from '../../state/appState';
import type { Store } from '../../state/store';
import {
  buildMonthAlign,
  computeCompareInsights,
  computeCompareKpis,
  computeCompareLabels,
  getCategoryDeltaChartData,
  getCompareDeltaTableRows,
  getMonthlyMetricChartData,
  getNetDeltaChartData,
} from './selectors';

const METRIC_LABELS: Record<CompareMetric, string> = {
  income: 'Einnahmen', expense: 'Ausgaben', net: 'Netto-Cashflow', invested: 'Investitionen',
};
const METRIC_OPTIONS: CompareMetric[] = ['income', 'expense', 'net', 'invested'];

export function mountCompareView(container: HTMLElement, store: Store<AppState>, actions: AppActions): () => void {
  const rerender = () => {
    const state = store.getState();
    render(view(state, actions), container);
    if (state.analysis && state.compare.analysis) {
      mountCompareCharts(container, state.analysis, state.compare.analysis, state.compare.metric);
    }
  };
  rerender();
  return store.subscribe(rerender);
}

function view(state: AppState, actions: AppActions): TemplateResult {
  if (!state.analysis) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;
  if (!state.compare.analysis) return uploadView(actions, state.analysis, state.fileName);
  return dashboardView(state.analysis, state.compare.analysis, state.fileName, state.compare.fileName, state.compare.metric, actions);
}

function uploadView(actions: AppActions, primaryAnalysis: Analysis, primaryFileName: string): TemplateResult {
  const onFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows2 = parseCSV(String(reader.result));
      actions.loadCompareFile(analyze(rows2), file.name);
    };
    reader.readAsText(file);
  };
  void primaryAnalysis;
  void primaryFileName;

  return html`
    <div class="card" style="max-width:520px;">
      <div class="card-header"><span class="card-title">Vergleichsdatei hochladen</span></div>
      <div class="section-note">Lade eine zweite CSV-Datei (z.B. Vorjahr) für einen direkten Jahresvergleich mit monatlichen Deltas, Kategorien-Analyse und automatisch generierten Erkenntnissen.</div>
      <div class="upload2">
        <input type="file" accept=".csv" @change=${onFileChange}>
        <div style="font-size:2rem;margin-bottom:.5rem;">📂</div>
        <div style="font-size:.9rem;font-weight:600;margin-bottom:.3rem;">Zweite CSV auswählen</div>
        <div style="font-size:.77rem;color:var(--text-muted);">Gleiche Spaltenstruktur empfohlen (z.B. Vorjahresdatei)</div>
      </div>
    </div>
  `;
}

function dashboardView(
  a1: Analysis, a2: Analysis, name1: string, name2: string, metric: CompareMetric, actions: AppActions,
): TemplateResult {
  const labels = computeCompareLabels(a1, a2, name1, name2);
  const kpis = computeCompareKpis(a1, a2);
  const align = buildMonthAlign(a1, a2);
  const insights = computeCompareInsights(a1, a2, labels, align);
  const deltaRows = getCompareDeltaTableRows(a1, a2);

  return html`
    <div class="compare-header">
      <div class="compare-title">${labels.y1} vs. ${labels.y2}</div>
      <button class="cb" @click=${() => actions.resetCompare()}>× Vergleich zurücksetzen</button>
    </div>
    <div style="margin-bottom:1.2rem;">
      <div class="cmp-grid">
        <div style="background:var(--surface2);border-radius:10px;padding:1rem;border-left:3px solid var(--accent)">
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:.7rem">Basis: ${name1}</div>
          ${kpis.map((k) => html`<div class="cmp-kpi-row"><span style="color:var(--text-muted)">${k.label}</span><strong>${fmt(k.v1)}</strong></div>`)}
        </div>
        <div style="display:flex;flex-direction:column;justify-content:center;gap:.3rem;padding:.5rem 0;min-width:90px;">
          <div style="font-size:.6rem;text-align:center;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Delta</div>
          <div class="cmp-delta-rows">
            ${kpis.map((k) => {
              const d = k.v2 - k.v1;
              const p = k.v1 ? (d / Math.abs(k.v1)) * 100 : 0;
              return html`<div class="cmp-kpi-row" style="text-align:center;justify-content:center;font-size:.78rem;font-weight:700;color:${d >= 0 ? 'var(--income)' : 'var(--expense)'};">
                ${d >= 0 ? '+' : ''}${fmt(d)}<br><span style="font-size:.68rem">${p >= 0 ? '+' : ''}${p.toFixed(1)}%</span>
              </div>`;
            })}
          </div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:1rem;border-left:3px solid var(--accent2)">
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent2);margin-bottom:.7rem">Vergleich: ${name2}</div>
          ${kpis.map((k) => html`<div class="cmp-kpi-row"><span style="color:var(--text-muted)">${k.label}</span><strong>${fmt(k.v2)}</strong></div>`)}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header">
        <span class="card-title">Monatlicher Vergleich — ${METRIC_LABELS[metric]}</span>
        <div class="controls">
          ${METRIC_OPTIONS.map((m) => html`<button class="cb ${metric === m ? 'active' : ''}" @click=${() => actions.setCompareMetric(m)}>${METRIC_LABELS[m]}</button>`)}
        </div>
      </div>
      <div class="chart-wrap tall"><canvas data-chart="cmp-monthly"></canvas></div>
    </div>
    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Monatliches Delta (Vergleich minus Basis)</span></div>
      <div class="chart-wrap"><canvas data-chart="cmp-delta"></canvas></div>
    </div>
    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Kategorie-Vergleich</span></div>
        <div class="chart-wrap tall"><canvas data-chart="cmp-cat"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Automatische Erkenntnisse</span></div>
        <div>
          ${insights.map((i) => html`
            <div class="insight" style="margin-bottom:.5rem"><div class="dot ${i.color}"></div><div><div class="ins-title">${i.title}</div><div class="ins-desc">${unsafeHTML(i.desc)}</div></div></div>
          `)}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Vollständige KPI-Gegenüberstellung</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Kennzahl</th><th>Basis (${labels.y1})</th><th>Vergleich (${labels.y2})</th><th>Delta abs.</th><th>Delta %</th></tr></thead>
          <tbody>${deltaRows.map((r) => html`
            <tr>
              <td>${r.label}</td><td>${r.v1}</td><td>${r.v2}</td>
              <td class=${r.deltaPositive ? 'pos' : 'neg'}>${r.delta}</td>
              <td class=${r.deltaPctPositive ? 'pos' : 'neg'}>${r.deltaPct}</td>
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

function mountCompareCharts(container: HTMLElement, a1: Analysis, a2: Analysis, metric: CompareMetric): void {
  const labels = computeCompareLabels(a1, a2, 'Basis', 'Vergleich');
  const align = buildMonthAlign(a1, a2);

  const monthlyCanvas = getCanvas(container, 'cmp-monthly');
  if (monthlyCanvas) {
    const data = getMonthlyMetricChartData(align, metric);
    mountChart(monthlyCanvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          { label: labels.y1, data: data.series1, backgroundColor: 'rgba(59,130,246,.75)', borderRadius: 4 },
          { label: labels.y2, data: data.series2, backgroundColor: 'rgba(139,92,246,.75)', borderRadius: 4 },
        ],
      },
      options: {
        ...BASE, interaction: { mode: 'index', intersect: false }, scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }

  const deltaCanvas = getCanvas(container, 'cmp-delta');
  if (deltaCanvas) {
    const delta = getNetDeltaChartData(align);
    mountChart(deltaCanvas, {
      type: 'bar',
      data: {
        labels: delta.labels,
        datasets: [{
          label: 'Delta Netto (Vergleich - Basis)', data: delta.deltas,
          backgroundColor: delta.deltas.map((d) => (d >= 0 ? 'rgba(16,185,129,.75)' : 'rgba(239,68,68,.75)')), borderRadius: 4,
        }],
      },
      options: {
        ...BASE, scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `Delta: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }

  const catCanvas = getCanvas(container, 'cmp-cat');
  if (catCanvas) {
    const catDelta = getCategoryDeltaChartData(a1, a2);
    mountChart(catCanvas, {
      type: 'bar',
      data: {
        labels: catDelta.labels,
        datasets: [{
          label: 'Ausgaben-Delta (Vergleich - Basis)', data: catDelta.deltas,
          backgroundColor: catDelta.deltas.map((d) => (d > 0 ? 'rgba(239,68,68,.75)' : 'rgba(16,185,129,.75)')), borderRadius: 4,
        }],
      },
      options: {
        ...BASE, indexAxis: 'y', scales: { x: yScale(), y: xScale() },
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.label}: ${fmt(c.parsed.x ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }
}
