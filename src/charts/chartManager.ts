import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
  type ChartConfiguration,
  type ChartType,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { COLORS } from '../theme/palette';
import { track, untrack } from './registry';

// Register only what the app draws (bar, line, doughnut) instead of every
// controller/scale Chart.js ships — keeps the lazily loaded chart chunk small.
// No Legend plugin: legends are HTML (ui/components chartBox), so they sit in
// the same place on every card instead of wherever the canvas layout puts them.
Chart.register(
  BarController, LineController, DoughnutController,
  BarElement, LineElement, PointElement, ArcElement,
  CategoryScale, LinearScale, TimeScale,
  Filler, Tooltip,
);

// Theme once, globally, so individual chart configs only carry their data.
const d = Chart.defaults;
d.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'system-ui, sans-serif';
d.font.size = 11;
d.color = COLORS.textMuted;
d.borderColor = COLORS.raised;
d.maintainAspectRatio = false;
if (matchMedia('(prefers-reduced-motion: reduce)').matches) d.animation = false;
d.elements.bar.borderRadius = 4;
d.elements.line.borderWidth = 2;
d.elements.line.tension = 0.3;
d.elements.point.radius = 0;
d.elements.point.hoverRadius = 4;
d.elements.point.hitRadius = 8;
d.elements.arc.borderWidth = 2;
d.elements.arc.borderColor = COLORS.surface;
const tip = d.plugins.tooltip;
tip.backgroundColor = COLORS.raised;
tip.borderColor = COLORS.lineStrong;
tip.borderWidth = 1;
tip.titleColor = COLORS.text;
tip.bodyColor = COLORS.textSecondary;
tip.padding = 10;
tip.cornerRadius = 8;
tip.boxPadding = 4;
tip.usePointStyle = true;

/** Creates (or replaces) the Chart.js instance for `canvas`; `null` (canvas not rendered) is a no-op. */
export function mountChart<T extends ChartType>(canvas: HTMLCanvasElement | null, config: ChartConfiguration<T>): void {
  if (!canvas) return;
  untrack(canvas);
  track(canvas, new Chart(canvas, config));
}
