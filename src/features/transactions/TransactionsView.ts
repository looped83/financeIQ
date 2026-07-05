import { html, nothing, render, type TemplateResult } from 'lit-html';
import { fmt, fmtD, monthName, typeLabel } from '../../domain/format';
import type { EnrichedRow } from '../../domain/types';
import type { AppActions } from '../../state/appStore';
import type { AppState, TransactionSort } from '../../state/appState';
import { TRANSACTIONS_PER_PAGE } from '../../state/appState';
import { subscribeSelected, type Store } from '../../state/store';
import {
  computePaginationItems,
  computeTransactionKpis,
  filterTransactions,
  getAvailableCategories,
  getAvailableYears,
  paginate,
  sortTransactions,
  type PaginationItem,
} from './selectors';

/**
 * Mounts the Transaktionen tab into `container`, re-rendering whenever the
 * analysis or the transactions slice (filters/sort/page) changes. Returns an
 * unsubscribe function to unmount.
 */
export function mountTransactionsView(
  container: HTMLElement,
  store: Store<AppState>,
  actions: AppActions,
): () => void {
  return subscribeSelected(
    store,
    (s) => [s.analysis, s.transactions],
    (state) => render(view(state, actions), container),
  );
}

function view(state: AppState, actions: AppActions): TemplateResult {
  if (!state.analysis) {
    return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;
  }

  const allRows = state.analysis.enriched;
  const filtered = filterTransactions(allRows, state.transactions.filters);
  const sorted = sortTransactions(filtered, state.transactions.sort);
  const kpis = computeTransactionKpis(sorted);
  const { pageRows, totalPages } = paginate(sorted, state.transactions.page, TRANSACTIONS_PER_PAGE);
  const paginationItems = computePaginationItems(state.transactions.page, totalPages);
  const years = getAvailableYears(allRows);
  const categories = getAvailableCategories(allRows);
  const f = state.transactions.filters;

  const selectValue = (e: Event) => (e.target as HTMLSelectElement).value;
  const inputValue = (e: Event) => (e.target as HTMLInputElement).value;

  return html`
    <div class="g4" style="margin-bottom:1.2rem;">
      ${kpiCard('Einnahmen', kpis.income, 'income')}
      ${kpiCard('Ausgaben', Math.abs(kpis.expense), 'expense')}
      ${kpiCard('Investitionen', kpis.invested, 'invest')}
      ${kpiCard('Dividenden', kpis.dividend, 'dividend')}
    </div>

    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;gap:.5rem;">
        <span class="card-title">${sorted.length} Transaktionen</span>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-left:auto;">
          <select class="tx-input tx-select" @change=${(e: Event) => actions.setTransactionFilters({ year: selectValue(e) })}>
            <option value="">Alle Jahre</option>
            ${years.map((y) => html`<option value=${y} ?selected=${f.year === y}>${y}</option>`)}
          </select>
          <select class="tx-input tx-select" @change=${(e: Event) => actions.setTransactionFilters({ month: selectValue(e) })}>
            <option value="">Alle Monate</option>
            ${Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(
              (mn) => html`<option value=${mn} ?selected=${f.month === mn}>${monthName(mn)}</option>`,
            )}
          </select>
          <input type="date" class="tx-input" .value=${f.from}
            @change=${(e: Event) => actions.setTransactionFilters({ from: inputValue(e) })}>
          <input type="date" class="tx-input" .value=${f.to}
            @change=${(e: Event) => actions.setTransactionFilters({ to: inputValue(e) })}>
          <select class="tx-input tx-select" @change=${(e: Event) => actions.setTransactionFilters({ category: selectValue(e) })}>
            <option value="">Alle Kategorien</option>
            ${categories.map((c) => html`<option value=${c} ?selected=${f.category === c}>${c}</option>`)}
          </select>
          <input type="text" class="tx-input" style="width:160px;" placeholder="Suche…" .value=${f.search}
            @input=${(e: Event) => actions.setTransactionFilters({ search: inputValue(e) })}>
          <select class="tx-input tx-select"
            @change=${(e: Event) => actions.setTransactionSort(selectValue(e) as TransactionSort)}>
            <option value="date-desc" ?selected=${state.transactions.sort === 'date-desc'}>Datum ↓</option>
            <option value="date-asc" ?selected=${state.transactions.sort === 'date-asc'}>Datum ↑</option>
            <option value="amount-desc" ?selected=${state.transactions.sort === 'amount-desc'}>Betrag ↓</option>
            <option value="amount-asc" ?selected=${state.transactions.sort === 'amount-asc'}>Betrag ↑</option>
          </select>
          <button class="cb" @click=${() => actions.resetTransactionFilters()}>× Reset</button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead>
            <tr>
              <th>Datum</th><th>Typ</th><th>Name / Beschreibung</th><th>Kategorie</th>
              <th style="text-align:right">Betrag</th><th style="text-align:right">Gebühr</th>
            </tr>
          </thead>
          <tbody>${pageRows.map(transactionRow)}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:center;gap:.4rem;margin-top:1rem;">
        ${paginationItems.map((item) => paginationButton(item, actions))}
      </div>
    </div>
  `;
}

function kpiCard(label: string, value: number, cls: string): TemplateResult {
  return html`
    <div class="kpi ${cls}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value ${cls}">${fmt(value)}</div>
    </div>
  `;
}

function transactionRow(r: EnrichedRow): TemplateResult {
  const amtCls = r._isBuy ? 'neu' : r._amt >= 0 ? 'pos' : 'neg';
  const badgeCls = r._amt >= 0 ? 'bg' : r._isBuy ? 'bb' : 'br';
  return html`
    <tr>
      <td>${fmtD(r._date)}</td>
      <td><span class="badge ${badgeCls}" style="font-size:.68rem">${typeLabel(r._type)}</span></td>
      <td>
        ${r._name || '—'}
        ${r._desc
          ? html`<span style="color:var(--text-muted);font-size:.72rem;display:block;margin-top:.1rem;">${r._desc.substring(0, 60)}</span>`
          : nothing}
      </td>
      <td style="color:var(--text-muted)">${r._cat || '—'}</td>
      <td style="text-align:right" class=${amtCls}>${fmt(r._amt)}</td>
      <td style="text-align:right;color:var(--text-muted)">${r._fee ? fmt(r._fee) : '—'}</td>
    </tr>
  `;
}

function paginationButton(item: PaginationItem, actions: AppActions): TemplateResult {
  switch (item.type) {
    case 'prev':
      return html`<button class="cb" @click=${() => actions.setTransactionPage(item.page)}>‹</button>`;
    case 'next':
      return html`<button class="cb" @click=${() => actions.setTransactionPage(item.page)}>›</button>`;
    case 'ellipsis':
      return html`<span style="color:var(--text-muted);padding:0 .3rem;">…</span>`;
    case 'page':
      return html`<button class="cb ${item.active ? 'active' : ''}"
        @click=${() => actions.setTransactionPage(item.page)}>${item.page + 1}</button>`;
  }
}
