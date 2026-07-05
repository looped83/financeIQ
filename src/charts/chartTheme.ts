import type { ChartOptions, ScaleOptionsByType } from 'chart.js';
import { fmtN } from '../domain/format';

export const BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#b0bfd0', font: { size: 11 } } } },
} satisfies ChartOptions;

export function xScale() {
  return { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8b9bb5', font: { size: 10 } } };
}

export function yScale(euro = true) {
  return {
    grid: { color: 'rgba(255,255,255,.05)' },
    ticks: { color: '#8b9bb5', font: { size: 10 }, callback: (v: number | string) => (euro ? fmtN(Number(v)) + '€' : v) },
  };
}

export function darkAxes(): { x: ReturnType<typeof xScale>; y: ReturnType<typeof yScale> } {
  return { x: xScale(), y: yScale() };
}
