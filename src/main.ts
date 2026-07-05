import { parseCSV } from './domain/csv';
import { analyze } from './domain/analyze';
import { createAppStore } from './state/appStore';
import { createIndexedDbStore } from './persistence/indexedDbStore';
import { clearPersistedSession, persistPrimaryFile, restoreSession } from './persistence/sessionBootstrap';
import { mountOverviewView } from './features/overview/OverviewView';
import { mountTimelineView } from './features/timeline/TimelineView';
import { mountDeepDiveView } from './features/deepdive/DeepDiveView';
import { mountYearlyView } from './features/yearly/YearlyView';
import { mountMonthlyView } from './features/monthly/MonthlyView';
import { mountCategoriesView } from './features/categories/CategoriesView';
import { mountOutliersView } from './features/outliers/OutliersView';
import { mountForecastView } from './features/forecast/ForecastView';
import { mountCompareView } from './features/compare/CompareView';
import { mountRecommendationsView } from './features/recommendations/RecommendationsView';
import { mountTransactionsView } from './features/transactions/TransactionsView';

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
 *  keeps itself in sync with future data changes without needing to be re-mounted. */
const TAB_MOUNTERS: ((container: HTMLElement) => void)[] = [
  (el) => mountOverviewView(el, store),
  (el) => mountTimelineView(el, store, actions),
  (el) => mountDeepDiveView(el, store, actions),
  (el) => mountYearlyView(el, store),
  (el) => mountMonthlyView(el, store),
  (el) => mountCategoriesView(el, store),
  (el) => mountOutliersView(el, store),
  (el) => mountForecastView(el, store, actions),
  (el) => mountCompareView(el, store, actions),
  (el) => mountRecommendationsView(el, store),
  (el) => mountTransactionsView(el, store, actions),
];
const mountedTabs = new Set<number>();

function showTab(i: number): void {
  tabBtns.forEach((b, j) => b.classList.toggle('active', j === i));
  tabContents.forEach((c, j) => c.classList.toggle('active', j === i));
  if (!mountedTabs.has(i)) {
    TAB_MOUNTERS[i]?.(tabContents[i]!);
    mountedTabs.add(i);
  }
}

tabBtns.forEach((btn, i) => btn.addEventListener('click', () => showTab(i)));

function loadPrimaryFile(text: string, fileName: string): void {
  const rows = parseCSV(text);
  if (!rows.length) {
    alert('Keine Daten gefunden.');
    return;
  }
  actions.loadFile(analyze(rows), fileName);
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
