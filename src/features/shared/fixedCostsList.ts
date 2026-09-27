import { html, type TemplateResult } from 'lit-html';
import { fmt } from '../../domain/format';
import { emptyNote, rowList } from '../../ui/components';
import type { FixedCosts } from './commonSelectors';

/** Fixed costs as a list with a per-month/per-year total — the same on Übersicht and Ausgaben. */
export function fixedCostsList(fixed: FixedCosts, limit = fixed.rows.length): TemplateResult {
  if (!fixed.rows.length) return emptyNote('Keine Fixkosten erkannt.');
  return html`
    ${rowList(fixed.rows.slice(0, limit).map((r) => ({
      title: r.name, sub: `in ${r.monthCount} Monaten`, value: fmt(r.perMonth), unit: '/ Monat',
    })))}
    <div class="card-foot"><span>Gesamt</span><span class="num"><strong>${fmt(fixed.totalPerMonth)}</strong> / Monat · ≈ ${fmt(fixed.totalPerMonth * 12)} / Jahr</span></div>
  `;
}
