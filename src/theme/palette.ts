/**
 * Colors that Chart.js needs as literal strings (canvas can't read CSS custom
 * properties). src/styles/tokens.css mirrors every value here under the CSS
 * name given in the comment; palette.test.ts fails if the two drift apart.
 */
export const COLORS = {
  text: '#f3f0eb', //         --text
  textSecondary: '#c3bdb3', // --text-2
  textMuted: '#948d83', //    --text-3
  surface: '#1b1a18', //      --surface
  raised: '#242220', //       --raised
  line: '#2a2825', //         --line
  lineStrong: '#2f2c29', //   --line-strong
  axis: '#3a3733', //         --axis
  accent: '#f47a32', //       --accent
  income: '#39ad79', //       --income
  expense: '#d02b31', //      --expense
  invest: '#3987e5', //       --invest
  dividend: '#c98500', //     --dividend
  warning: '#fab219', //      --warning
  other: '#736d64', //        --other
} as const;

/**
 * Categorical series colors, assigned in this fixed order and never cycled:
 * a 7th series folds into "Sonstige" (COLORS.other). The order is validated
 * for red–green colour blindness (adjacent ΔE ≥ 13) and ≥ 3:1 contrast on
 * the card surface. Orange is deliberately absent — it belongs to the UI accent.
 */
export const SERIES = ['#3987e5', '#c98500', '#d55181', '#008300', '#9085e9', '#199e70'] as const;

/** Name/value pairs folded to at most SERIES.length entries plus one "Sonstige" bucket. */
export function foldToSeries(entries: [string, number][], otherLabel = 'Sonstige'): [string, number][] {
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  if (sorted.length <= SERIES.length) return sorted;
  const head = sorted.slice(0, SERIES.length);
  const rest = sorted.slice(SERIES.length).reduce((s, [, v]) => s + v, 0);
  return [...head, [otherLabel, rest]];
}

/** Color for the i-th entry of a folded list: series slot, or gray for the trailing "Sonstige". */
export function seriesColor(i: number): string {
  return SERIES[i] ?? COLORS.other;
}

/** `hex` at the given opacity — for area fills under a line. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
