import { parseCSV } from '../domain/csv';
import { analyze } from '../domain/analyze';
import { createAppStore } from '../state/appStore';
import { mountOverviewView } from '../features/overview/OverviewView';
import { createIndexedDbStore } from '../persistence/indexedDbStore';
import { clearPersistedSession, persistCompareFile, persistPrimaryFile, restoreSession } from '../persistence/sessionBootstrap';

const { store, actions } = createAppStore();
const kv = createIndexedDbStore();

const appEl = document.getElementById('app');
if (!appEl) throw new Error('#app not found');
mountOverviewView(appEl, store);

const statusEl = document.getElementById('status')!;

restoreSession(kv, actions).then((restored) => {
  statusEl.textContent = restored
    ? `Aus vorheriger Sitzung wiederhergestellt: ${store.getState().fileName}`
    : 'Keine gespeicherte Sitzung gefunden — bitte CSV hochladen.';
});

const fileInput = document.getElementById('file-input') as HTMLInputElement;
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result);
    actions.loadFile(analyze(parseCSV(text)), file.name);
    persistPrimaryFile(kv, file.name, text).then(() => {
      statusEl.textContent = `Gespeichert: ${file.name}`;
    });
  };
  reader.readAsText(file);
});

const compareFileInput = document.getElementById('compare-file-input') as HTMLInputElement;
compareFileInput.addEventListener('change', () => {
  const file = compareFileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result);
    actions.loadCompareFile(analyze(parseCSV(text)), file.name);
    persistCompareFile(kv, file.name, text).then(() => {
      statusEl.textContent = `Vergleichsdatei gespeichert: ${file.name}`;
    });
  };
  reader.readAsText(file);
});

const clearBtn = document.getElementById('clear-btn')!;
clearBtn.addEventListener('click', () => {
  clearPersistedSession(kv).then(() => {
    actions.resetAll();
    statusEl.textContent = 'Gespeicherte Sitzung gelöscht.';
  });
});
