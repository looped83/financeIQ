import { html, nothing, type TemplateResult } from 'lit-html';
import { mountChart, mountDonut } from '../../charts/chartManager';
import { axes, INDEX_TOOLTIP } from '../../charts/chartTheme';
import { fmtSigned } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { COLORS, seriesColor } from '../../theme/palette';
import { card, chartBox, donut, emptyNote, getCanvas, insightList, kpiGrid, rowList, segmented, statusIcon } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import { computeRecommendations } from '../recommendations/selectors';
import { getFixedCosts, getSpendBreakdown } from '../shared/commonSelectors';
import { fixedCostsList } from '../shared/fixedCostsList';
import { getCumulativeIncExpChartData, getMonthlyIncomeExpenseData } from '../timeline/selectors';
import { computeAlerts, computeFinancialRatios, computeOverviewRates, computeTrends, getOverviewKpis } from './selectors';

type TrendMode = 'monthly' | 'cumulative';
type SpendBy = 'payee' | 'type';
type HintTab = 'hints' | 'recs';

/** Page-local view state — not worth a store slice, lost on reload by design. */
const ui = { trend: 'monthly' as TrendMode, spendBy: 'payee' as SpendBy, hints: 'hints' as HintTab };
const HINTS_SHOWN = 4;

export function mountOverviewView(container: HTMLElement, store: Store<AppState>): Unsubscribe {
  return mountPage(container, store, (s) => [s.analysis], (state, redraw) => {
    const a = state.analysis;
    if (!hasData(a)) return { view: noData() };
    const set = <K extends keyof typeof ui>(k: K, v: (typeof ui)[K]) => {
      ui[k] = v;
      redraw();
    };
    const spend = getSpendBreakdown(a, ui.spendBy);
    return { view: view(a, spend, set), charts: () => charts(container, a, spend) };
  });
}

function view(
  a: Analysis,
  spend: ReturnType<typeof getSpendBreakdown>,
  set: <K extends keyof typeof ui>(k: K, v: (typeof ui)[K]) => void,
): TemplateResult {
  const rates = computeOverviewRates(a);

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
      }, donut('ov-donut', 'Ringdiagramm der Ausgaben', spend.entries, spend.total, seriesColor))}
    </div>

    <div class="grid grid--3">
      ${card({ title: 'Finanz-Kennzahlen' }, rowList(computeFinancialRatios(a, rates).map((r) => ({
        title: r.label, value: r.value, before: r.good === null ? nothing : statusIcon(r.good ? 'good' : 'warn'),
      }))))}

      ${card({ title: 'Fixkosten', sub: 'Wiederkehrend mit stabilem Betrag' }, fixedCostsList(getFixedCosts(a)))}

      ${hintsCard(a, rates, set)}
    </div>
  `;
}

function hintsCard(
  a: Analysis,
  rates: ReturnType<typeof computeOverviewRates>,
  set: <K extends keyof typeof ui>(k: K, v: (typeof ui)[K]) => void,
): TemplateResult {
  const items = ui.hints === 'hints'
    ? [
        ...computeAlerts(a, rates),
        ...(a.mKeys.length >= 2 ? computeTrends(a) : []),
      ]
    : computeRecommendations(a).map((r) => ({ color: r.level, title: r.title, desc: r.desc }));

  return card({
    title: 'Hinweise',
    actions: segmented('Art', [
      { value: 'hints', label: 'Auffälligkeiten' },
      { value: 'recs', label: 'Empfehlungen' },
    ], ui.hints, (v) => set('hints', v)),
  }, items.length ? insightList(items, HINTS_SHOWN) : emptyNote('Keine besonderen Auffälligkeiten.'));
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
