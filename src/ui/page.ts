import { render, type TemplateResult } from 'lit-html';
import { releaseCharts } from '../charts/registry';
import type { Analysis } from '../domain/types';
import type { AppState } from '../state/appState';
import { subscribeSelected, type Store, type Unsubscribe } from '../state/store';
import { emptyState } from './components';

export interface Drawn {
  view: TemplateResult;
  /** Runs after the DOM is in place — mount Chart.js instances here. */
  charts?: () => void;
}

/**
 * The lifecycle every page shares: re-draw when the selected slices change
 * (or when the page's own UI state changes via `redraw`), and clean up
 * subscriptions and charts on unmount. lit-html keeps unchanged canvases in
 * place, so `charts` updates their Chart.js instances; only charts whose canvas
 * left the DOM are released.
 */
export function mountPage(
  container: HTMLElement,
  store: Store<AppState>,
  select: (s: AppState) => unknown[],
  draw: (state: AppState, redraw: () => void) => Drawn,
): Unsubscribe {
  const run = (state: AppState) => {
    const { view, charts } = draw(state, redraw);
    render(view, container);
    releaseCharts();
    charts?.();
  };
  const redraw = () => run(store.getState());
  const unsubscribe = subscribeSelected(store, select, run);
  return () => {
    unsubscribe();
    releaseCharts(container);
  };
}

export function hasData(a: Analysis | null): a is Analysis {
  return !!a && a.enriched.length > 0;
}

export function noData(): TemplateResult {
  return emptyState('Keine Buchungen', 'Im gewählten Zeitraum gibt es keine Buchungen – wähle oben einen anderen Zeitraum.');
}
