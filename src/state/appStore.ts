import { aggregate } from '../domain/analyze';
import { inPeriod, samePeriod, type Period } from '../domain/period';
import type { Analysis } from '../domain/types';
import { createStore, type Store } from './store';
import {
  initialAppState,
  initialTransactionFilters,
  type AppState,
  type MonthCompareMetric,
  type TimelineView,
  type TransactionFilters,
  type TransactionSort,
} from './appState';

/**
 * Chart.js instances are deliberately NOT part of this state: they're
 * imperative handles to <canvas> elements, owned by the views that draw them.
 */
export interface AppActions {
  /** Loads a new CSV — replaces the whole session, period back to the whole history. */
  loadFile(analysis: Analysis, fileName: string): void;
  /** Back to the empty/upload-screen state. */
  resetAll(): void;
  /** Narrows `analysis` to `period` (null = whole history). */
  setPeriod(period: Period): void;

  setTimelineView(view: TimelineView): void;
  setForecastMonths(months: number): void;

  setMonthCompareA(month: string): void;
  setMonthCompareB(month: string): void;
  setMonthCompareMetric(metric: MonthCompareMetric): void;

  setTransactionFilters(patch: Partial<TransactionFilters>): void;
  setTransactionSort(sort: TransactionSort): void;
  setTransactionPage(page: number): void;
  resetTransactionFilters(): void;
}

export function createAppStore(): { store: Store<AppState>; actions: AppActions } {
  const store = createStore<AppState>(initialAppState());

  const actions: AppActions = {
    loadFile(analysis, fileName) {
      store.setState({ ...initialAppState(), fullAnalysis: analysis, analysis, fileName });
    },

    resetAll() {
      store.setState(initialAppState());
    },

    setPeriod(period) {
      store.setState((s) => {
        if (!s.fullAnalysis || samePeriod(s.period, period)) return s;
        const analysis = period
          ? aggregate(s.fullAnalysis.enriched.filter((r) => inPeriod(r._month, period)))
          : s.fullAnalysis;
        return { ...s, period, analysis, transactions: { ...s.transactions, page: 0 } };
      });
    },

    setTimelineView(view) {
      store.setState((s) => ({ ...s, timelineView: view }));
    },

    setForecastMonths(months) {
      store.setState((s) => ({ ...s, forecastMonths: months }));
    },

    setMonthCompareA(month) {
      store.setState((s) => ({ ...s, monthCompare: { ...s.monthCompare, monthA: month } }));
    },

    setMonthCompareB(month) {
      store.setState((s) => ({ ...s, monthCompare: { ...s.monthCompare, monthB: month } }));
    },

    setMonthCompareMetric(metric) {
      store.setState((s) => ({ ...s, monthCompare: { ...s.monthCompare, metric } }));
    },

    setTransactionFilters(patch) {
      store.setState((s) => ({
        ...s,
        transactions: {
          ...s.transactions,
          filters: { ...s.transactions.filters, ...patch },
          page: 0, // any filter change restarts pagination
        },
      }));
    },

    setTransactionSort(sort) {
      store.setState((s) => ({ ...s, transactions: { ...s.transactions, sort, page: 0 } }));
    },

    setTransactionPage(page) {
      store.setState((s) => ({ ...s, transactions: { ...s.transactions, page } }));
    },

    resetTransactionFilters() {
      store.setState((s) => ({
        ...s,
        transactions: { filters: initialTransactionFilters(), sort: 'date-desc', page: 0 },
      }));
    },
  };

  return { store, actions };
}
