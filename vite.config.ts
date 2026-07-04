import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Phase 0: prove the build pipeline works against the existing index.html
// unmodified.
//
// Phase 3 adds a second entry point — src/dev/transactions-preview.html —
// a standalone page for previewing migrated tab components (starting with
// Transaktionen) before they're wired into the real, still-live index.html.
// Vite builds each HTML entry independently, so this does not change
// dist/index.html's output at all.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        transactionsPreview: resolve(__dirname, 'src/dev/transactions-preview.html'),
        overviewPreview: resolve(__dirname, 'src/dev/overview-preview.html'),
        categoriesPreview: resolve(__dirname, 'src/dev/categories-preview.html'),
        yearlyPreview: resolve(__dirname, 'src/dev/yearly-preview.html'),
        monthlyPreview: resolve(__dirname, 'src/dev/monthly-preview.html'),
      },
    },
  },
});
