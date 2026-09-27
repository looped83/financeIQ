import { html, type TemplateResult } from 'lit-html';
import { mountChart } from '../../charts/chartManager';
import { axes, INDEX_TOOLTIP } from '../../charts/chartTheme';
import { fmt } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { COLORS } from '../../theme/palette';
import { card, chartBox, deltaMark, getCanvas, kpiGrid } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import {
  computeQuarterlyBreakdown,
  getQuarterlyChartData,
  getYearlyChartData,
  getYearlyKpiCards,
  getYearlyTableRows,
  isMultiYear,
  type QuarterKey,
} from './selectors';

/** Years are compared across the whole history, independent of the global period. */
export function mountYearlyView(container: HTMLElement, store: Store<AppState>): Unsubscribe {
  return mountPage(container, store, (s) => [s.fullAnalysis], (state) => {
    const a = state.fullAnalysis;
    if (!hasData(a)) return { view: noData() };
    const multi = isMultiYear(a);
    return { view: multi ? multiYear(a) : singleYear(a), charts: () => chart(container, a, multi) };
  });
}

function singleYear(a: Analysis): TemplateResult {
  const b = computeQuarterlyBreakdown(a);
  return html`
    ${kpiGrid((['Q1', 'Q2', 'Q3', 'Q4'] as QuarterKey[]).map((q) => {
      const qa = b.quarters[q];
      return { label: `${q} ${b.year}`, value: fmt(qa.net), sub: `Ein ${fmt(qa.income)} · Aus ${fmt(Math.abs(qa.expense))}` };
    }))}
    ${card({ title: `Quartale ${b.year}`, sub: 'Die Daten umfassen nur ein Jahr – für den Jahresvergleich eine mehrjährige CSV laden.' },
      chartBox('yr-chart', 'Kennzahlen je Quartal', 'lg'))}
  `;
}

function multiYear(a: Analysis): TemplateResult {
  const rows = getYearlyTableRows(a);
  return html`
    ${kpiGrid(getYearlyKpiCards(a).map((c) => ({
      label: c.year,
      value: c.net,
      sub: c.yoyIncomeChange ? `Einnahmen ${c.yoyIncomeChange} ggü. Vorjahr` : `Einnahmen ${c.income}`,
      status: c.yoyIncomeChange ? (c.yoyIncomeUp ? 'good' : 'warn') : undefined,
    })))}

    ${card({ title: 'Jahresvergleich' }, chartBox('yr-chart', 'Kennzahlen je Jahr', 'lg'))}

    ${card({ title: 'Jahresübersicht', sub: 'Hervorgehoben: bestes und schwächstes Jahr nach Netto' }, html`
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th scope="col">Jahr</th><th scope="col">Einnahmen</th><th scope="col">Ausgaben</th><th scope="col">Netto</th>
            <th scope="col">Investiert</th><th scope="col">Dividenden</th><th scope="col">Gebühren</th><th scope="col">Sparquote</th>
          </tr></thead>
          <tbody>${rows.map((r) => html`
            <tr class=${r.isBest ? 'is-best' : r.isWorst ? 'is-worst' : ''}>
              <td>${r.year}</td>
              <td>${r.income}${deltaMark(r.incomeDelta, 'up')}</td>
              <td>${r.expense}${deltaMark(r.expenseDelta, 'down')}</td>
              <td class=${r.netPositive ? 'pos' : 'neg'}>${r.net}</td>
              <td>${r.invested}</td><td>${r.dividend}</td><td>${r.fees}</td>
              <td class=${r.savingsRateCls === 'pos' ? 'pos' : r.savingsRateCls === 'neg' ? 'neg' : ''}>${r.savingsRate}</td>
            </tr>`)}</tbody>
        </table>
      </div>
    `)}
  `;
}

function chart(root: HTMLElement, a: Analysis, multi: boolean): void {
  const d = multi ? getYearlyChartData(a) : getQuarterlyChartData(computeQuarterlyBreakdown(a));
  const bar = { maxBarThickness: 22 };
  mountChart(getCanvas(root, 'yr-chart'), {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Einnahmen', data: d.income, backgroundColor: COLORS.income, ...bar },
        { label: 'Ausgaben', data: d.expense, backgroundColor: COLORS.expense, ...bar },
        { label: 'Investiert', data: d.invested, backgroundColor: COLORS.invest, ...bar },
        { label: 'Dividenden', data: d.dividend, backgroundColor: COLORS.dividend, ...bar },
      ],
    },
    options: { ...INDEX_TOOLTIP, scales: axes(), datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.92 } } },
  });
}
