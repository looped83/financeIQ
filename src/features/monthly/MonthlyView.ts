import { html, type TemplateResult } from 'lit-html';
import { mountChart } from '../../charts/chartManager';
import { xScale, yScale } from '../../charts/chartTheme';
import { fmtP } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { alpha, COLORS, SERIES } from '../../theme/palette';
import { card, chartBox, deltaMark, getCanvas } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import { getMonthlyDetailRows, getMonthlySavingsRateChartData } from './selectors';

const TARGET_RATE = 20;

export function mountMonthlyView(container: HTMLElement, store: Store<AppState>): Unsubscribe {
  return mountPage(container, store, (s) => [s.analysis], (state) => {
    const a = state.analysis;
    if (!hasData(a)) return { view: noData() };
    return { view: view(a), charts: () => charts(container, a) };
  });
}

function view(a: Analysis): TemplateResult {
  const rows = getMonthlyDetailRows(a);
  return html`
    ${card({ title: 'Sparquote pro Monat', sub: `Gestrichelt: Ziel ${fmtP(TARGET_RATE)}` },
      chartBox('mo-savings', 'Sparquote je Monat'))}

    ${card({ title: 'Monatliche Detailübersicht', sub: 'Hervorgehoben: bester und schwächster Monat nach Netto' }, html`
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th scope="col">Monat</th><th scope="col">Einnahmen</th><th scope="col">Ausgaben</th><th scope="col">Netto</th>
            <th scope="col">Sparquote</th><th scope="col">Dividenden</th><th scope="col">Investiert</th>
            <th scope="col">Karte</th><th scope="col">Buchungen</th>
          </tr></thead>
          <tbody>${rows.map((r) => html`
            <tr class=${r.isBest ? 'is-best' : r.isWorst ? 'is-worst' : ''}>
              <td>${r.month}</td>
              <td>${r.income}${deltaMark(r.incomeDelta, 'up')}</td>
              <td>${r.expense}${deltaMark(r.expenseDelta, 'down')}</td>
              <td class=${r.netPositive ? 'pos' : 'neg'}>${r.net}</td>
              <td class=${r.savingsRateLevel === 'good' ? 'pos' : r.savingsRateLevel === 'bad' ? 'neg' : ''}>${r.savingsRate}</td>
              <td>${r.dividend}</td>
              <td>${r.invested}</td>
              <td>${r.cardCount}×</td>
              <td>${r.txCount}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    `)}
  `;
}

function charts(root: HTMLElement, a: Analysis): void {
  const d = getMonthlySavingsRateChartData(a);
  mountChart(getCanvas(root, 'mo-savings'), {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        {
          label: 'Sparquote', data: d.savingsRate, borderColor: SERIES[0], backgroundColor: SERIES[0], pointRadius: 3,
          fill: { target: 'origin', above: alpha(SERIES[0], 0.12), below: alpha(COLORS.expense, 0.14) },
        },
        {
          label: `Ziel ${TARGET_RATE} %`, data: d.labels.map(() => TARGET_RATE), borderColor: COLORS.textMuted,
          backgroundColor: COLORS.textMuted, borderWidth: 1.5, borderDash: [5, 4], pointHoverRadius: 0,
        },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: xScale(), y: yScale('%') },
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtP(c.parsed.y ?? 0)}` } } },
    },
  });
}
