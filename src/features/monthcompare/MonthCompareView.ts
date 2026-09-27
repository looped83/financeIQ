import { html, nothing, type TemplateResult } from 'lit-html';
import { mountChart } from '../../charts/chartManager';
import { axes, horizontalAxes, INDEX_TOOLTIP, xScale, yScale } from '../../charts/chartTheme';
import { fmt, fmtSigned, mLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState, MonthCompareMetric } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { alpha, COLORS, SERIES } from '../../theme/palette';
import { card, chartBox, deltaMark, emptyNote, emptyState, foldable, getCanvas, LIST_LIMIT, rowList, segmented } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import {
  getIntraMonthCashflowData,
  getMerchantComparison,
  getMonthCategoryComparison,
  getMonthDeltaTableRows,
  getMonthMetricTimelineData,
  getRecurringExpensesDelta,
  getTopSingleExpenses,
  getUniqueMerchants,
  type IntraMonthCashflowData,
  type UniqueExpense,
} from './selectors';

const METRICS: { value: MonthCompareMetric; label: string }[] = [
  { value: 'income', label: 'Einnahmen' },
  { value: 'expense', label: 'Ausgaben' },
  { value: 'net', label: 'Netto' },
  { value: 'invested', label: 'Investiert' },
  { value: 'dividend', label: 'Dividenden' },
];
/**
 * Month A and month B keep these two colors on every chart of the page: the
 * earlier month neutral, the later one blue — neither is a data color with its
 * own meaning elsewhere (gold = dividends).
 */
const [COLOR_A, COLOR_B] = [COLORS.textSecondary, SERIES[0]];

/** Page-local view state: which month the detail card shows. */
const ui = { detail: 'B' as 'A' | 'B' };

/** Compares two months of the whole history, independent of the global period. */
export function mountMonthCompareView(container: HTMLElement, store: Store<AppState>, actions: AppActions): Unsubscribe {
  return mountPage(container, store, (s) => [s.fullAnalysis, s.monthCompare], (state, redraw) => {
    const a = state.fullAnalysis;
    if (!hasData(a)) return { view: noData() };
    if (a.mKeys.length < 2) return { view: emptyState('Zu wenig Daten', 'Für einen Vergleich braucht es mindestens zwei Monate.') };

    const keys = a.mKeys;
    const monthA = state.monthCompare.monthA && a.months[state.monthCompare.monthA] ? state.monthCompare.monthA : keys[keys.length - 2]!;
    const monthB = state.monthCompare.monthB && a.months[state.monthCompare.monthB] ? state.monthCompare.monthB : keys[keys.length - 1]!;
    const metric = state.monthCompare.metric;
    const intra = getIntraMonthCashflowData(a, monthA, monthB);
    const pickDetail = (d: 'A' | 'B') => {
      ui.detail = d;
      redraw();
    };
    return {
      view: view(a, monthA, monthB, metric, intra, actions, pickDetail),
      charts: () => charts(container, a, monthA, monthB, metric, intra),
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

/** One month in detail: its largest single expenses and the payees that only appear in it. */
function monthDetail(a: Analysis, month: string, only: UniqueExpense[]): TemplateResult {
  const top = getTopSingleExpenses(a, month);
  return html`
    <h3 class="card-section">Größte Einzelausgaben</h3>
    ${top.length ? rowList(top.map((t) => ({ title: t.name, sub: t.date, value: fmt(t.amount) }))) : emptyNote('Keine Ausgaben.')}
    <h3 class="card-section">Nur in diesem Monat</h3>
    ${only.length
      ? foldable(only, LIST_LIMIT, (xs) => rowList(xs.map((u) => ({ title: u.name, sub: `${u.count}×`, value: fmt(u.total) }))))
      : emptyNote('Keine Empfänger nur in diesem Monat.')}
  `;
}

function view(
  a: Analysis, monthA: string, monthB: string, metric: MonthCompareMetric, intra: IntraMonthCashflowData,
  actions: AppActions, pickDetail: (d: 'A' | 'B') => void,
): TemplateResult {
  const [labelA, labelB] = [mLabel(monthA), mLabel(monthB)];
  const merchants = getMerchantComparison(a, monthA, monthB, 15);
  const unique = getUniqueMerchants(a, monthA, monthB);
  const recurring = getRecurringExpensesDelta(a, monthA, monthB);
  const ab = [{ label: labelA, color: COLOR_A }, { label: labelB, color: COLOR_B }];
  const abLines = ab.map((i) => ({ ...i, mark: 'line' as const }));

  return html`
    ${card({
      title: `${labelA} vs. ${labelB}`,
      actions: html`<div class="month-pick">
        ${monthSelect(a, 'Erster Monat', monthA, (m) => actions.setMonthCompareA(m))}
        <span class="muted">vs.</span>
        ${monthSelect(a, 'Zweiter Monat', monthB, (m) => actions.setMonthCompareB(m))}
      </div>`,
    }, html`
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th scope="col">Kennzahl</th><th scope="col">${labelA}</th><th scope="col">${labelB}</th><th scope="col">Differenz</th><th scope="col">in %</th></tr></thead>
          <tbody>${getMonthDeltaTableRows(a, monthA, monthB).map((r) => html`
            <tr>
              <td>${r.label}</td><td>${r.vA}</td><td>${r.vB}</td>
              <td class=${r.good === null ? '' : r.good ? 'pos' : 'neg'}>${r.delta}</td>
              <td>${r.deltaPct}</td>
            </tr>`)}</tbody>
        </table>
      </div>
    `)}

    <div class="grid grid--charts">
      ${card({
        title: 'Cashflow im Monatsverlauf',
        sub: html`Laufende Summe je Tag · Ende ${labelA}: <span class="num">${fmt(intra.endA)}</span> · ${labelB}: <span class="num">${fmt(intra.endB)}</span>`,
      }, chartBox('mc-intra', 'Kumulierter Cashflow je Tag beider Monate', '', abLines))}
      ${card({ title: 'Ausgaben nach Typ', sub: 'Beide Monate im Vergleich' }, chartBox('mc-cat', 'Ausgaben je Buchungstyp in beiden Monaten', '', ab))}
    </div>

    ${card({
      title: `Verlauf: ${METRICS.find((m) => m.value === metric)!.label}`,
      sub: 'Alle Monate, die beiden gewählten hervorgehoben',
      actions: segmented('Kennzahl', METRICS, metric, (m) => actions.setMonthCompareMetric(m)),
    }, chartBox('mc-timeline', 'Kennzahl über alle Monate', 'sm', ab))}

    <div class="grid">
      ${card({ title: 'Empfänger im Vergleich', sub: 'Größte Ausgaben, Differenz = zweiter minus erster Monat' }, merchants.length
        ? foldable(merchants, LIST_LIMIT, (ms) => rowList(ms.map((m) => ({
            title: m.name,
            sub: html`<span class="num">${labelA}: ${m.countA}× ${fmt(m.totalA)} · ${labelB}: ${m.countB}× ${fmt(m.totalB)}</span>`,
            value: fmtSigned(m.delta),
            valueClass: m.delta <= 0 ? 'pos' : 'neg',
            after: deltaMark(m.delta > 0 ? 'up' : m.delta < 0 ? 'down' : null, 'down'),
          }))))
        : emptyNote('Keine Ausgaben in diesen Monaten.'))}
      ${card({
        title: 'Einzelheiten',
        actions: segmented('Monat', [{ value: 'A', label: labelA }, { value: 'B', label: labelB }], ui.detail, pickDetail),
      }, ui.detail === 'A' ? monthDetail(a, monthA, unique.onlyA) : monthDetail(a, monthB, unique.onlyB))}
    </div>

    ${recurring.length
      ? card({ title: 'Fixkosten', sub: 'In beiden Monaten gezahlt' }, html`
          <div class="table-wrap"><table class="table">
            <thead><tr><th scope="col">Empfänger</th><th scope="col">${labelA}</th><th scope="col">${labelB}</th><th scope="col">Differenz</th></tr></thead>
            <tbody>${recurring.map((r) => html`
              <tr><td>${r.name}</td><td>${fmt(r.amountA)}</td><td>${fmt(r.amountB)}</td>
                <td class=${r.delta === 0 ? '' : r.deltaPositive ? 'pos' : 'neg'}>${fmtSigned(r.delta)}</td></tr>`)}</tbody>
          </table></div>`)
      : nothing}
  `;
}

function charts(
  root: HTMLElement, a: Analysis, monthA: string, monthB: string, metric: MonthCompareMetric, intra: IntraMonthCashflowData,
): void {
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
    options: { ...INDEX_TOOLTIP, scales: axes() },
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
