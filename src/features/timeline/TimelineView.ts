import { html, type TemplateResult } from 'lit-html';
import { de } from 'date-fns/locale/de';
import { mountChart } from '../../charts/chartManager';
import { axes, INDEX_TOOLTIP, xScale, yScale } from '../../charts/chartTheme';
import { fmt } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState, TimelineView as Mode } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { alpha, COLORS, SERIES } from '../../theme/palette';
import { barList, card, chartBox, getCanvas, segmented } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import { computeMainChartData, getIncomeSources, getMonthlyNetChartData } from './selectors';

const MODES: { value: Mode; label: string }[] = [
  { value: 'daily', label: 'Täglich' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'quarterly', label: 'Quartal' },
];
const MA_NOTE: Record<Mode, string> = { daily: '30-Tage-Schnitt', monthly: '3-Monats-Schnitt', quarterly: '2-Quartals-Schnitt' };

export function mountTimelineView(container: HTMLElement, store: Store<AppState>, actions: AppActions): Unsubscribe {
  return mountPage(container, store, (s) => [s.analysis, s.timelineView], (state) => {
    const a = state.analysis;
    if (!hasData(a)) return { view: noData() };
    return { view: view(a, state.timelineView, actions), charts: () => charts(container, a, state.timelineView) };
  });
}

function view(a: Analysis, mode: Mode, actions: AppActions): TemplateResult {
  const sources = getIncomeSources(a);
  return html`
    ${card({
      title: 'Kumulierter Cashflow',
      sub: `Nur Barumsätze · gestrichelt: ${MA_NOTE[mode]}`,
      actions: segmented('Auflösung', MODES, mode, (m) => actions.setTimelineView(m)),
    }, chartBox('tl-main', 'Kumulierter Cashflow im Zeitverlauf', 'lg'))}

    <div class="grid grid--wide-left">
      ${card({ title: 'Netto-Cashflow pro Monat', sub: `Ø ${a.avgNet >= 0 ? '+' : ''}${fmt(a.avgNet)} pro Monat` },
        chartBox('tl-net', 'Netto-Cashflow je Monat'))}
      ${card({ title: 'Einnahmenquellen', sub: `${fmt(a.totalInc)} gesamt` },
        sources.length
          ? barList(sources.map((s) => ({ label: s.label, sub: `${s.count}×`, value: s.total, share: s.pctLabel, pct: s.pct, barColor: COLORS.income })))
          : html`<p class="muted">Keine Einnahmen im Zeitraum.</p>`)}
    </div>
  `;
}

function charts(root: HTMLElement, a: Analysis, mode: Mode): void {
  const main = computeMainChartData(a, mode);
  mountChart(getCanvas(root, 'tl-main'), {
    type: 'line',
    data: {
      labels: main.labels,
      datasets: [
        {
          label: 'Kumuliert', data: main.cumData as number[], borderColor: SERIES[0], backgroundColor: SERIES[0],
          fill: { target: 'origin', above: alpha(SERIES[0], 0.12), below: alpha(COLORS.expense, 0.14) },
        },
        {
          label: 'Gleitender Schnitt', data: main.maData as number[], borderColor: COLORS.textMuted,
          backgroundColor: COLORS.textMuted, borderWidth: 1.5, borderDash: [5, 4],
        },
      ],
    },
    options: {
      ...INDEX_TOOLTIP,
      scales: {
        x: main.isDate
          ? { ...xScale(), type: 'time', adapters: { date: { locale: de } }, time: { unit: 'month', tooltipFormat: 'dd.MM.yyyy', displayFormats: { month: 'MMM yy' } } }
          : xScale(),
        y: yScale(),
      },
    },
  });

  const net = getMonthlyNetChartData(a);
  mountChart(getCanvas(root, 'tl-net'), {
    type: 'bar',
    data: {
      labels: net.labels,
      datasets: [{
        label: 'Netto', data: net.values, maxBarThickness: 22,
        backgroundColor: net.values.map((v) => (v >= 0 ? COLORS.income : COLORS.expense)),
      }],
    },
    options: { ...INDEX_TOOLTIP, scales: axes(), plugins: { ...INDEX_TOOLTIP.plugins, legend: { display: false } } },
  });
}
