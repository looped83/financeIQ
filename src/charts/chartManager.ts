import { Chart, registerables, type ChartConfiguration } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

const registry = new WeakMap<HTMLCanvasElement, Chart>();

/** Creates (or replaces) the Chart.js instance for `canvas`, destroying any previous one first. */
export function mountChart(canvas: HTMLCanvasElement, config: ChartConfiguration): Chart {
  registry.get(canvas)?.destroy();
  const chart = new Chart(canvas, config);
  registry.set(canvas, chart);
  return chart;
}
