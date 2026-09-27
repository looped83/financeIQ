import { html, nothing, type TemplateResult } from 'lit-html';
import { mountChart, mountDonut } from '../../charts/chartManager';
import { axes, INDEX_TOOLTIP } from '../../charts/chartTheme';
import { fmtSigned } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { COLORS, seriesColor } from '../../theme/palette';
import { card, chartBox, donut, emptyNote, getCanvas, insightList, kpiGrid, rowList, segmented, statusIcon } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import { getFixedCosts, getSpendBreakdown } from '../shared/commonSelectors';
import { isFolded, showBookings } from '../shared/drilldown';
import { fixedCostsList } from '../shared/fixedCostsList';
import { getCumulativeIncExpChartData, getMonthlyIncomeExpenseData } from '../timeline/selectors';
import { computeHints } from './hints';
import { computeFinancialRatios, computeOverviewRates, getOverviewKpis } from './selectors';

type TrendMode = 'monthly' | 'cumulative';
type SpendBy = 'payee' | 'type';

/** Page-local view state — not worth a store slice, lost on reload by design. */
const ui = { trend: 'monthly' as TrendMode, spendBy: 'payee' as SpendBy };
const HINTS_SHOWN = 4;

export function mountOverviewView(container: HTMLElement, store: Store<AppState>, actions: AppActions): Unsubscribe {
  return mountPage(container, store, (s) => [s.analysis], (state, redraw) => {
    const a = state.analysis;
    if (!hasData(a)) return { view: noData() };
    const set = <K extends keyof typeof ui>(k: K, v: (typeof ui)[K]) => {
      ui[k] = v;
      redraw();
    };
    const spend = getSpendBreakdown(a, ui.spendBy);
    return { view: view(a, spend, set, actions), charts: () => charts(container, a, spend) };
  });
}

function view(
  a: Analysis,
  spend: ReturnType<typeof getSpendBreakdown>,
  set: <K extends keyof typeof ui>(k: K, v: (typeof ui)[K]) => void,
  actions: AppActions,
): TemplateResult {
  const rates = computeOverviewRates(a);
  const spendLink = (name: string, i: number) => isFolded(spend.entries, i)
    ? undefined
    : showBookings(actions, ui.spendBy === 'payee' ? { search: name, kind: 'out' } : { category: name, kind: 'out' });

  return html`
    ${kpiGrid(getOverviewKpis(a, rates))}

    <div class="grid">
      ${card({
        title: 'Einnahmen vs. Ausgaben',
        sub: `Ø Netto ${fmtSigned(a.avgNet)} pro Monat`,
        actions: segmented('Darstellung', [
          { value: 'monthly', label: 'Monatlich' },
          { value: 'cumulative', label: 'Kumuliert' },
        ], ui.trend, (v) => set('trend', v)),
      }, chartBox('ov-trend', 'Einnahmen und Ausgaben je Monat', '', [
        { label: 'Einnahmen', color: COLORS.income, mark: ui.trend === 'monthly' ? 'box' : 'line' },
        { label: 'Ausgaben', color: COLORS.expense, mark: ui.trend === 'monthly' ? 'box' : 'line' },
      ]))}

      ${card({
        title: 'Wohin das Geld geht',
        sub: ui.spendBy === 'payee' ? 'Größte Empfänger' : 'Nach Buchungstyp',
        actions: segmented('Gruppierung', [
          { value: 'payee', label: 'Empfänger' },
          { value: 'type', label: 'Typ' },
        ], ui.spendBy, (v) => set('spendBy', v)),
      }, donut('ov-donut', 'Ringdiagramm der Ausgaben', spend.entries, spend.total, seriesColor, spendLink))}
    </div>

    <div class="grid grid--3">
      ${card({ title: 'Finanz-Kennzahlen' }, rowList(computeFinancialRatios(a, rates).map((r) => ({
        title: r.label, value: r.value, before: r.good === null ? nothing : statusIcon(r.good ? 'good' : 'warn'),
      }))))}

      ${card({ title: 'Fixkosten', sub: 'Wiederkehrend mit stabilem Betrag' }, fixedCostsList(getFixedCosts(a), actions))}

      ${hintsCard(a)}
    </div>
  `;
}

function hintsCard(a: Analysis): TemplateResult {
  const hints = computeHints(a);
  return card({ title: 'Hinweise', sub: 'Wichtigstes zuerst' },
    hints.length ? insightList(hints, HINTS_SHOWN) : emptyNote('Keine besonderen Auffälligkeiten.'));
}

function charts(root: HTMLElement, a: Analysis, spend: ReturnType<typeof getSpendBreakdown>): void {
  if (ui.trend === 'monthly') {
    const d = getMonthlyIncomeExpenseData(a);
    mountChart(getCanvas(root, 'ov-trend'), {
      type: 'bar',
      data: {
        labels: d.labels,
        datasets: [
          { label: 'Einnahmen', data: d.income, backgroundColor: COLORS.income, maxBarThickness: 16 },
          { label: 'Ausgaben', data: d.expense, backgroundColor: COLORS.expense, maxBarThickness: 16 },
        ],
      },
      options: { ...INDEX_TOOLTIP, scales: axes(), datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.92 } } },
    });
  } else {
    const d = getCumulativeIncExpChartData(a);
    mountChart(getCanvas(root, 'ov-trend'), {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [
          { label: 'Einnahmen (kumuliert)', data: d.cumInc, borderColor: COLORS.income, backgroundColor: COLORS.income },
          { label: 'Ausgaben (kumuliert)', data: d.cumExp, borderColor: COLORS.expense, backgroundColor: COLORS.expense },
        ],
      },
      options: { ...INDEX_TOOLTIP, scales: axes() },
    });
  }

  mountDonut(getCanvas(root, 'ov-donut'), spend.entries, spend.total);
}
