import type { Period } from '../domain/period';
import type { Analysis } from '../domain/types';

export type TimelineView = 'daily' | 'monthly' | 'quarterly';
export type TransactionSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
/** Transaktionen quick filter: money in, money out, trades, dividends. */
export type TransactionKind = 'all' | 'in' | 'out' | 'invest' | 'div';

/** How many transaction rows are shown per page (not user-adjustable today). */
export const TRANSACTIONS_PER_PAGE = 50;

/** Date filtering is the global period's job — these only narrow within it. */
export interface TransactionFilters {
  kind: TransactionKind;
  category: string;
  search: string;
}

export interface TransactionsState {
  filters: TransactionFilters;
  sort: TransactionSort;
  page: number;
}

export type MonthCompareMetric = 'income' | 'expense' | 'net' | 'invested' | 'dividend';

export interface MonthCompareState {
  monthA: string | null;
  monthB: string | null;
  metric: MonthCompareMetric;
}

export interface AppState {
  /** The whole history — Prognose and Vergleich always read this. null until a CSV is loaded. */
  fullAnalysis: Analysis | null;
  /** fullAnalysis narrowed to `period` (the very same object while `period` is null). */
  analysis: Analysis | null;
  period: Period;
  fileName: string;
  timelineView: TimelineView;
  forecastMonths: number;
  monthCompare: MonthCompareState;
  transactions: TransactionsState;
}

export function initialTransactionFilters(): TransactionFilters {
  return { kind: 'all', category: '', search: '' };
}

export function initialAppState(): AppState {
  return {
    fullAnalysis: null,
    analysis: null,
    period: null,
    fileName: '',
    timelineView: 'daily',
    forecastMonths: 3,
    monthCompare: { monthA: null, monthB: null, metric: 'income' },
    transactions: { filters: initialTransactionFilters(), sort: 'date-desc', page: 0 },
  };
}
