import { html, nothing, type TemplateResult } from 'lit-html';
import { mountChart } from '../../charts/chartManager';
import { axes, horizontalAxes, INDEX_TOOLTIP, xScale, yScale } from '../../charts/chartTheme';
import { fmt, mLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState, MonthCompareMetric } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { alpha, COLORS, SERIES } from '../../theme/palette';
import { card, chartBox, deltaMark, emptyState, getCanvas, insight, legend, segmented } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import {
  computeMonthInsights,
  getDividendComparison,
  getIntraMonthCashflowData,
  getMerchantComparison,
  getMonthCategoryComparison,
  getMonthDeltaTableRows,
  getMonthMetricTimelineData,
  getRecurringExpensesDelta,
  getTopSingleExpenses,
  getUniqueMerchants,
} from './selectors';

const METRICS: { value: MonthCompareMetric; label: string }[] = [
  { value: 'income', label: 'Einnahmen' },
  { value: 'expense', label: 'Ausgaben' },
  { value: 'net', label: 'Netto' },
  { value: 'invested', label: 'Investiert' },
  { value: 'dividend', label: 'Dividenden' },
];
/** Month A and month B keep these two colors on every chart of the page. */
const [COLOR_A, COLOR_B] = [SERIES[0], SERIES[1]];

const signed = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v)}`;

/** Compares two months of the whole history, independent of the global period. */
export function mountMonthCompareView(container: HTMLElement, store: Store<AppState>, actions: AppActions): Unsubscribe {
  return mountPage(container, store, (s) => [s.fullAnalysis, s.monthCompare], (state) => {
    const a = state.fullAnalysis;
    if (!hasData(a)) return { view: noData() };
    if (a.mKeys.length < 2) return { view: emptyState('Zu wenig Daten', 'Für einen Vergleich braucht es mindestens zwei Monate.') };

    const keys = a.mKeys;
    const monthA = state.monthCompare.monthA && a.months[state.monthCompare.monthA] ? state.monthCompare.monthA : keys[keys.length - 2]!;
    const monthB = state.monthCompare.monthB && a.months[state.monthCompare.monthB] ? state.monthCompare.monthB : keys[keys.length - 1]!;
    const metric = state.monthCompare.metric;
    return {
      view: view(a, monthA, monthB, metric, actions),
      charts: () => charts(container, a, monthA, monthB, metric),
    };
  });
}

function monthSelect(a: Analysis, label: string, value: string, pick: (m: string) => void): TemplateResult {
  return html`
    <select class="select" aria-label=${label} @change=${(e: Event) => pick((e.target as HTMLSelectElement).value)}>
      ${[...a.mKeys].reverse().map((mk) => html`<option value=${mk} ?selected=${mk === value}>${mLabel(mk)}</option>`)}
    </select>
  `;
}

function expenseList(items: { name: string; total?: number; amount?: number; count?: number; date?: string }[], emptyText: string): TemplateResult {
  if (!items.length) return html`<p class="muted">${emptyText}</p>`;
  return html`<ul class="rows">${items.map((i) => html`
    <li>
      <div class="row-main"><div class="row-title">${i.name}</div>
        <div class="row-sub">${i.date ?? `${i.count}×`}</div></div>
      <span class="row-value">${fmt(i.total ?? i.amount ?? 0)}</span>
    </li>`)}</ul>`;
}

function view(a: Analysis, monthA: string, monthB: string, metric: MonthCompareMetric, actions: AppActions): TemplateResult {
  const mA = a.months[monthA]!;
  const mB = a.months[monthB]!;
  const [labelA, labelB] = [mLabel(monthA), mLabel(monthB)];
  const deltaRows = getMonthDeltaTableRows(mA, mB, a, monthA, monthB);
  const insights = computeMonthInsights(mA, mB, labelA, labelB, a, monthA, monthB);
  const merchants = getMerchantComparison(a, monthA, monthB);
  const unique = getUniqueMerchants(a, monthA, monthB);
  const divs = getDividendComparison(a, monthA, monthB);
  const recurring = getRecurringExpensesDelta(a, monthA, monthB);
  const intra = getIntraMonthCashflowData(a, monthA, monthB);
  const abLegend = legend([{ label: labelA, color: COLOR_A }, { label: labelB, color: COLOR_B }]);

  return html`
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">${labelA} vs. ${labelB}</h2>
        <div class="page-actions">
          ${monthSelect(a, 'Erster Monat', monthA, (m) => actions.setMonthCompareA(m))}
          <span class="muted">vs.</span>
          ${monthSelect(a, 'Zweiter Monat', monthB, (m) => actions.setMonthCompareB(m))}
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th scope="col">Kennzahl</th><th scope="col">${labelA}</th><th scope="col">${labelB}</th><th scope="col">Differenz</th><th scope="col">in %</th></tr></thead>
          <tbody>${deltaRows.map((r) => html`
            <tr>
              <td>${r.label}</td><td>${r.vA}</td><td>${r.vB}</td>
              <td class=${r.deltaPositive ? 'pos' : 'neg'}>${r.delta}</td>
              <td>${r.deltaPct}</td>
            </tr>`)}</tbody>
        </table>
      </div>
    </section>

    <div class="grid">
      ${card({ title: 'Erkenntnisse' }, html`<div class="insights">${insights.map((i) => insight(i.color, i.title, i.desc))}</div>`)}
      ${card({
        title: 'Cashflow im Monatsverlauf',
        sub: html`Laufende Summe je Tag · Ende ${labelA}: <span class="num">${fmt(intra.endA)}</span> · ${labelB}: <span class="num">${fmt(intra.endB)}</span>`,
      }, chartBox('mc-intra', 'Kumulierter Cashflow je Tag beider Monate'))}
    </div>

    ${card({
      title: `Verlauf: ${METRICS.find((m) => m.value === metric)!.label}`,
      sub: 'Alle Monate, die beiden gewählten hervorgehoben',
      actions: segmented('Kennzahl', METRICS, metric, (m) => actions.setMonthCompareMetric(m)),
    }, html`${abLegend}${chartBox('mc-timeline', 'Kennzahl über alle Monate', 'sm')}`)}

    <div class="grid">
      ${card({ title: 'Ausgaben nach Kategorie' }, chartBox('mc-cat', 'Ausgaben je Kategorie in beiden Monaten', 'lg'))}
      ${card({ title: 'Händler im Vergleich', sub: 'Größte Ausgaben, Differenz = zweiter minus erster Monat' }, merchants.length
        ? html`<ul class="rows">${merchants.map((m) => html`
            <li>
              <div class="row-main"><div class="row-title">${m.name}</div>
                <div class="row-sub num">${labelA}: ${m.countA}× ${fmt(m.totalA)} · ${labelB}: ${m.countB}× ${fmt(m.totalB)}</div></div>
              <span class="row-value ${m.delta <= 0 ? 'pos' : 'neg'}">${signed(m.delta)}${deltaMark(m.delta > 0 ? 'up' : m.delta < 0 ? 'down' : null, 'down')}</span>
            </li>`)}</ul>`
        : html`<p class="muted">Keine Händler-Ausgaben in diesen Monaten.</p>`)}
    </div>

    <div class="grid">
      ${card({ title: `Nur in ${labelA}` }, expenseList(unique.onlyA, 'Keine exklusiven Händler.'))}
      ${card({ title: `Nur in ${labelB}` }, expenseList(unique.onlyB, 'Keine exklusiven Händler.'))}
    </div>

    <div class="grid">
      ${card({ title: `Größte Einzelausgaben ${labelA}` }, expenseList(getTopSingleExpenses(a, monthA), 'Keine Ausgaben.'))}
      ${card({ title: `Größte Einzelausgaben ${labelB}` }, expenseList(getTopSingleExpenses(a, monthB), 'Keine Ausgaben.'))}
    </div>

    <div class="grid">
      ${recurring.length
        ? card({ title: 'Wiederkehrende Ausgaben' }, html`
            <div class="table-wrap"><table class="table">
              <thead><tr><th scope="col">Ausgabe</th><th scope="col">${labelA}</th><th scope="col">${labelB}</th><th scope="col">Differenz</th></tr></thead>
              <tbody>${recurring.map((r) => html`
                <tr><td>${r.name}</td><td>${fmt(r.amountA)}</td><td>${fmt(r.amountB)}</td>
                  <td class=${r.deltaPositive ? 'pos' : 'neg'}>${signed(r.delta)}</td></tr>`)}</tbody>
            </table></div>`)
        : nothing}
      ${divs.countA || divs.countB
        ? card({ title: 'Dividenden' }, html`
            <ul class="rows">
              <li><span class="row-label">Ausschüttungen</span><span class="row-value">${divs.countA} → ${divs.countB}</span></li>
              <li><span class="row-label">Summe netto</span><span class="row-value">${fmt(divs.totalA)} → ${fmt(divs.totalB)}</span></li>
              <li><span class="row-label">Differenz</span>
                <span class="row-value ${divs.totalB >= divs.totalA ? 'pos' : 'neg'}">${signed(divs.totalB - divs.totalA)}</span></li>
            </ul>`)
        : nothing}
    </div>
  `;
}

function charts(root: HTMLElement, a: Analysis, monthA: string, monthB: string, metric: MonthCompareMetric): void {
  const intra = getIntraMonthCashflowData(a, monthA, monthB);
  mountChart(getCanvas(root, 'mc-intra'), {
    type: 'line',
    data: {
      labels: intra.days.map((d) => `${d}.`),
      datasets: [
        { label: intra.labelA, data: intra.seriesA, borderColor: COLOR_A, backgroundColor: COLOR_A, spanGaps: false },
        { label: intra.labelB, data: intra.seriesB, borderColor: COLOR_B, backgroundColor: COLOR_B, spanGaps: false },
      ],
    },
    options: {
      ...INDEX_TOOLTIP,
      scales: { x: xScale(), y: yScale() },
      plugins: { ...INDEX_TOOLTIP.plugins, tooltip: { callbacks: { ...INDEX_TOOLTIP.plugins.tooltip.callbacks, title: (i) => `Tag ${i[0]?.label ?? ''}` } } },
    },
  });

  const tl = getMonthMetricTimelineData(a, metric, monthA, monthB);
  const label = METRICS.find((m) => m.value === metric)!.label;
  mountChart(getCanvas(root, 'mc-timeline'), {
    type: 'bar',
    data: {
      labels: tl.labels,
      datasets: [{
        label, data: tl.values, maxBarThickness: 22,
        backgroundColor: tl.values.map((_, i) => (i === tl.highlightA ? COLOR_A : i === tl.highlightB ? COLOR_B : alpha(COLORS.other, 0.45))),
      }],
    },
    options: { ...INDEX_TOOLTIP, scales: axes(), plugins: { ...INDEX_TOOLTIP.plugins, legend: { display: false } } },
  });

  const cat = getMonthCategoryComparison(a, monthA, monthB);
  mountChart(getCanvas(root, 'mc-cat'), {
    type: 'bar',
    data: {
      labels: cat.labels,
      datasets: [
        { label: mLabel(monthA), data: cat.deltasA, backgroundColor: COLOR_A, maxBarThickness: 14 },
        { label: mLabel(monthB), data: cat.deltasB, backgroundColor: COLOR_B, maxBarThickness: 14 },
      ],
    },
    options: { ...INDEX_TOOLTIP, indexAxis: 'y', scales: horizontalAxes() },
  });
}
