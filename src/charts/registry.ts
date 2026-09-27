/**
 * Live Chart.js instances by canvas. Kept free of any Chart.js import so pages
 * without charts (Transaktionen) can release charts without loading the library.
 */
const charts = new Map<HTMLCanvasElement, { destroy(): void }>();

export function track(canvas: HTMLCanvasElement, chart: { destroy(): void }): void {
  charts.set(canvas, chart);
}

/** Destroys the chart on `canvas`, if any, so the canvas can be drawn on again. */
export function untrack(canvas: HTMLCanvasElement): void {
  charts.get(canvas)?.destroy();
  charts.delete(canvas);
}

/** Destroys every chart drawn inside `root`, plus any whose canvas already left the page. */
export function releaseCharts(root: HTMLElement): void {
  for (const [canvas, chart] of charts) {
    if (!canvas.isConnected || root.contains(canvas)) {
      chart.destroy();
      charts.delete(canvas);
    }
  }
}
