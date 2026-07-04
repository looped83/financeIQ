import { typeLabel } from '../../domain/format';
import type { EnrichedRow } from '../../domain/types';
import type { TransactionFilters, TransactionSort } from '../../state/appState';

/** Distinct years present in the data, ascending — used to populate the year filter. */
export function getAvailableYears(rows: EnrichedRow[]): string[] {
  return [...new Set(rows.map((r) => r._year).filter(Boolean))].sort();
}

/** Distinct display categories (typeLabel'd) present in the data, alphabetical. */
export function getAvailableCategories(rows: EnrichedRow[]): string[] {
  return [...new Set(rows.map((r) => typeLabel(r._type)).filter(Boolean))].sort();
}

export function filterTransactions(rows: EnrichedRow[], filters: TransactionFilters): EnrichedRow[] {
  const search = filters.search.toLowerCase().trim();
  const fromDate = filters.from ? new Date(filters.from) : null;
  const toDate = filters.to ? new Date(filters.to + 'T23:59:59') : null;

  return rows.filter((r) => {
    if (filters.year && r._year !== filters.year) return false;
    if (filters.month && r._month.split('-')[1] !== filters.month) return false;
    if (fromDate && r._date < fromDate) return false;
    if (toDate && r._date > toDate) return false;
    if (filters.category && typeLabel(r._type) !== filters.category) return false;
    if (search) {
      const haystack = [r._name, r._desc, r._type, typeLabel(r._type), r._cat, r._asset]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function sortTransactions(rows: EnrichedRow[], sort: TransactionSort): EnrichedRow[] {
  const sorted = [...rows];
  switch (sort) {
    case 'date-desc':
      return sorted.sort((a, b) => b._date.getTime() - a._date.getTime());
    case 'date-asc':
      return sorted.sort((a, b) => a._date.getTime() - b._date.getTime());
    case 'amount-desc':
      return sorted.sort((a, b) => Math.abs(b._amt) - Math.abs(a._amt));
    case 'amount-asc':
      return sorted.sort((a, b) => Math.abs(a._amt) - Math.abs(b._amt));
  }
}

export interface TransactionKpis {
  income: number;
  expense: number;
  invested: number;
  dividend: number;
}

/** Same income/expense/invested/dividend split analyze() uses, recomputed for a filtered subset. */
export function computeTransactionKpis(rows: EnrichedRow[]): TransactionKpis {
  let income = 0, expense = 0, invested = 0, dividend = 0;
  for (const r of rows) {
    if (r._isBuy) invested += Math.abs(r._amt);
    else if (!r._isSell) {
      if (r._amt > 0) income += r._amt;
      else expense += r._amt;
    }
    if (r._isDiv) dividend += r._amt;
  }
  return { income, expense, invested, dividend };
}

export interface PageResult<T> {
  pageRows: T[];
  totalPages: number;
}

export function paginate<T>(rows: T[], page: number, perPage: number): PageResult<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const start = page * perPage;
  return { pageRows: rows.slice(start, start + perPage), totalPages };
}

export type PaginationItem =
  | { type: 'prev'; page: number }
  | { type: 'next'; page: number }
  | { type: 'page'; page: number; active: boolean }
  | { type: 'ellipsis' };

/**
 * Builds the "‹ 1 2 … 7 8 9 … 14 15 ›" button/ellipsis sequence for a
 * pagination bar: always show first/last page, the current page ± `range`,
 * and collapse everything else into a single ellipsis on each side.
 */
export function computePaginationItems(page: number, totalPages: number, range = 2): PaginationItem[] {
  if (totalPages <= 1) return [];
  const items: PaginationItem[] = [];
  if (page > 0) items.push({ type: 'prev', page: page - 1 });
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= range) {
      items.push({ type: 'page', page: i, active: i === page });
    } else if (i === page - range - 1 || i === page + range + 1) {
      items.push({ type: 'ellipsis' });
    }
  }
  if (page < totalPages - 1) items.push({ type: 'next', page: page + 1 });
  return items;
}
