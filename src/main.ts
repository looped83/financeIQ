import { parseCSV } from './domain/csv';
import { analyze } from './domain/analyze';
import { createAppStore } from './state/appStore';
import { createIndexedDbStore } from './persistence/indexedDbStore';
import { clearPersistedSession, persistPrimaryFile, restoreSession } from './persistence/sessionBootstrap';

const { store, actions } = createAppStore();
const kv = createIndexedDbStore();

const uploadScreen = document.getElementById('upload-screen')!;
const dashboard = document.getElementById('dashboard')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const uploadZone = document.getElementById('upload-zone')!;
const resetBtn = document.getElementById('reset-btn')!;
const tabBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'));
const tabContents = Array.from(document.querySelectorAll<HTMLElement>('.tab-content'));

/** Each tab is mounted the first time it's shown (matches the original's lazy
 *  `TAB_FNS`/`rendered` behavior) — mounting a Chart.js canvas while its container is
 *  `display:none` produces a zero-size, broken chart, so eager-mounting all 11 tabs
 *  up front isn't an option. Once mounted, a tab's view subscribes to the store and
 *  keeps itself in sync with future data changes without needing to be re-mounted.
 *
 *  Views are code-split via dynamic import(): the upload screen loads without
 *  Chart.js (~260 kB) or any tab bundle; each is fetched on first display. */
const TAB_LOADERS: (() => Promise<(container: HTMLElement) => void>)[] = [
  () => import('./features/overview/OverviewView').then((m) => (el) => m.mountOverviewView(el, store)),
  () => import('./features/timeline/TimelineView').then((m) => (el) => m.mountTimelineView(el, store, actions)),
  () => import('./features/deepdive/DeepDiveView').then((m) => (el) => m.mountDeepDiveView(el, store, actions)),
  () => import('./features/yearly/YearlyView').then((m) => (el) => m.mountYearlyView(el, store)),
  () => import('./features/monthly/MonthlyView').then((m) => (el) => m.mountMonthlyView(el, store)),
  () => import('./features/categories/CategoriesView').then((m) => (el) => m.mountCategoriesView(el, store)),
  () => import('./features/outliers/OutliersView').then((m) => (el) => m.mountOutliersView(el, store)),
  () => import('./features/forecast/ForecastView').then((m) => (el) => m.mountForecastView(el, store, actions)),
  () => import('./features/compare/CompareView').then((m) => (el) => m.mountCompareView(el, store, actions)),
  () => import('./features/recommendations/RecommendationsView').then((m) => (el) => m.mountRecommendationsView(el, store)),
  () => import('./features/transactions/TransactionsView').then((m) => (el) => m.mountTransactionsView(el, store, actions)),
  () => import('./features/monthcompare/MonthCompareView').then((m) => (el) => m.mountMonthCompareView(el, store, actions)),
];
const mountedTabs = new Set<number>();
const loadingTabs = new Set<number>();

function showTab(i: number): void {
  tabBtns.forEach((b, j) => b.classList.toggle('active', j === i));
  tabContents.forEach((c, j) => c.classList.toggle('active', j === i));
  if (mountedTabs.has(i) || loadingTabs.has(i)) return;
  loadingTabs.add(i);
  TAB_LOADERS[i]?.()
    .then((mount) => {
      // Only mount while the tab is still visible — if the user switched away
      // during the import, a hidden container would produce zero-size charts;
      // the next click on this tab retries (the module is already cached).
      if (tabContents[i]!.classList.contains('active')) {
        mount(tabContents[i]!);
        mountedTabs.add(i);
      }
    })
    .catch((err) => console.error('Fehler beim Laden des Tabs:', err))
    .finally(() => loadingTabs.delete(i));
}

tabBtns.forEach((btn, i) => btn.addEventListener('click', () => showTab(i)));

function loadPrimaryFile(text: string, fileName: string): void {
  let rows: ReturnType<typeof parseCSV>;
  let analysis: ReturnType<typeof analyze>;
  try {
    rows = parseCSV(text);
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
  uploadScreen.style.display = 'none';
  dashboard.style.display = 'block';
  showTab(0);
}

function readAndLoad(file: File): void {
  const reader = new FileReader();
  reader.onload = () => loadPrimaryFile(String(reader.result), file.name);
  reader.readAsText(file);
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) readAndLoad(file);
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag');
  const file = e.dataTransfer?.files[0];
  if (file) readAndLoad(file);
});

resetBtn.addEventListener('click', () => {
  actions.resetAll();
  void clearPersistedSession(kv);
  fileInput.value = '';
  uploadScreen.style.display = 'flex';
  dashboard.style.display = 'none';
  showTab(0);
});

restoreSession(kv, actions).then((restored) => {
  if (!restored) return;
  uploadScreen.style.display = 'none';
  dashboard.style.display = 'block';
  showTab(0);
});
