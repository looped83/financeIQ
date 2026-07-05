import { parseCSV } from '../domain/csv';
import { analyze } from '../domain/analyze';
import { createAppStore } from '../state/appStore';
import { mountCompareView } from '../features/compare/CompareView';

const { store, actions } = createAppStore();

const appEl = document.getElementById('app');
if (!appEl) throw new Error('#app not found');
mountCompareView(appEl, store, actions);

const fileInput = document.getElementById('file-input') as HTMLInputElement;
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCSV(String(reader.result));
    actions.loadFile(analyze(rows), file.name);
  };
  reader.readAsText(file);
});
