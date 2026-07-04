import { defineConfig } from 'vite';

// Phase 0: prove the build pipeline works against the existing index.html
// unmodified. No source transforms yet — that starts in Phase 1 when the
// domain layer (parseCSV/analyze) moves into src/domain/*.ts.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
});
