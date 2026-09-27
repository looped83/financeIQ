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
const filePick = $<HTMLInputElement>('file-pick');
const uploadZone = $('upload-zone');
const toast = $('toast');

const pages = new Map<string, MountedPage>();

const shell = createShell(
  { sidebar: $('sidebar'), header: $('page-header'), bottomNav: $('bottom-nav'), sheet: $('sheet') },
  store,
  actions,
  { pickFile: () => filePick.click(), removeFile },
);

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** A short message at the bottom of the screen, gone after a few seconds. */
function notify(message: string): void {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 6000);
}

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

/** Replaces the session only once the new file parsed — a bad or cancelled pick keeps the current data. */
function loadPrimaryFile(text: string, fileName: string): void {
  let analysis: ReturnType<typeof analyze>;
  try {
    const rows = parseCSV(text);
    analysis = analyze(rows);
    if (!analysis.enriched.length) {
      notify(`${fileName}: keine auswertbaren Buchungen gefunden.`);
      return;
    }
  } catch (err) {
    console.error('Fehler beim Verarbeiten der CSV:', err);
    notify(`${fileName} konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  unmountAll();
  actions.loadFile(analysis, fileName);
  void persistPrimaryFile(kv, fileName, text);
  history.replaceState(null, '', href('uebersicht'));
  showApp();
}

function readAndLoad(file: File): void {
  file.text()
    .then((text) => loadPrimaryFile(text, file.name))
    .catch(() => notify(`${file.name} konnte nicht gelesen werden.`));
}

/** Forgets the file on this device (memory and IndexedDB) and returns to the upload screen. */
function removeFile(): void {
  if (!confirm('Geladene Datei und gespeicherte Sitzung von diesem Gerät entfernen?')) return;
  unmountAll();
  actions.resetAll();
  void clearPersistedSession(kv);
  app.hidden = true;
  uploadScreen.hidden = false;
}

for (const input of [fileInput, filePick]) {
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = ''; // picking the same file again must fire "change" again
    if (file) readAndLoad(file);
  });
}
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

