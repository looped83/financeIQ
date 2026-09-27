import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../domain/csv';
import { analyze } from '../domain/analyze';
import { createAppStore } from './appStore';
import { initialAppState } from './appState';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const analysisA = analyze(parseCSV(fixture('dividends-and-corrections.csv')));

describe('appStore', () => {
  it('starts in the documented initial state', () => {
    const { store } = createAppStore();
    expect(store.getState()).toEqual(initialAppState());
  });

  it('loadFile sets analysis/fileName and resets every other slice', () => {
    const { store, actions } = createAppStore();
    actions.setTimelineView('quarterly');
    actions.setTransactionFilters({ search: 'coffee' });

    actions.loadFile(analysisA, 'export.csv');

    const state = store.getState();
    expect(state.analysis).toBe(analysisA);
    expect(state.fileName).toBe('export.csv');
    expect(state.timelineView).toBe('daily');
    expect(state.transactions.filters.search).toBe('');
  });

  it('resetAll returns to the exact initial state', () => {
    const { store, actions } = createAppStore();
    actions.loadFile(analysisA, 'export.csv');
    actions.setForecastMonths(12);

    actions.resetAll();

    expect(store.getState()).toEqual(initialAppState());
  });

  it('setTimelineView / setForecastMonths update only their own field', () => {
    const { store, actions } = createAppStore();
    actions.setTimelineView('monthly');
    actions.setForecastMonths(6);

    const state = store.getState();
    expect(state.timelineView).toBe('monthly');
    expect(state.forecastMonths).toBe(6);
  });

  it('loadFile starts on the whole history: analysis is fullAnalysis', () => {
    const { store, actions } = createAppStore();
    actions.loadFile(analysisA, 'export.csv');
    expect(store.getState().fullAnalysis).toBe(analysisA);
    expect(store.getState().period).toBeNull();
  });

  it('setPeriod narrows analysis to the period and keeps fullAnalysis intact', () => {
    const { store, actions } = createAppStore();
    actions.loadFile(analysisA, 'export.csv');
    actions.setTransactionPage(2);

    actions.setPeriod({ from: '2024-03', to: '2024-03' });

    const state = store.getState();
    expect(state.fullAnalysis).toBe(analysisA);
    expect(state.analysis!.mKeys).toEqual(['2024-03']);
    expect(state.analysis!.enriched.every((r) => r._month === '2024-03')).toBe(true);
    expect(state.transactions.page).toBe(0);

    actions.setPeriod(null);
    expect(store.getState().analysis).toBe(analysisA);
  });

  it('setPeriod is a no-op without data or for the same period', () => {
    const { store, actions } = createAppStore();
    actions.setPeriod({ from: '2024-03', to: '2024-03' });
    expect(store.getState().period).toBeNull();

    actions.loadFile(analysisA, 'export.csv');
    actions.setPeriod({ from: '2024-03', to: '2024-03' });
    const narrowed = store.getState().analysis;
    actions.setPeriod({ from: '2024-03', to: '2024-03' });
    expect(store.getState().analysis).toBe(narrowed);
  });

  it('setTransactionFilters merges the patch and resets pagination to page 0', () => {
    const { store, actions } = createAppStore();
    actions.setTransactionPage(3);

    actions.setTransactionFilters({ kind: 'out' });
    expect(store.getState().transactions.filters.kind).toBe('out');
    expect(store.getState().transactions.page).toBe(0);

    actions.setTransactionPage(2);
    actions.setTransactionFilters({ category: 'Kartenzahlungen' });
    const filters = store.getState().transactions.filters;
    expect(filters.kind).toBe('out'); // previous patch preserved
    expect(filters.category).toBe('Kartenzahlungen');
    expect(store.getState().transactions.page).toBe(0);
  });

  it('setTransactionSort updates sort and resets pagination to page 0', () => {
    const { store, actions } = createAppStore();
    actions.setTransactionPage(4);

    actions.setTransactionSort('amount-desc');

    expect(store.getState().transactions.sort).toBe('amount-desc');
    expect(store.getState().transactions.page).toBe(0);
  });

  it('setTransactionPage updates only the page', () => {
    const { store, actions } = createAppStore();
    actions.setTransactionFilters({ search: 'x' });

    actions.setTransactionPage(7);

    expect(store.getState().transactions.page).toBe(7);
    expect(store.getState().transactions.filters.search).toBe('x');
  });

  it('resetTransactionFilters clears filters, sort, and page together', () => {
    const { store, actions } = createAppStore();
    actions.setTransactionFilters({ search: 'x', kind: 'div' });
    actions.setTransactionSort('amount-asc');
    actions.setTransactionPage(5);

    actions.resetTransactionFilters();

    expect(store.getState().transactions).toEqual({
      filters: { kind: 'all', category: '', search: '' },
      sort: 'date-desc',
      page: 0,
    });
  });

  it('subscribers are notified on every action', () => {
    const { store, actions } = createAppStore();
    const seen: string[] = [];
    store.subscribe((s) => seen.push(s.timelineView));

    actions.setTimelineView('monthly');
    actions.setTimelineView('quarterly');

    expect(seen).toEqual(['monthly', 'quarterly']);
  });
});
