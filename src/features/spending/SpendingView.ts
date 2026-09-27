import { html, type TemplateResult } from 'lit-html';
import { mountChart } from '../../charts/chartManager';
import { axes, INDEX_TOOLTIP } from '../../charts/chartTheme';
import { fmt, fmtN, fmtP } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { COLORS, seriesColor } from '../../theme/palette';
import { card, chartBox, emptyNote, foldable, getCanvas, kpiGrid, LIST_LIMIT, rowList, type LegendItem } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import { getFixedCosts, getTopMerchants } from '../shared/commonSelectors';
import { showBookings } from '../shared/drilldown';
import { fixedCostsList } from '../shared/fixedCostsList';
import {
  getFixVarTimelineData,
  getMerchantTimelineData,
  getOutlierRows,
  getSpendingKpis,
  getTypeStackData,
  type StackedSeries,
} from './selectors';

const LEVEL_BADGE = { Kritisch: 'badge--bad', Erhöht: 'badge--warn', Auffällig: '' } as const;

export function mountSpendingView(container: HTMLElement, store: Store<AppState>, actions: AppActions): Unsubscribe {
  return mountPage(container, store, (s) => [s.analysis], (state) => {
    const a = state.analysis;
    if (!hasData(a)) return { view: noData() };
    const fixVar = getFixVarTimelineData(a);
    const stacks: Stacks = {
      types: getTypeStackData(a),
      merchants: getMerchantTimelineData(a),
      fixVar: { labels: fixVar.labels, series: [{ label: 'Fixkosten', data: fixVar.fixed }, { label: 'Variabel', data: fixVar.variable }] },
    };
    return { view: view(a, stacks, actions), charts: () => charts(container, stacks) };
  });
}

interface Stacks {
  types: StackedSeries;
  merchants: StackedSeries;
  fixVar: StackedSeries;
}

/** Legend entries in the same order and colors as the stacked datasets. */
const seriesLegend = (d: StackedSeries): LegendItem[] => d.series.map((s, i) => ({ label: s.label, color: seriesColor(i) }));

function view(a: Analysis, stacks: Stacks, actions: AppActions): TemplateResult {
  const k = getSpendingKpis(a);
  const merchants = getTopMerchants(a, 15);
  const fixed = getFixedCosts(a);
  const outliers = getOutlierRows(a, 15);

  return html`
    ${kpiGrid([
      { label: 'Ausgaben', value: fmt(k.total, 0), sub: `Ø ${fmt(k.avgPerMonth, 0)} / Monat`, dot: 'expense' },
      { label: 'Fixkosten / Monat', value: fmt(fixed.totalPerMonth, 0), sub: `${fmtP(k.avgPerMonth ? (fixed.totalPerMonth / k.avgPerMonth) * 100 : 0)} der Ausgaben` },
      { label: 'Ø pro Buchung', value: fmt(k.avgPerBooking, 0), sub: `${fmtN(k.bookings)} Ausgaben` },
      { label: 'Ausreißer', value: String(k.outliers), sub: 'mehr als 2σ vom Schnitt', status: k.outliers ? 'warn' : 'good' },
    ])}

    <div class="grid grid--charts">
      ${card({ title: 'Ausgaben nach Typ', sub: 'Pro Monat, gestapelt' }, chartBox('sp-types', 'Ausgaben nach Buchungstyp je Monat', '', seriesLegend(stacks.types)))}
      ${card({ title: 'Fixkosten vs. variabel', sub: 'Fix: Empfänger mit stabilem Monatsbetrag' },
        chartBox('sp-fixvar', 'Fixkosten und variable Ausgaben je Monat', '', seriesLegend(stacks.fixVar)))}
    </div>

    <div class="grid grid--wide-left">
      ${card({ title: 'Top-Empfänger im Zeitverlauf' }, chartBox('sp-merchants', 'Ausgaben der größten Empfänger je Monat', 'lg', seriesLegend(stacks.merchants)))}
      ${card({ title: 'Kartenzahlungen', sub: 'Größte Empfänger' }, merchants.length
        ? foldable(merchants, LIST_LIMIT, (ms) => rowList(ms.map((m) => ({
            title: m.name, sub: `${m.count} Zahlungen · Ø ${m.avg}`, value: m.total, link: showBookings(actions, { search: m.name, kind: 'out' }),
          }))))
        : emptyNote('Keine Kartenzahlungen im Zeitraum.'))}
    </div>

    <div class="grid">
      ${card({ title: 'Fixkosten', sub: 'Mindestens dreimal gezahlt, mit stabilem Monatsbetrag' }, fixedCostsList(fixed, actions))}
      ${card({ title: 'Ausreißer', sub: `Mehr als 2σ vom Schnitt (Ø ${fmt(a.mean)}, σ ${fmt(a.std)})` }, outliers.length
        ? foldable(outliers, LIST_LIMIT, (os) => rowList(os.map((o) => ({
            title: o.name, sub: `${o.date} · ${o.type} · ${o.zScore}`, value: o.amount, link: showBookings(actions, { search: o.name }),
            after: html`<span class="badge ${LEVEL_BADGE[o.level]}">${o.level}</span>`,
          }))))
        : emptyNote('Keine auffälligen Ausgaben im Zeitraum.'))}
    </div>
  `;
}

function stacked(canvas: HTMLCanvasElement | null, d: StackedSeries): void {
  mountChart(canvas, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: d.series.map((s, i) => ({
        label: s.label, data: s.data, backgroundColor: seriesColor(i), maxBarThickness: 28,
        // 2px surface gap between stacked segments
        borderRadius: 2, borderWidth: { top: 2 }, borderColor: COLORS.surface, borderSkipped: 'bottom' as const,
      })),
    },
    options: { ...INDEX_TOOLTIP, scales: { x: { ...axes().x, stacked: true }, y: { ...axes().y, stacked: true } } },
  });
}

function charts(root: HTMLElement, stacks: Stacks): void {
  stacked(getCanvas(root, 'sp-types'), stacks.types);
  stacked(getCanvas(root, 'sp-merchants'), stacks.merchants);
  stacked(getCanvas(root, 'sp-fixvar'), stacks.fixVar);
}
