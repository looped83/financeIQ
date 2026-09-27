import { html, type TemplateResult } from 'lit-html';
import { fmt } from '../../domain/format';
import { emptyNote, foldable, LIST_LIMIT, rowList } from '../../ui/components';
import type { FixedCosts } from './commonSelectors';

/** Fixed costs, largest first, with the per-month and per-year total — the same on Übersicht and Ausgaben. */
export function fixedCostsList(fixed: FixedCosts): TemplateResult {
  if (!fixed.rows.length) return emptyNote('Keine Fixkosten erkannt.');
  return html`
    ${foldable(fixed.rows, LIST_LIMIT, (rows) => rowList(rows.map((r) => ({
      title: r.name, sub: `in ${r.monthCount} Monaten`, value: fmt(r.perMonth), unit: '/ Monat',
    }))))}
    <div class="card-foot"><span>Gesamt</span><span class="num"><strong>${fmt(fixed.totalPerMonth)}</strong> / Monat · ≈ ${fmt(fixed.totalPerMonth * 12, 0)} / Jahr</span></div>
  `;
}
