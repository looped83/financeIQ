import { html, type TemplateResult } from 'lit-html';
import { mountChart } from '../../charts/chartManager';
import { axes, INDEX_TOOLTIP } from '../../charts/chartTheme';
import { fmt, fmtP } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { COLORS, SERIES, seriesColor } from '../../theme/palette';
import { barList, card, chartBox, getCanvas, kpiGrid } from '../../ui/components';
import { hasData, mountPage, noData } from '../../ui/page';
import {
  getAssetClassBreakdown,
  getDividendChartData,
  getDividendsBySecurity,
  getInvestmentKpis,
  getTradeVolumeData,
} from './selectors';

const PASSIVE_TARGET = 5;
const SECURITIES_SHOWN = 6;

export function mountInvestmentsView(container: HTMLElement, store: Store<AppState>): Unsubscribe {
  return mountPage(container, store, (s) => [s.analysis], (state) => {
    const a = state.analysis;
    if (!hasData(a)) return { view: noData() };
    const classes = getAssetClassBreakdown(a);
    return { view: view(a, classes), charts: () => charts(container, a, classes) };
  });
}

function view(a: Analysis, classes: [string, number][]): TemplateResult {
  const k = getInvestmentKpis(a);
  const securities = getDividendsBySecurity(a);
  const classTotal = classes.reduce((s, [, v]) => s + v, 0);

  return html`
    ${kpiGrid([
      { label: 'Investiert', value: fmt(k.invested), sub: `Käufe · verkauft: ${fmt(k.sold)}`, dot: 'invest' },
      { label: 'Dividenden (netto)', value: fmt(k.dividends), sub: `Ø ${fmt(k.avgDividend)} pro Monat`, dot: 'dividend' },
      {
        label: 'Passives Einkommen', value: fmtP(k.passiveRate), sub: `der Einnahmen · Ziel ${fmtP(PASSIVE_TARGET)}`,
        status: k.passiveRate >= PASSIVE_TARGET ? 'good' : 'warn',
      },
      { label: 'Gebühren', value: fmt(k.fees), sub: k.invested ? `${fmtP((k.fees / k.invested) * 100)} der Käufe` : 'keine Käufe' },
    ])}

    <div class="grid grid--charts">
      ${card({ title: 'Dividenden pro Monat', sub: `${k.positions} ${k.positions === 1 ? 'Position' : 'Positionen'} · netto nach Steuern` },
        chartBox('in-div', 'Dividenden je Monat', '', [{ label: 'Dividenden (netto)', color: COLORS.dividend }]))}
      ${card({ title: 'Kauf- und Verkaufsvolumen', sub: 'Pro Monat' }, chartBox('in-trades', 'Käufe und Verkäufe je Monat', '', [
        { label: 'Käufe', color: COLORS.invest },
        { label: 'Verkäufe', color: SERIES[2] },
      ]))}
    </div>

    <div class="grid grid--wide-right">
      ${card({ title: 'Käufe nach Anlageklasse' }, classes.length
        ? html`
          <div class="donut-wrap">
            <div class="donut">
              <canvas data-chart="in-classes" role="img" aria-label="Ringdiagramm der Käufe nach Anlageklasse"></canvas>
              <div class="donut-center"><span>Gesamt</span><strong>${fmt(classTotal, 0)}</strong></div>
            </div>
            ${barList(classes.map(([label, v], i) => ({
              label, value: fmt(v), share: fmtP(classTotal ? (v / classTotal) * 100 : 0), color: seriesColor(i),
            })))}
          </div>`
        : html`<p class="muted">Keine Käufe im Zeitraum.</p>`)}
      ${card({ title: 'Dividenden nach Wertpapier', sub: securities.length ? `${securities.length} Wertpapiere · sortiert nach Betrag` : '' },
        securities.length ? securityList(securities) : html`<p class="muted">Keine Dividenden im Zeitraum.</p>`)}
    </div>
  `;
}

/** Top positions always visible; the long tail folds away so the card keeps the height of its neighbour. */
function securityList(securities: ReturnType<typeof getDividendsBySecurity>): TemplateResult {
  const rows = securities.map((s) => ({
    label: s.name, sub: `${s.count}×`, value: s.amount, share: s.pctLabel, pct: s.pct, barColor: COLORS.dividend,
  }));
  if (rows.length <= SECURITIES_SHOWN + 1) return barList(rows);
  return html`
    ${barList(rows.slice(0, SECURITIES_SHOWN))}
    <details class="disclosure">
      <summary class="more">Alle ${rows.length} Wertpapiere anzeigen</summary>
      ${barList(rows.slice(SECURITIES_SHOWN))}
    </details>
  `;
}

function charts(root: HTMLElement, a: Analysis, classes: [string, number][]): void {
  const div = getDividendChartData(a);
  mountChart(getCanvas(root, 'in-div'), {
    type: 'bar',
    data: { labels: div.labels, datasets: [{ label: 'Dividenden', data: div.values, backgroundColor: COLORS.dividend, maxBarThickness: 22 }] },
    options: { ...INDEX_TOOLTIP, scales: axes() },
  });

  const trades = getTradeVolumeData(a);
  mountChart(getCanvas(root, 'in-trades'), {
    type: 'bar',
    data: {
      labels: trades.labels,
      datasets: [
        { label: 'Käufe', data: trades.buys, backgroundColor: COLORS.invest, maxBarThickness: 16 },
        { label: 'Verkäufe', data: trades.sells, backgroundColor: SERIES[2], maxBarThickness: 16 },
      ],
    },
    options: { ...INDEX_TOOLTIP, scales: axes(), datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.92 } } },
  });

  const total = classes.reduce((s, [, v]) => s + v, 0);
  mountChart(getCanvas(root, 'in-classes'), {
    type: 'doughnut',
    data: {
      labels: classes.map(([l]) => l),
      datasets: [{ data: classes.map(([, v]) => v), backgroundColor: classes.map((_, i) => seriesColor(i)) }],
    },
    options: {
      cutout: '72%',
      plugins: {
        tooltip: { callbacks: { label: (c) => ` ${fmt(Number(c.parsed))} · ${fmtP(total ? (Number(c.parsed) / total) * 100 : 0)}` } },
      },
    },
  });
}
