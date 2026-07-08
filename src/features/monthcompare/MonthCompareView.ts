import { html, render, type TemplateResult } from 'lit-html';
import type { ChartConfiguration } from 'chart.js';
import { mountChart } from '../../charts/chartManager';
import { BASE, darkAxes } from '../../charts/chartTheme';
import { fmt, mLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState, MonthCompareMetric } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import {
  computeMonthInsights,
  computeMonthKpis,
  getDividendComparison,
  getMerchantComparison,
  getMonthCategoryComparison,
  getMonthDeltaTableRows,
  getMonthMetricBarData,
  getMonthMetricTimelineData,
  getRecurringExpensesDelta,
  getTopSingleExpenses,
  getUniqueMerchants,
} from './selectors';

const METRIC_LABELS: Record<MonthCompareMetric, string> = {
  income: 'Einnahmen', expense: 'Ausgaben', net: 'Netto', invested: 'Investiert', dividend: 'Dividenden',
};
const METRIC_OPTIONS: MonthCompareMetric[] = ['income', 'expense', 'net', 'invested', 'dividend'];

function deltaArrow(positive: boolean): TemplateResult {
  const color = positive ? 'var(--income)' : 'var(--expense)';
  const arrow = positive ? '▲' : '▼';
  return html`<span style="font-size:.68rem;color:${color}">${arrow}</span>`;
}

export function mountMonthCompareView(container: HTMLElement, store: Store<AppState>, actions: AppActions): () => void {
  const rerender = () => {
    const state = store.getState();
    if (state.analysis && state.analysis.mKeys.length >= 2) {
      if (!state.monthCompare.monthA || !state.monthCompare.monthB) {
        const keys = state.analysis.mKeys;
        if (!state.monthCompare.monthA) actions.setMonthCompareA(keys[keys.length - 2]!);
        if (!state.monthCompare.monthB) actions.setMonthCompareB(keys[keys.length - 1]!);
        return;
      }
    }
    render(view(state, actions), container);
    if (state.analysis && state.monthCompare.monthA && state.monthCompare.monthB) {
      mountMonthCompareCharts(container, state.analysis, state.monthCompare.monthA, state.monthCompare.monthB, state.monthCompare.metric);
    }
  };
  const unsubscribe = store.subscribe(rerender);
  rerender();
  return unsubscribe;
}

function view(state: AppState, actions: AppActions): TemplateResult {
  const a = state.analysis;
  if (!a) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;
  if (a.mKeys.length < 2) return html`<p style="color:var(--text-muted)">Mindestens zwei Monate benötigt für einen Vergleich.</p>`;

  const { monthA, monthB, metric } = state.monthCompare;
  if (!monthA || !monthB) return html``;

  const mA = a.months[monthA];
  const mB = a.months[monthB];
  if (!mA || !mB) return html`<p style="color:var(--text-muted)">Ausgewählte Monate nicht gefunden.</p>`;

  const labelA = mLabel(monthA);
  const labelB = mLabel(monthB);
  const kpis = computeMonthKpis(mA, mB);
  const insights = computeMonthInsights(mA, mB, labelA, labelB, a, monthA, monthB);
  const deltaRows = getMonthDeltaTableRows(mA, mB, a, monthA, monthB);
  const merchants = getMerchantComparison(a, monthA, monthB);
  const unique = getUniqueMerchants(a, monthA, monthB);
  const topA = getTopSingleExpenses(a, monthA);
  const topB = getTopSingleExpenses(a, monthB);
  const divs = getDividendComparison(a, monthA, monthB);
  const recurring = getRecurringExpensesDelta(a, monthA, monthB);

  return html`
    <div class="compare-header">
      <div class="compare-title">${labelA} vs. ${labelB}</div>
      <div class="controls">
        <select style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:.3rem .6rem;font-size:.78rem;"
          .value=${monthA}
          @change=${(e: Event) => actions.setMonthCompareA((e.target as HTMLSelectElement).value)}>
          ${a.mKeys.map((mk) => html`<option value=${mk} ?selected=${mk === monthA}>${mLabel(mk)}</option>`)}
        </select>
        <span style="color:var(--text-muted);font-size:.85rem;padding:0 .3rem">vs.</span>
        <select style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:.3rem .6rem;font-size:.78rem;"
          .value=${monthB}
          @change=${(e: Event) => actions.setMonthCompareB((e.target as HTMLSelectElement).value)}>
          ${a.mKeys.map((mk) => html`<option value=${mk} ?selected=${mk === monthB}>${mLabel(mk)}</option>`)}
        </select>
      </div>
    </div>

    <div style="margin-bottom:1.2rem;">
      <div class="cmp-grid">
        <div style="background:var(--surface2);border-radius:10px;padding:1rem;border-left:3px solid var(--accent)">
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:.7rem">${labelA}</div>
          ${kpis.map((k) => html`<div class="cmp-kpi-row"><span style="color:var(--text-muted)">${k.label}</span><strong>${k.label === 'Sparquote' ? `${k.vA.toFixed(1)}%` : fmt(k.vA)}</strong></div>`)}
        </div>
        <div style="display:flex;flex-direction:column;justify-content:center;gap:.3rem;padding:.5rem 0;min-width:90px;">
          <div style="font-size:.6rem;text-align:center;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Delta</div>
          <div class="cmp-delta-rows">
            ${kpis.map((k) => {
              const d = k.vB - k.vA;
              const isRate = k.label === 'Sparquote';
              const p = isRate ? d : (k.vA ? (d / Math.abs(k.vA)) * 100 : 0);
              return html`<div class="cmp-kpi-row" style="text-align:center;justify-content:center;font-size:.78rem;font-weight:700;color:${d >= 0 ? 'var(--income)' : 'var(--expense)'};">
                ${isRate ? `${d >= 0 ? '+' : ''}${d.toFixed(1)} PP` : `${d >= 0 ? '+' : ''}${fmt(d)}`}<br>
                <span style="font-size:.68rem">${isRate ? '—' : `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`}</span>
              </div>`;
            })}
          </div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:1rem;border-left:3px solid var(--accent2)">
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent2);margin-bottom:.7rem">${labelB}</div>
          ${kpis.map((k) => html`<div class="cmp-kpi-row"><span style="color:var(--text-muted)">${k.label}</span><strong>${k.label === 'Sparquote' ? `${k.vB.toFixed(1)}%` : fmt(k.vB)}</strong></div>`)}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Kennzahlen-Vergleich</span></div>
      <div class="chart-wrap tall"><canvas data-chart="mc-bar"></canvas></div>
    </div>

    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header">
        <span class="card-title">Zeitverlauf — ${METRIC_LABELS[metric]}</span>
        <div class="controls">
          ${METRIC_OPTIONS.map((m) => html`<button class="cb ${metric === m ? 'active' : ''}" @click=${() => actions.setMonthCompareMetric(m)}>${METRIC_LABELS[m]}</button>`)}
        </div>
      </div>
      <div class="chart-wrap"><canvas data-chart="mc-timeline"></canvas></div>
      <div style="margin-top:.5rem;font-size:.72rem;color:var(--text-muted);">Die ausgewählten Monate sind hervorgehoben.</div>
    </div>

    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Ausgaben nach Kategorie</span></div>
        <div class="chart-wrap tall"><canvas data-chart="mc-cat"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Erkenntnisse</span></div>
        <div>
          ${insights.map((i) => html`
            <div class="insight" style="margin-bottom:.5rem"><div class="dot ${i.color}"></div><div><div class="ins-title">${i.title}</div><div class="ins-desc">${i.desc}</div></div></div>
          `)}
        </div>
      </div>
    </div>

    ${merchants.length > 0 ? html`
    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Händler-Vergleich — Top Ausgaben</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Händler</th><th>${labelA}</th><th></th><th>${labelB}</th><th></th><th>Delta</th></tr></thead>
          <tbody>${merchants.map((m) => html`
            <tr>
              <td><strong>${m.name}</strong></td>
              <td style="color:var(--text-dim)">${m.countA}× ${fmt(m.totalA)}</td>
              <td><div style="background:rgba(59,130,246,.6);height:8px;border-radius:4px;width:${Math.min(100, merchants[0]!.totalA > 0 ? (m.totalA / merchants[0]!.totalA) * 100 : 0)}%"></div></td>
              <td style="color:var(--text-dim)">${m.countB}× ${fmt(m.totalB)}</td>
              <td><div style="background:rgba(139,92,246,.6);height:8px;border-radius:4px;width:${Math.min(100, merchants[0]!.totalB > 0 ? (m.totalB / merchants[0]!.totalB) * 100 : 0)}%"></div></td>
              <td class=${m.delta <= 0 ? 'pos' : 'neg'}>${m.delta >= 0 ? '+' : ''}${fmt(m.delta)} ${deltaArrow(m.delta <= 0)}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>
    ` : ''}

    ${unique.onlyA.length > 0 || unique.onlyB.length > 0 ? html`
    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Nur in ${labelA}</span></div>
        <div style="padding:.2rem 0">
          ${unique.onlyA.length > 0 ? unique.onlyA.map((u) => html`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem .8rem;border-bottom:1px solid var(--border)">
              <span style="color:var(--text);font-size:.82rem">${u.name} <span style="color:var(--text-muted);font-size:.72rem">${u.count}×</span></span>
              <strong style="color:var(--expense);font-size:.82rem">${fmt(u.total)}</strong>
            </div>
          `) : html`<div style="padding:.5rem .8rem;color:var(--text-muted);font-size:.82rem">Keine exklusiven Händler</div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Nur in ${labelB}</span></div>
        <div style="padding:.2rem 0">
          ${unique.onlyB.length > 0 ? unique.onlyB.map((u) => html`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem .8rem;border-bottom:1px solid var(--border)">
              <span style="color:var(--text);font-size:.82rem">${u.name} <span style="color:var(--text-muted);font-size:.72rem">${u.count}×</span></span>
              <strong style="color:var(--expense);font-size:.82rem">${fmt(u.total)}</strong>
            </div>
          `) : html`<div style="padding:.5rem .8rem;color:var(--text-muted);font-size:.82rem">Keine exklusiven Händler</div>`}
        </div>
      </div>
    </div>
    ` : ''}

    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Top-Einzelausgaben ${labelA}</span></div>
        <div style="padding:.2rem 0">
          ${topA.map((t, i) => html`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem .8rem;border-bottom:1px solid var(--border)">
              <span style="color:var(--text);font-size:.82rem"><span style="color:var(--text-muted);font-size:.72rem">${i + 1}.</span> ${t.name} <span style="color:var(--text-muted);font-size:.72rem">${t.date}</span></span>
              <strong style="color:var(--expense);font-size:.82rem">${fmt(t.amount)}</strong>
            </div>
          `)}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Top-Einzelausgaben ${labelB}</span></div>
        <div style="padding:.2rem 0">
          ${topB.map((t, i) => html`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem .8rem;border-bottom:1px solid var(--border)">
              <span style="color:var(--text);font-size:.82rem"><span style="color:var(--text-muted);font-size:.72rem">${i + 1}.</span> ${t.name} <span style="color:var(--text-muted);font-size:.72rem">${t.date}</span></span>
              <strong style="color:var(--expense);font-size:.82rem">${fmt(t.amount)}</strong>
            </div>
          `)}
        </div>
      </div>
    </div>

    ${divs.countA > 0 || divs.countB > 0 ? html`
    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Dividenden-Vergleich</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Kennzahl</th><th>${labelA}</th><th>${labelB}</th><th>Delta</th></tr></thead>
          <tbody>
            <tr><td><strong>Ausschüttungen</strong></td><td style="color:var(--text-dim)">${divs.countA}</td><td style="color:var(--text-dim)">${divs.countB}</td><td class=${divs.countB >= divs.countA ? 'pos' : 'neg'}>${divs.countB - divs.countA >= 0 ? '+' : ''}${divs.countB - divs.countA}</td></tr>
            <tr><td><strong>Dividenden</strong></td><td style="color:var(--dividend)">${fmt(divs.totalA)}</td><td style="color:var(--dividend)">${fmt(divs.totalB)}</td><td class=${divs.totalB >= divs.totalA ? 'pos' : 'neg'}>${fmt(divs.totalB - divs.totalA)} ${deltaArrow(divs.totalB >= divs.totalA)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    ${recurring.length > 0 ? html`
    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header"><span class="card-title">Wiederkehrende Ausgaben</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Ausgabe</th><th>${labelA}</th><th>${labelB}</th><th>Delta</th></tr></thead>
          <tbody>${recurring.map((r) => html`
            <tr>
              <td><strong>${r.name}</strong></td>
              <td style="color:var(--text-dim)">${fmt(r.amountA)}</td>
              <td style="color:var(--text-dim)">${fmt(r.amountB)}</td>
              <td class=${r.deltaPositive ? 'pos' : 'neg'}>${r.delta >= 0 ? '+' : ''}${fmt(r.delta)} ${r.delta !== 0 ? deltaArrow(r.deltaPositive) : ''}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <div class="card">
      <div class="card-header"><span class="card-title">Detailvergleich</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Kennzahl</th><th>${labelA}</th><th>${labelB}</th><th>Delta abs.</th><th>Delta %</th></tr></thead>
          <tbody>${deltaRows.map((r) => html`
            <tr>
              <td><strong>${r.label}</strong></td>
              <td style="color:var(--text-dim)">${r.vA}</td>
              <td style="color:var(--text-dim)">${r.vB}</td>
              <td class=${r.deltaPositive ? 'pos' : 'neg'}>${r.delta} ${deltaArrow(r.deltaPositive)}</td>
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

function mountMonthCompareCharts(
  container: HTMLElement, analysis: Analysis, monthA: string, monthB: string, metric: MonthCompareMetric,
): void {
  const mA = analysis.months[monthA]!;
  const mB = analysis.months[monthB]!;
  const labelA = mLabel(monthA);
  const labelB = mLabel(monthB);

  const barCanvas = getCanvas(container, 'mc-bar');
  if (barCanvas) {
    const data = getMonthMetricBarData(mA, mB, labelA, labelB);
    mountChart(barCanvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          { label: labelA, data: data.valuesA, backgroundColor: 'rgba(59,130,246,.75)', borderRadius: 4 },
          { label: labelB, data: data.valuesB, backgroundColor: 'rgba(139,92,246,.75)', borderRadius: 4 },
        ],
      },
      options: {
        ...BASE, interaction: { mode: 'index', intersect: false }, scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }

  const tlCanvas = getCanvas(container, 'mc-timeline');
  if (tlCanvas) {
    const tl = getMonthMetricTimelineData(analysis, metric, monthA, monthB);
    const bgColors = tl.values.map((_, i) => {
      if (i === tl.highlightA) return 'rgba(59,130,246,.9)';
      if (i === tl.highlightB) return 'rgba(139,92,246,.9)';
      return 'rgba(100,116,139,.3)';
    });
    const borderColors = tl.values.map((_, i) => {
      if (i === tl.highlightA) return '#3b82f6';
      if (i === tl.highlightB) return '#8b5cf6';
      return 'rgba(100,116,139,.5)';
    });
    mountChart(tlCanvas, {
      type: 'bar',
      data: {
        labels: tl.labels,
        datasets: [{
          label: METRIC_LABELS[metric],
          data: tl.values,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 4,
        }],
      },
      options: {
        ...BASE, scales: darkAxes(),
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${METRIC_LABELS[metric]}: ${fmt(c.parsed.y ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }

  const catCanvas = getCanvas(container, 'mc-cat');
  if (catCanvas) {
    const cat = getMonthCategoryComparison(analysis, monthA, monthB);
    mountChart(catCanvas, {
      type: 'bar',
      data: {
        labels: cat.labels,
        datasets: [
          { label: labelA, data: cat.deltasA, backgroundColor: 'rgba(59,130,246,.7)', borderRadius: 4 },
          { label: labelB, data: cat.deltasB, backgroundColor: 'rgba(139,92,246,.7)', borderRadius: 4 },
        ],
      },
      options: {
        ...BASE, indexAxis: 'y', interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8b9bb5', font: { size: 10 }, callback: (v) => fmt(Number(v), 0) } },
          y: { grid: { display: false }, ticks: { color: '#b0bfd0', font: { size: 11 } } },
        },
        plugins: { ...BASE.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.x ?? 0)}` } } },
      } as ChartConfiguration<'bar'>['options'],
    });
  }
}
