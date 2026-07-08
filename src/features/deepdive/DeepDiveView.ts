import { html, render, type TemplateResult } from 'lit-html';
import type { ChartConfiguration } from 'chart.js';
import { mountChart } from '../../charts/chartManager';
import { BASE, darkAxes, xScale, yScale } from '../../charts/chartTheme';
import { fmt, mLabel, PAL } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import {
  buildMonthlySnapshots,
  computeAttentionItems,
  computeBestWorstMonths,
  computeDeepDiveChartsData,
  computeDeepDiveKpis,
  computeDeepDiveRecommendations,
  computeDetailTableRows,
  computeImprovedWorsened,
  computeMonthChanges,
  computeTrends,
  type MonthSnapshot,
} from './selectors';

export function mountDeepDiveView(container: HTMLElement, store: Store<AppState>, actions: AppActions): () => void {
  // subscribeSelected registers the subscription before the first render: the
  // render below can itself call actions.setDeepDiveMonth() (default-month
  // selection), which must synchronously re-notify this same subscriber.
  return subscribeSelected(store, (s) => [s.analysis, s.deepDiveSelectedMonth], (state) => {
    if (!state.analysis) {
      render(html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`, container);
      return;
    }

    const snapshots = buildMonthlySnapshots(state.analysis);
    if (snapshots.length < 2) {
      render(
        html`<p style="color:var(--text-muted)">Mindestens 2 Monate an Daten erforderlich — CSV mit längerem Zeitraum hochladen.</p>`,
        container,
      );
      return;
    }

    const validMonths = snapshots.map((s) => s.month);
    const selectedMonth = state.deepDiveSelectedMonth;
    if (!selectedMonth || !validMonths.includes(selectedMonth)) {
      // Defaults to the most recent month on first load; setDeepDiveMonth's
      // resulting state change re-triggers this same subscriber synchronously,
      // and the branch above won't be taken again once it's set.
      actions.setDeepDiveMonth(validMonths[validMonths.length - 1]!);
      return;
    }

    render(view(snapshots, selectedMonth, actions), container);
    mountCharts(container, snapshots);
  });
}

function view(snapshots: MonthSnapshot[], selectedMonth: string, actions: AppActions): TemplateResult {
  const n = snapshots.length;
  const kpis = computeDeepDiveKpis(snapshots);
  const changes = computeMonthChanges(snapshots, selectedMonth);
  const { improved, worsened } = computeImprovedWorsened(snapshots);
  const { best, worst } = computeBestWorstMonths(snapshots);
  const trends = computeTrends(snapshots);
  const attention = computeAttentionItems(snapshots);
  const recommendations = computeDeepDiveRecommendations(snapshots);
  const detailRows = computeDetailTableRows(snapshots);

  return html`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem;flex-wrap:wrap;gap:.5rem;">
      <div>
        <div style="font-size:1.2rem;font-weight:800;letter-spacing:-.5px;">Deep-Dive — Einnahmen &amp; Ausgaben</div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
          ${n} Monate: ${mLabel(snapshots[0]!.month)} bis ${mLabel(snapshots[n - 1]!.month)}
        </div>
      </div>
    </div>

    <div class="g6" style="margin-bottom:1.2rem;">
      ${kpis.map((k) => html`
        <div class="kpi ${k.cls}"><div class="kpi-label">${k.label}</div>
          <div class="kpi-value ${k.cls}">${k.value}</div><div class="kpi-sub">${k.sub}</div></div>
      `)}
    </div>

    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Einnahmen vs. Ausgaben je Monat</span></div>
        <div class="chart-wrap tall"><canvas data-chart="mc-incexp"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Netto-Cashflow &amp; Sparquote</span></div>
        <div class="chart-wrap tall"><canvas data-chart="mc-net"></canvas></div>
      </div>
    </div>
    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Kumulierter Netto-Cashflow</span></div>
        <div class="chart-wrap"><canvas data-chart="mc-cumnet"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Ausgaben nach Kategorie im Zeitverlauf</span></div>
        <div class="chart-wrap"><canvas data-chart="mc-catstack"></canvas></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header">
        <span class="card-title">Veränderungen zum Vormonat</span>
        <select class="tx-input tx-select"
          @change=${(e: Event) => actions.setDeepDiveMonth((e.target as HTMLSelectElement).value)}>
          ${snapshots.slice(1).map((s) => html`
            <option value=${s.month} ?selected=${s.month === selectedMonth}>${mLabel(s.month)}</option>
          `)}
        </select>
      </div>
      <div>
        ${changes.length === 0
          ? html`<div class="ins-desc">Kein Vormonat verfügbar.</div>`
          : changes.map((c) => html`
              <div class="insight"><div class="dot ${c.color}"></div><div style="flex:1">
                <div class="ins-title">${c.icon} ${c.title}</div>
                <div class="ins-desc">${c.desc}</div></div></div>
            `)}
      </div>
    </div>

    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Verbessert — Positive Entwicklungen</span></div>
        <div>
          ${improved.length === 0
            ? html`<div class="ins-desc" style="padding:.5rem;color:var(--text-muted);">Keine wesentlichen Verbesserungen zum Vormonat.</div>`
            : improved.map((item) => html`
                <div class="insight"><div class="dot green"></div><div style="flex:1">
                  <div class="ins-title">${item.icon} ${item.title}</div><div class="ins-desc">${item.desc}</div></div></div>
              `)}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Verschlechtert — Negative Entwicklungen</span></div>
        <div>
          ${worsened.length === 0
            ? html`<div class="ins-desc" style="padding:.5rem;color:var(--text-muted);">Keine wesentlichen Verschlechterungen erkannt.</div>`
            : worsened.map((item) => html`
                <div class="insight"><div class="dot red"></div><div style="flex:1">
                  <div class="ins-title">${item.icon} ${item.title}</div><div class="ins-desc">${item.desc}</div></div></div>
              `)}
        </div>
      </div>
    </div>

    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Größte Gewinner (Monate)</span></div>
        <div>
          ${best.map((m, i) => html`
            <div class="insight"><div class="dot green"></div><div style="flex:1">
              <div class="ins-title" style="display:flex;align-items:center;gap:.5rem">#${i + 1} ${mLabel(m.month)}
                <span class="badge bg">Netto: ${m.net}</span></div>
              <div class="ins-desc">Einnahmen: ${m.income} | Ausgaben: ${m.expense} | Sparquote: ${m.savingsRate} | Dividenden: ${m.dividend}</div>
            </div></div>
          `)}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Größte Verlierer (Monate)</span></div>
        <div>
          ${worst.map((m, i) => html`
            <div class="insight"><div class="dot ${m.netValue < 0 ? 'red' : 'yellow'}"></div><div style="flex:1">
              <div class="ins-title" style="display:flex;align-items:center;gap:.5rem">#${i + 1} ${mLabel(m.month)}
                <span class="badge ${m.netValue < 0 ? 'br' : 'by'}">Netto: ${m.net}</span></div>
              <div class="ins-desc">Einnahmen: ${m.income} | Ausgaben: ${m.expense} | Sparquote: ${m.savingsRate} | ${m.txCount} Transaktionen</div>
            </div></div>
          `)}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Trends &amp; Muster</span></div>
      <div>
        ${trends.map((t) => html`
          <div class="insight"><div class="dot ${t.color}"></div><div style="flex:1">
            <div class="ins-title">${t.icon} ${t.title}</div><div class="ins-desc">${t.desc}</div></div></div>
        `)}
      </div>
    </div>

    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Handlungsbedarf</span></div>
        <div>
          ${attention.length === 0
            ? html`<div class="ins-desc" style="padding:.5rem;color:var(--text-muted);">Keine dringenden Auffälligkeiten.</div>`
            : attention.map((item) => html`
                <div class="insight"><div class="dot ${item.color}"></div><div style="flex:1">
                  <div class="ins-title">${item.icon} ${item.title}</div><div class="ins-desc">${item.desc}</div></div></div>
              `)}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Empfehlungen</span></div>
        <div>
          ${recommendations.map((r) => html`
            <div class="insight"><div class="dot ${r.color}"></div><div style="flex:1">
              <div class="ins-title">${r.title}</div><div class="ins-desc">${r.desc}</div></div></div>
          `)}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Monatliche Detailübersicht</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Netto</th><th>Sparquote</th><th>Dividenden</th><th>Investiert</th><th>Karten-Tx</th><th>Gesamt-Tx</th></tr></thead>
          <tbody>${detailRows.map((d) => html`
            <tr class=${d.isBest ? 'row-best' : d.isWorst ? 'row-worst' : ''}>
              <td><strong>${d.month}</strong></td>
              <td class="pos">${d.income} ${deltaArrow(d.incomeDelta)}</td>
              <td class="neg">${d.expense} ${deltaArrow(d.expenseDelta)}</td>
              <td class=${d.netPositive ? 'pos' : 'neg'}>${d.net}</td>
              <td class=${d.savingsRateCls}>${d.savingsRate}</td>
              <td style="color:var(--dividend)">${d.dividend}</td>
              <td class="neu">${d.invested}</td>
              <td style="color:var(--text-muted)">${d.cardCount}×</td>
              <td style="color:var(--text-muted)">${d.txCount}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>
  `;
}

function deltaArrow(direction: 'up' | 'down' | null): TemplateResult | '' {
  if (!direction) return '';
  const color = direction === 'up' ? 'var(--income)' : 'var(--expense)';
  const arrow = direction === 'up' ? '▲' : '▼';
  return html`<span style="font-size:.68rem;color:${color}">${arrow}</span>`;
}

function getCanvas(container: HTMLElement, key: string): HTMLCanvasElement {
  const el = container.querySelector<HTMLCanvasElement>(`[data-chart="${key}"]`);
  if (!el) throw new Error(`chart canvas "${key}" not found`);
  return el;
}

function mountCharts(container: HTMLElement, snapshots: MonthSnapshot[]): void {
  const data = computeDeepDiveChartsData(snapshots);

  mountChart(getCanvas(container, 'mc-incexp'), {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        { label: 'Einnahmen', data: data.income, backgroundColor: 'rgba(16,185,129,.75)', borderRadius: 4 },
        { label: 'Ausgaben', data: data.expense, backgroundColor: 'rgba(239,68,68,.75)', borderRadius: 4 },
        { label: 'Dividenden', data: data.dividend, backgroundColor: 'rgba(139,92,246,.6)', borderRadius: 4 },
      ],
    },
    options: {
      ...BASE, interaction: { mode: 'index', intersect: false }, scales: darkAxes(),
      plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
    } as ChartConfiguration<'bar'>['options'],
  });

  mountChart(getCanvas(container, 'mc-net'), {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        { label: 'Netto-Cashflow', data: data.net, backgroundColor: data.net.map((v) => (v >= 0 ? 'rgba(16,185,129,.7)' : 'rgba(239,68,68,.7)')), borderRadius: 4, yAxisID: 'y' },
        { label: 'Sparquote %', data: data.savingsRate, type: 'line', borderColor: '#f59e0b', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#f59e0b', tension: 0.3, yAxisID: 'y1' },
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

  mountChart(getCanvas(container, 'mc-cumnet'), {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        { label: 'Kum. Netto', data: data.cumNet, borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#3b82f6', fill: { target: 'origin', above: 'rgba(16,185,129,.08)', below: 'rgba(239,68,68,.08)' }, tension: 0.3 },
      ],
    },
    options: {
      ...BASE, scales: darkAxes(),
      plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `Kumuliert: ${fmt(c.parsed.y ?? 0)}` } } },
    } as ChartConfiguration<'line'>['options'],
  });

  mountChart(getCanvas(container, 'mc-catstack'), {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: data.categoryStack.map((series, i) => ({
        label: series.label, data: series.data, backgroundColor: PAL[i % PAL.length] + 'CC', borderRadius: 2,
      })),
    },
    options: {
      ...BASE, scales: { x: xScale(), y: yScale() },
      plugins: {
        ...BASE.plugins, legend: { labels: { color: '#94a3b8', font: { size: 9 }, boxWidth: 8 } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } },
      },
    } as ChartConfiguration<'bar'>['options'],
  });
}
