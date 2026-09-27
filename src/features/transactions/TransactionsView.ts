import { html, nothing, type TemplateResult } from 'lit-html';
import { fmt, fmtN, typeLabel } from '../../domain/format';
import type { EnrichedRow } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState, TransactionKind, TransactionSort } from '../../state/appState';
import { TRANSACTIONS_PER_PAGE } from '../../state/appState';
import type { Store, Unsubscribe } from '../../state/store';
import { icon } from '../../ui/icons';
import { hasData, mountPage, noData } from '../../ui/page';
import {
  computePaginationItems,
  filterTransactions,
  getAvailableCategories,
  groupByDay,
  paginate,
  sortTransactions,
  sumInOut,
} from './selectors';

const KINDS: { value: TransactionKind; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'in', label: 'Einnahmen' },
  { value: 'out', label: 'Ausgaben' },
  { value: 'invest', label: 'Investments' },
  { value: 'div', label: 'Dividenden' },
];
const SORTS: { value: TransactionSort; label: string }[] = [
  { value: 'date-desc', label: 'Neueste zuerst' },
  { value: 'date-asc', label: 'Älteste zuerst' },
  { value: 'amount-desc', label: 'Größte Beträge' },
  { value: 'amount-asc', label: 'Kleinste Beträge' },
];

/** Filtering waits until typing pauses, so a fast typist doesn't trigger a re-filter per key. */
const SEARCH_DELAY = 150;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;

function badgeClass(r: EnrichedRow): string {
  if (r._isInternal) return '';
  if (r._isDiv) return 'badge--div';
  if (r._isBuy || r._isSell) return 'badge--invest';
  return r._amt > 0 ? 'badge--in' : '';
}

export function mountTransactionsView(container: HTMLElement, store: Store<AppState>, actions: AppActions): Unsubscribe {
  return mountPage(container, store, (s) => [s.analysis, s.transactions], (state) => {
    const a = state.analysis;
    return { view: hasData(a) ? view(a.enriched, state, actions) : noData() };
  });
}

function view(all: EnrichedRow[], state: AppState, actions: AppActions): TemplateResult {
  const { filters: f, sort, page } = state.transactions;
  const filtered = sortTransactions(filterTransactions(all, f), sort);
  const { inflow, outflow } = sumInOut(filtered);
  const { pageRows, totalPages } = paginate(filtered, page, TRANSACTIONS_PER_PAGE);
  const byDate = sort.startsWith('date');
  const from = filtered.length ? page * TRANSACTIONS_PER_PAGE + 1 : 0;
  const to = page * TRANSACTIONS_PER_PAGE + pageRows.length;
  const value = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement).value;

  return html`
    <section class="card card--flush" aria-label="Buchungsliste">
      <div class="tx-toolbar">
        <label class="search">
          ${icon('search', 16)}
          <input type="search" placeholder="Händler, Beschreibung oder Typ suchen" aria-label="Buchungen durchsuchen"
            .value=${f.search} @input=${(e: Event) => {
              const search = value(e);
              clearTimeout(searchTimer);
              searchTimer = setTimeout(() => actions.setTransactionFilters({ search }), SEARCH_DELAY);
            }}>
        </label>
        <div class="tx-filters">
          <div class="chips" role="group" aria-label="Buchungsart">
            ${KINDS.map((k) => html`
              <button type="button" class="chip" aria-pressed=${k.value === f.kind ? 'true' : 'false'}
                @click=${() => actions.setTransactionFilters({ kind: k.value })}>${k.label}</button>
            `)}
          </div>
          <select class="select" aria-label="Typ" @change=${(e: Event) => actions.setTransactionFilters({ category: value(e) })}>
            <option value="">Alle Typen</option>
            ${getAvailableCategories(all).map((c) => html`<option value=${c} ?selected=${f.category === c}>${c}</option>`)}
          </select>
          <select class="select" aria-label="Sortierung" @change=${(e: Event) => actions.setTransactionSort(value(e) as TransactionSort)}>
            ${SORTS.map((s) => html`<option value=${s.value} ?selected=${s.value === sort}>${s.label}</option>`)}
          </select>
          <span class="tx-summary">
            ${fmtN(filtered.length)} Buchungen · <span class="pos">+${fmt(inflow)}</span> rein · ${signed(outflow)} raus
          </span>
        </div>
      </div>

      <div class="tx-head" aria-hidden="true"><span></span><span>Name / Beschreibung</span><span>Typ</span><span>Betrag</span></div>

      ${filtered.length === 0
        ? html`<div class="empty"><strong>Keine Treffer</strong>Filter oder Suche anpassen.</div>`
        : byDate
          ? groupByDay(pageRows, filtered).map((g) => html`
              <section aria-label=${g.label}>
                <h3 class="tx-day"><span>${g.label}</span><span class=${g.sum > 0 ? 'pos' : ''}>${signed(g.sum)}</span></h3>
                <ul>${g.rows.map(row)}</ul>
              </section>
            `)
          : html`<ul>${pageRows.map(row)}</ul>`}

      ${totalPages > 1 ? html`
        <nav class="pager" aria-label="Seiten">
          <span class="num">${fmtN(from)}–${fmtN(to)} von ${fmtN(filtered.length)}</span>
          <div class="pager-buttons">
            <button type="button" class="btn" aria-label="Vorherige Seite" ?disabled=${page === 0}
              @click=${() => actions.setTransactionPage(page - 1)}>${icon('chevronLeft', 16)}</button>
            ${computePaginationItems(page, totalPages).map((item) =>
              item.type === 'page'
                ? html`<button type="button" class="btn pager-page" aria-current=${item.active ? 'page' : 'false'}
                    @click=${() => actions.setTransactionPage(item.page)}>${item.page + 1}</button>`
                : item.type === 'ellipsis' ? html`<span class="pager-page muted">…</span>` : nothing)}
            <button type="button" class="btn" aria-label="Nächste Seite" ?disabled=${page >= totalPages - 1}
              @click=${() => actions.setTransactionPage(page + 1)}>${icon('chevronRight', 16)}</button>
          </div>
        </nav>
      ` : nothing}
    </section>
  `;
}

function row(r: EnrichedRow): TemplateResult {
  const name = r._name || r._desc || typeLabel(r._type);
  const type = r._isInternal ? 'Umbuchung' : typeLabel(r._type);
  const detail = r._desc && r._desc !== name ? r._desc : type !== name ? type : '';
  return html`
    <li class="tx-row">
      <span class="avatar" aria-hidden="true">${name.charAt(0).toUpperCase()}</span>
      <div class="row-main">
        <div class="row-title">${name}</div>
        ${detail ? html`<div class="row-sub">${detail}</div>` : nothing}
      </div>
      <span class="tx-type"><span class="badge ${badgeClass(r)}">${type}</span></span>
      <div class="tx-amount ${r._amt > 0 ? 'pos' : ''}">
        ${signed(r._amt)}
        ${r._fee ? html`<small>Gebühr ${fmt(Math.abs(r._fee))}</small>` : nothing}
      </div>
    </li>
  `;
}
