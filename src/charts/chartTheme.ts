import type { TooltipItem } from 'chart.js';
import { fmt, fmtN } from '../domain/format';
import { COLORS } from '../theme/palette';

type Unit = '€' | '%' | '';

/** Category/time x-axis: no vertical grid, a baseline, unrotated ticks. */
export function xScale() {
  return { grid: { display: false }, border: { color: COLORS.axis }, ticks: { maxRotation: 0, autoSkipPadding: 12 } };
}

/** Value y-axis: hairline grid, compact ticks in € (default), % or plain numbers. */
export function yScale(unit: Unit = '€') {
  return {
    grid: { color: COLORS.raised },
    border: { display: false },
    ticks: {
      maxTicksLimit: 6,
      callback: (v: number | string) => (unit === '€' ? `${fmtN(Number(v))} €` : unit === '%' ? `${v} %` : v),
    },
  };
}

export function axes(unit: Unit = '€') {
  return { x: xScale(), y: yScale(unit) };
}

/** Horizontal bars: values on x, category labels on y. */
export function horizontalAxes() {
  return {
    x: yScale(),
    y: { grid: { display: false }, border: { color: COLORS.axis }, ticks: { color: COLORS.textSecondary } },
  };
}

/** Tooltip line "Label: 1.234,56 €" — reads x for horizontal bars, y otherwise. */
export function euroLabel(item: TooltipItem<'bar' | 'line' | 'doughnut'>): string {
  const p = item.parsed as number | { x: number; y: number };
  const v = typeof p === 'number' ? p : item.chart.options.indexAxis === 'y' ? p.x : p.y;
  return `${item.dataset.label || item.label}: ${fmt(v ?? 0)}`;
}

/** Multi-series line/bar charts: one tooltip for the hovered index, values in €. */
export const INDEX_TOOLTIP = {
  interaction: { mode: 'index' as const, intersect: false },
  plugins: { tooltip: { callbacks: { label: euroLabel } } },
};
