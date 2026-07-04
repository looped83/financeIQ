import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { initialTransactionFilters } from '../../state/appState';
import {
  computePaginationItems,
  computeTransactionKpis,
  filterTransactions,
  getAvailableCategories,
  getAvailableYears,
  paginate,
  sortTransactions,
} from './selectors';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const a = analyze(parseCSV(fixture('dividends-and-corrections.csv')));
const rows = a.enriched; // 8 rows: tx-001..tx-008, spanning 2024-02 and 2024-03

describe('getAvailableYears / getAvailableCategories', () => {
  it('lists distinct years ascending', () => {
    expect(getAvailableYears(rows)).toEqual(['2024']);
  });

  it('lists distinct display categories alphabetically', () => {
    expect(getAvailableCategories(rows)).toEqual([
      'Dividenden', 'Eingehend', 'Kartenzahlungen', 'Käufe', 'Steuerkorrektur', 'Verkäufe',
    ]);
  });
});

describe('filterTransactions', () => {
  it('returns everything when no filter is set', () => {
    expect(filterTransactions(rows, initialTransactionFilters())).toHaveLength(8);
  });

  it('filters by month regardless of year filter', () => {
    const result = filterTransactions(rows, { ...initialTransactionFilters(), month: '03' });
    expect(result.map((r) => r.transaction_id)).toEqual(['tx-007', 'tx-008']);
  });

  it('filters by a date range (inclusive of the "to" day)', () => {
    const result = filterTransactions(rows, {
      ...initialTransactionFilters(), from: '2024-02-01', to: '2024-02-05',
    });
    expect(result.map((r) => r.transaction_id)).toEqual(['tx-001', 'tx-002']);
  });

  it('filters by category (typeLabel of _type)', () => {
    const result = filterTransactions(rows, { ...initialTransactionFilters(), category: 'Dividenden' });
    expect(result.map((r) => r.transaction_id)).toEqual(['tx-003', 'tx-004']);
  });

  it('search matches name/description/type/category case-insensitively', () => {
    const result = filterTransactions(rows, { ...initialTransactionFilters(), search: 'BAKERY' });
    expect(result.map((r) => r.transaction_id)).toEqual(['tx-002']);
  });

  it('combines multiple filters with AND semantics', () => {
    const result = filterTransactions(rows, {
      ...initialTransactionFilters(), year: '2024', category: 'Steuerkorrektur', search: 'reversal',
    });
    expect(result.map((r) => r.transaction_id)).toEqual(['tx-008']);
  });
});

describe('sortTransactions', () => {
  it('date-desc puts the most recent transaction first', () => {
    const result = sortTransactions(rows, 'date-desc');
    expect(result[0]?.transaction_id).toBe('tx-008');
    expect(result[result.length - 1]?.transaction_id).toBe('tx-001');
  });

  it('date-asc puts the oldest transaction first', () => {
    const result = sortTransactions(rows, 'date-asc');
    expect(result[0]?.transaction_id).toBe('tx-001');
  });

  it('amount-desc sorts by absolute amount, largest first', () => {
    const result = sortTransactions(rows, 'amount-desc');
    // |2000| (tx-001) > |1000| (tx-005) > |550| (tx-006) > ...
    expect(result[0]?.transaction_id).toBe('tx-001');
    expect(result[1]?.transaction_id).toBe('tx-005');
  });

  it('does not mutate the input array', () => {
    const copy = [...rows];
    sortTransactions(rows, 'date-asc');
    expect(rows).toEqual(copy);
  });
});

describe('computeTransactionKpis', () => {
  it('matches the hand-computed totals from the analyze() fixture tests', () => {
    // income: 2000 (salary) + 85 (net dividend) + 30 (tax refund) = 2115
    // expense: -45.50 (card) + -15 (dividend correction) + -30 (tax debit) = -90.50
    const kpis = computeTransactionKpis(rows);
    expect(kpis.income).toBeCloseTo(2115.0, 3);
    expect(kpis.expense).toBeCloseTo(-90.5, 3);
    expect(kpis.invested).toBeCloseTo(1000.0, 3); // BUY, gross
    expect(kpis.dividend).toBeCloseTo(70.0, 3); // 85 + -15, net
  });

  it('recomputes correctly for an already-filtered subset', () => {
    const marchOnly = filterTransactions(rows, { ...initialTransactionFilters(), month: '03' });
    const kpis = computeTransactionKpis(marchOnly);
    expect(kpis.income).toBeCloseTo(30.0, 3);
    expect(kpis.expense).toBeCloseTo(-30.0, 3);
  });
});

describe('paginate', () => {
  it('slices the requested page and reports total pages', () => {
    const { pageRows, totalPages } = paginate(rows, 0, 3);
    expect(pageRows).toHaveLength(3);
    expect(totalPages).toBe(3); // ceil(8/3)
  });

  it('returns the remainder on the last page', () => {
    const { pageRows } = paginate(rows, 2, 3);
    expect(pageRows).toHaveLength(2);
  });

  it('reports exactly 1 total page for an empty input', () => {
    expect(paginate([], 0, 50).totalPages).toBe(1);
  });
});

describe('computePaginationItems', () => {
  it('returns nothing when everything fits on one page', () => {
    expect(computePaginationItems(0, 1)).toEqual([]);
  });

  it('shows all pages without ellipsis when the total is small', () => {
    const items = computePaginationItems(2, 5);
    expect(items.map((i) => (i.type === 'page' ? i.page : i.type))).toEqual([
      'prev', 0, 1, 2, 3, 4, 'next',
    ]);
  });

  it('collapses distant pages into a single ellipsis on each side', () => {
    const items = computePaginationItems(7, 15, 2);
    // prev, page0, ellipsis, 5,6,7,8,9, ellipsis, page14, next
    expect(items.map((i) => (i.type === 'page' ? i.page : i.type))).toEqual([
      'prev', 0, 'ellipsis', 5, 6, 7, 8, 9, 'ellipsis', 14, 'next',
    ]);
    const current = items.find((i) => i.type === 'page' && i.page === 7);
    expect(current && current.type === 'page' && current.active).toBe(true);
  });

  it('omits "prev" on the first page and "next" on the last page', () => {
    const first = computePaginationItems(0, 3);
    expect(first[0]?.type).not.toBe('prev');
    const last = computePaginationItems(2, 3);
    expect(last[last.length - 1]?.type).not.toBe('next');
  });
});
