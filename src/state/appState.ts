import type { Analysis } from '../domain/types';

export type TimelineView = 'daily' | 'monthly' | 'quarterly';
export type CompareMetric = 'income' | 'expense' | 'net' | 'invested';
export type TransactionSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

/** How many transaction rows are shown per page (not user-adjustable today). */
export const TRANSACTIONS_PER_PAGE = 50;

export interface TransactionFilters {
  year: string;
  month: string;
  from: string;
  to: string;
  category: string;
  search: string;
}

export interface TransactionsState {
  filters: TransactionFilters;
  sort: TransactionSort;
  page: number;
}

export interface CompareState {
  /** null = no second file loaded yet (mirrors G.cmpData in index.html today). */
  analysis: Analysis | null;
  /**
   * The second file's display name. Not persisted anywhere in the current
   * index.html (it's only ever a local variable inside loadCompareFile(),
   * baked once into rendered HTML text) — genuinely new here, needed so a
   * future re-render can reproduce the "Basis vs. Vergleich" headline
   * without re-reading the DOM.
   */
  fileName: string;
  metric: CompareMetric;
}

export interface AppState {
  /** null until a CSV has been loaded. */
  analysis: Analysis | null;
  fileName: string;
  timelineView: TimelineView;
  forecastMonths: number;
  /** null until the Deep-Dive tab has been opened at least once. */
  deepDiveSelectedMonth: string | null;
  compare: CompareState;
  transactions: TransactionsState;
}

export function initialTransactionFilters(): TransactionFilters {
  return { year: '', month: '', from: '', to: '', category: '', search: '' };
}

export function initialAppState(): AppState {
  return {
    analysis: null,
    fileName: '',
    timelineView: 'daily',
    forecastMonths: 3,
    deepDiveSelectedMonth: null,
    compare: { analysis: null, fileName: '', metric: 'income' },
    transactions: { filters: initialTransactionFilters(), sort: 'date-desc', page: 0 },
  };
}
