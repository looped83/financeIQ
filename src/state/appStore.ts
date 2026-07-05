import type { Analysis } from '../domain/types';
import { createStore, type Store } from './store';
import {
  initialAppState,
  initialTransactionFilters,
  type AppState,
  type CompareMetric,
  type MonthCompareMetric,
  type TimelineView,
  type TransactionFilters,
  type TransactionSort,
} from './appState';

/**
 * Chart.js instances (G.charts in index.html today) are deliberately NOT
 * part of this state: they're imperative handles to <canvas> elements, not
 * serializable app data. That bookkeeping belongs to whatever owns the DOM
 * in Phase 3 (a component's own effect/cleanup), not the data store.
 */
export interface AppActions {
  /** Loads a new primary CSV — replaces the whole session (mirrors initDashboard()). */
  loadFile(analysis: Analysis, fileName: string): void;
  /** Back to the empty/upload-screen state (mirrors resetDashboard()). */
  resetAll(): void;

  setTimelineView(view: TimelineView): void;
  setForecastMonths(months: number): void;
  setDeepDiveMonth(month: string): void;

  loadCompareFile(analysis: Analysis, fileName: string): void;
  resetCompare(): void;
  setCompareMetric(metric: CompareMetric): void;

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
      store.setState({ ...initialAppState(), analysis, fileName });
    },

    resetAll() {
      store.setState(initialAppState());
    },

    setTimelineView(view) {
      store.setState((s) => ({ ...s, timelineView: view }));
    },

    setForecastMonths(months) {
      store.setState((s) => ({ ...s, forecastMonths: months }));
    },

    setDeepDiveMonth(month) {
      store.setState((s) => ({ ...s, deepDiveSelectedMonth: month }));
    },

    loadCompareFile(analysis, fileName) {
      // Note: metric is intentionally left as-is — matches today's behavior,
      // where G.cmpMetric survives across compare loads/resets and is only
      // reset by a full resetAll().
      store.setState((s) => ({ ...s, compare: { ...s.compare, analysis, fileName } }));
    },

    resetCompare() {
      store.setState((s) => ({ ...s, compare: { ...s.compare, analysis: null, fileName: '' } }));
    },

    setCompareMetric(metric) {
      store.setState((s) => ({ ...s, compare: { ...s.compare, metric } }));
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
          page: 0, // any filter change restarts pagination, mirroring applyTxFilters()
        },
      }));
    },

    setTransactionSort(sort) {
      store.setState((s) => ({
        ...s,
        transactions: { ...s.transactions, sort, page: 0 },
      }));
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
