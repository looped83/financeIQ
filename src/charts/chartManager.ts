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
  Tooltip,
  type ChartConfiguration,
  type ChartType,
} from 'chart.js';
import { fmt, fmtP } from '../domain/format';
import { COLORS, seriesColor } from '../theme/palette';
import { track, tracked, untrack } from './registry';

// Register only what the app draws (bar, line, doughnut) instead of every
// controller/scale Chart.js ships — keeps the lazily loaded chart chunk small.
// No Legend plugin: legends are HTML (ui/components chartBox), so they sit in
// the same place on every card instead of wherever the canvas layout puts them.
Chart.register(
  BarController, LineController, DoughnutController,
  BarElement, LineElement, PointElement, ArcElement,
  CategoryScale, LinearScale,
  Filler, Tooltip,
);

// Theme once, globally, so individual chart configs only carry their data.
const d = Chart.defaults;
d.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'system-ui, sans-serif';
d.font.size = 11;
d.color = COLORS.textMuted;
d.borderColor = COLORS.raised;
d.maintainAspectRatio = false;
// No animations: every chart appears in its final state at once — less CPU and
// battery, and data switches (toggles, period) never replay an intro.
d.animation = false;
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

/**
 * Draws `config` on `canvas`. A chart of the same type already on that canvas is
 * updated in place (new data and options, one redraw) instead of being destroyed
 * and rebuilt; `null` (canvas not rendered) is a no-op.
 */
export function mountChart<T extends ChartType>(canvas: HTMLCanvasElement | null, config: ChartConfiguration<T>): void {
  if (!canvas) return;
  const current = tracked(canvas);
  if (current instanceof Chart && (current.config as ChartConfiguration).type === config.type) {
    current.data = config.data as Chart['data'];
    current.options = (config.options ?? {}) as Chart['options'];
    current.update();
    return;
  }
  untrack(canvas);
  track(canvas, new Chart(canvas, config));
}

/** The ring chart of `donut()` (ui/components): series colors in entry order, amount and share in the tooltip. */
export function mountDonut(canvas: HTMLCanvasElement | null, entries: [string, number][], total: number): void {
  mountChart(canvas, {
    type: 'doughnut',
    data: {
      labels: entries.map(([l]) => l),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map((_, i) => seriesColor(i)) }],
    },
    options: {
      cutout: '72%',
      plugins: {
        tooltip: { callbacks: { label: (c) => ` ${fmt(Number(c.parsed))} · ${fmtP(total ? (Number(c.parsed) / total) * 100 : 0)}` } },
      },
    },
  });
}
