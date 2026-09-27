import './styles/tokens.css';
import './styles/app.css';
import { parseCSV } from './domain/csv';
import { analyze } from './domain/analyze';
import { createIndexedDbStore } from './persistence/indexedDbStore';
import { clearPersistedSession, persistPrimaryFile, restoreSession } from './persistence/sessionBootstrap';
import { createAppStore, type AppActions } from './state/appStore';
import type { AppState } from './state/appState';
import type { Store, Unsubscribe } from './state/store';
import { createGatedStore, type GatedStore } from './shell/gatedStore';
import { href, resolveRoute, type Route } from './shell/routes';
import { createShell } from './shell/shell';

type Mount = (container: HTMLElement, store: Store<AppState>, actions: AppActions) => Unsubscribe;

/**
 * One lazily imported module per page: the upload screen ships without Chart.js
 * or any page code; each page's bundle is fetched the first time it is opened.
 */
const PAGES: Record<string, () => Promise<Mount>> = {
  'uebersicht': () => import('./features/overview/OverviewView').then((m) => m.mountOverviewView),
  'cashflow/verlauf': () => import('./features/timeline/TimelineView').then((m) => m.mountTimelineView),
  'cashflow/monate': () => import('./features/monthly/MonthlyView').then((m) => m.mountMonthlyView),
  'cashflow/prognose': () => import('./features/forecast/ForecastView').then((m) => m.mountForecastView),
  'ausgaben': () => import('./features/spending/SpendingView').then((m) => m.mountSpendingView),
  'investments': () => import('./features/investments/InvestmentsView').then((m) => m.mountInvestmentsView),
  'vergleich/monate': () => import('./features/monthcompare/MonthCompareView').then((m) => m.mountMonthCompareView),
  'vergleich/jahre': () => import('./features/yearly/YearlyView').then((m) => m.mountYearlyView),
  'transaktionen': () => import('./features/transactions/TransactionsView').then((m) => m.mountTransactionsView),
};

interface MountedPage {
  el: HTMLElement;
  gate: GatedStore<AppState>;
  unmount?: Unsubscribe;
}

const { store, actions } = createAppStore();
const kv = createIndexedDbStore();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const uploadScreen = $('upload-screen');
const app = $('app');
const pagesRoot = $('pages');
const fileInput = $<HTMLInputElement>('file-input');
const uploadZone = $('upload-zone');

const pages = new Map<string, MountedPage>();

const shell = createShell(
  { sidebar: $('sidebar'), header: $('page-header'), bottomNav: $('bottom-nav'), sheet: $('sheet') },
  store,
  actions,
  resetAll,
);

function showPage(route: Route): void {
  shell.update(route);
  for (const [key, p] of pages) {
    const visible = key === route.key;
    p.el.hidden = !visible;
    p.gate.setOpen(visible);
  }
  if (!pages.has(route.key)) mountPage(route.key);
  window.scrollTo({ top: 0 });
}

function mountPage(key: string): void {
  const el = document.createElement('div');
  el.className = 'page';
  el.dataset.page = key;
  pagesRoot.append(el);
  const page: MountedPage = { el, gate: createGatedStore(store) };
  pages.set(key, page);
  PAGES[key]!()
    .then((mount) => {
      if (pages.get(key) !== page) return; // reset while loading
      page.unmount = mount(el, page.gate.store, actions);
      page.gate.setOpen(!el.hidden);
    })
    .catch((err) => console.error('Fehler beim Laden der Seite:', err));
}

/** Drops every mounted page (subscriptions, charts, DOM) — the next file starts clean. */
function unmountAll(): void {
  for (const p of pages.values()) {
    p.unmount?.();
    p.gate.dispose();
    p.el.remove();
  }
  pages.clear();
}

function showApp(): void {
  uploadScreen.hidden = true;
  app.hidden = false;
  showPage(resolveRoute(location.hash));
}

function loadPrimaryFile(text: string, fileName: string): void {
  let analysis: ReturnType<typeof analyze>;
  try {
    const rows = parseCSV(text);
    if (!rows.length) {
      alert('Keine Daten gefunden.');
      return;
    }
    analysis = analyze(rows);
  } catch (err) {
    console.error('Fehler beim Verarbeiten der CSV:', err);
    alert(`Fehler beim Verarbeiten der CSV-Datei: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  actions.loadFile(analysis, fileName);
  void persistPrimaryFile(kv, fileName, text);
  history.replaceState(null, '', href('uebersicht'));
  showApp();
}

function readAndLoad(file: File): void {
  file.text().then((text) => loadPrimaryFile(text, file.name));
}

function resetAll(): void {
  unmountAll();
  actions.resetAll();
  void clearPersistedSession(kv);
  fileInput.value = '';
  app.hidden = true;
  uploadScreen.hidden = false;
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) readAndLoad(file);
});
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('is-drag');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('is-drag'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('is-drag');
  const file = e.dataTransfer?.files[0];
  if (file) readAndLoad(file);
});

addEventListener('hashchange', () => {
  if (!app.hidden) showPage(resolveRoute(location.hash));
});

restoreSession(kv, actions).then((restored) => {
  if (restored) showApp();
});

