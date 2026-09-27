/**
 * Live Chart.js instances by canvas. Kept free of any Chart.js import so pages
 * without charts (Transaktionen) can release charts without loading the library.
 */
interface Tracked {
  destroy(): void;
}

const charts = new Map<HTMLCanvasElement, Tracked>();

export function track(canvas: HTMLCanvasElement, chart: Tracked): void {
  charts.set(canvas, chart);
}

/** The chart currently drawn on `canvas`, if any. */
export function tracked(canvas: HTMLCanvasElement): Tracked | undefined {
  return charts.get(canvas);
}

/** Destroys the chart on `canvas`, if any, so the canvas can be drawn on again. */
export function untrack(canvas: HTMLCanvasElement): void {
  charts.get(canvas)?.destroy();
  charts.delete(canvas);
}

/** Destroys every chart drawn inside `root` (all of them when omitted), plus any whose canvas left the page. */
export function releaseCharts(root?: HTMLElement): void {
  for (const [canvas, chart] of charts) {
    if (!canvas.isConnected || root?.contains(canvas)) {
      chart.destroy();
      charts.delete(canvas);
    }
  }
}
