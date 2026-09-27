import { html, type TemplateResult } from 'lit-html';
import { mountChart } from '../../charts/chartManager';
import { axes, INDEX_TOOLTIP } from '../../charts/chartTheme';
import { fmt, fmtN, fmtP } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { COLORS, seriesColor } from '../../theme/palette';
import { card, chartBox, getCanvas, kpiGrid, type LegendItem } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import { getRecurringExpenses, getTopMerchants } from '../shared/commonSelectors';
import {
  getFixVarTimelineData,
  getMerchantTimelineData,
  getOutlierRows,
  getSpendingKpis,
  getTypeStackData,
  type StackedSeries,
} from './selectors';

const LEVEL_BADGE = { Kritisch: 'badge--bad', Erhöht: 'badge--warn', Auffällig: '' } as const;

export function mountSpendingView(container: HTMLElement, store: Store<AppState>): Unsubscribe {
  return mountPage(container, store, (s) => [s.analysis], (state) => {
    const a = state.analysis;
    if (!hasData(a)) return { view: noData() };
    const fixVar = getFixVarTimelineData(a);
    const stacks: Stacks = {
      types: getTypeStackData(a),
      merchants: getMerchantTimelineData(a),
      fixVar: { labels: fixVar.labels, series: [{ label: 'Fixkosten', data: fixVar.fixed }, { label: 'Variabel', data: fixVar.variable }] },
    };
    return { view: view(a, fixVar, stacks), charts: () => charts(container, stacks) };
  });
}

interface Stacks {
  types: StackedSeries;
  merchants: StackedSeries;
  fixVar: StackedSeries;
}

/** Legend entries in the same order and colors as the stacked datasets. */
const seriesLegend = (d: StackedSeries): LegendItem[] => d.series.map((s, i) => ({ label: s.label, color: seriesColor(i) }));

function view(a: Analysis, fixVar: ReturnType<typeof getFixVarTimelineData>, stacks: Stacks): TemplateResult {
  const k = getSpendingKpis(a);
  const fixedTotal = fixVar.fixed.reduce((s, v) => s + v, 0);
  const spendTotal = fixedTotal + fixVar.variable.reduce((s, v) => s + v, 0);
  const merchants = getTopMerchants(a, 6);
  const recurring = getRecurringExpenses(a, 12);
  const outliers = getOutlierRows(a, 12);

  return html`
    ${kpiGrid([
      { label: 'Ausgaben', value: fmt(k.total), sub: `Ø ${fmt(k.avgPerMonth)} pro Monat`, dot: 'expense' },
      { label: 'Fixkosten', value: fmt(fixedTotal / a.mc), sub: `pro Monat · ${fmtP(spendTotal ? (fixedTotal / spendTotal) * 100 : 0)} der Ausgaben` },
      { label: 'Ø pro Buchung', value: fmt(k.avgPerBooking), sub: `${fmtN(k.bookings)} Ausgaben-Buchungen` },
      { label: 'Ausreißer', value: String(k.outliers), sub: 'Buchungen > 2σ vom Schnitt', status: k.outliers ? 'warn' : 'good' },
    ])}

    <div class="grid">
      ${card({ title: 'Ausgaben nach Typ', sub: 'Pro Monat, gestapelt' }, chartBox('sp-types', 'Ausgaben nach Buchungstyp je Monat', '', seriesLegend(stacks.types)))}
      ${card({ title: 'Fixkosten vs. variabel', sub: 'Fix: stabile, mindestens dreimal wiederkehrende Empfänger' },
        chartBox('sp-fixvar', 'Fixkosten und variable Ausgaben je Monat', '', seriesLegend(stacks.fixVar)))}
    </div>

    <div class="grid grid--wide-left">
      ${card({ title: 'Top-Empfänger im Zeitverlauf' }, chartBox('sp-merchants', 'Ausgaben der größten Empfänger je Monat', 'lg', seriesLegend(stacks.merchants)))}
      ${card({ title: 'Top-Händler', sub: 'Kartenzahlungen' }, merchants.length
        ? html`<ul class="rows">${merchants.map((m) => html`
            <li>
              <div class="row-main"><div class="row-title">${m.name}</div><div class="row-sub">${m.count} Zahlungen · Ø ${m.avg}</div></div>
              <span class="row-value">${m.total}</span>
            </li>`)}</ul>`
        : html`<p class="muted">Keine Kartenzahlungen im Zeitraum.</p>`)}
    </div>

    <div class="grid">
      ${card({ title: 'Wiederkehrende Ausgaben', sub: 'Gleicher Empfänger und Betrag in mehreren Monaten' }, recurring.rows.length
        ? html`
          <ul class="rows">${recurring.rows.map((r) => html`
            <li>
              <div class="row-main"><div class="row-title">${r.name}</div><div class="row-sub">in ${r.monthCount} Monaten · ≈ ${r.perYear} / Jahr</div></div>
              <span class="row-value">${r.perMonth}<small>/ Monat</small></span>
            </li>`)}</ul>
          <div class="card-foot"><span>Gesamt</span><span class="num"><strong>${recurring.totalPerMonth}</strong> / Monat · ≈ ${recurring.totalPerYear} / Jahr</span></div>`
        : html`<p class="muted">Keine wiederkehrenden Zahlungen erkannt.</p>`)}

      ${card({ title: 'Ausreißer', sub: `Mehr als 2σ vom Schnitt (Ø ${fmt(a.mean)}, σ ${fmt(a.std)})` }, outliers.length
        ? html`<ul class="rows">${outliers.map((o) => html`
            <li>
              <div class="row-main"><div class="row-title">${o.name}</div><div class="row-sub">${o.date} · ${o.type} · ${o.zScore}</div></div>
              <span class="row-value">${o.amount}<span class="badge ${LEVEL_BADGE[o.level]}">${o.level}</span></span>
            </li>`)}</ul>`
        : html`<p class="muted">Keine auffälligen Ausgaben im Zeitraum.</p>`)}
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
