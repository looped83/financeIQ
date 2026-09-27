import { mLabel, monthName } from './format';

/** Inclusive range of "YYYY-MM" month keys; `null` means the whole history. */
export type Period = { from: string; to: string } | null;

export interface PeriodPreset {
  id: string;
  label: string;
  period: Period;
}

export interface Bounds {
  first: string;
  last: string;
}

export function addMonths(mk: string, n: number): string {
  const [y, m] = mk.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

function monthIndex(mk: string): number {
  const [y, m] = mk.split('-').map(Number) as [number, number];
  return y * 12 + m - 1;
}

export function periodLength(p: NonNullable<Period>): number {
  return monthIndex(p.to) - monthIndex(p.from) + 1;
}

/** "YYYY-MM" keys compare correctly as strings. */
export function inPeriod(mk: string, p: Period): boolean {
  return !p || (mk >= p.from && mk <= p.to);
}

function clamp(p: NonNullable<Period>, b: Bounds): Period {
  const from = p.from < b.first ? b.first : p.from;
  const to = p.to > b.last ? b.last : p.to;
  return from <= to ? { from, to } : null;
}

function yearPeriod(year: string, b: Bounds): Period {
  return clamp({ from: `${year}-01`, to: `${year}-12` }, b);
}

/** The calendar year `p` covers exactly (after clamping to the data), if any. */
function asYear(p: NonNullable<Period>, b: Bounds): string | null {
  const y = p.from.slice(0, 4);
  if (p.to.slice(0, 4) !== y) return null;
  const yp = yearPeriod(y, b);
  return yp && yp.from === p.from && yp.to === p.to ? y : null;
}

export function boundsOf(mKeys: string[]): Bounds | null {
  return mKeys.length ? { first: mKeys[0]!, last: mKeys[mKeys.length - 1]! } : null;
}

/** Presets relative to the data's last month (not today — exports can be old). */
export function buildPresets(mKeys: string[]): PeriodPreset[] {
  const all: PeriodPreset = { id: 'all', label: 'Gesamter Zeitraum', period: null };
  const b = boundsOf(mKeys);
  if (!b) return [all];
  const recent = (months: number): Period => clamp({ from: addMonths(b.last, 1 - months), to: b.last }, b);
  const years = [...new Set(mKeys.map((k) => k.slice(0, 4)))].sort().reverse();
  return [
    all,
    { id: 'last12', label: 'Letzte 12 Monate', period: recent(12) },
    { id: 'last3', label: 'Letzte 3 Monate', period: recent(3) },
    { id: 'last1', label: 'Letzter Monat', period: recent(1) },
    ...years.map((y) => ({ id: `y${y}`, label: `Jahr ${y}`, period: yearPeriod(y, b) })),
  ];
}

export function samePeriod(a: Period, b: Period): boolean {
  return a === b || (!!a && !!b && a.from === b.from && a.to === b.to);
}

/**
 * Moves `p` one step back (-1) or forward (+1): a whole calendar year steps by
 * year, anything else by its own length. The result is clamped to the data;
 * `null` when the step would leave the data entirely (or `p` is the whole history).
 */
export function shiftPeriod(p: Period, dir: -1 | 1, b: Bounds): Period {
  if (!p) return null;
  const year = asYear(p, b);
  if (year) return yearPeriod(String(Number(year) + dir), b);
  const n = periodLength(p) * dir;
  return clamp({ from: addMonths(p.from, n), to: addMonths(p.to, n) }, b);
}

function monthYear(mk: string): string {
  return `${monthName(mk.slice(5, 7))} ${mk.slice(0, 4)}`;
}

/** "Gesamter Zeitraum" · "Sep 2026" · "Jan – Sep 2026" · "Okt 2025 – Sep 2026" */
export function periodLabel(p: Period): string {
  if (!p) return 'Gesamter Zeitraum';
  if (p.from === p.to) return monthYear(p.from);
  if (p.from.slice(0, 4) === p.to.slice(0, 4)) return `${monthName(p.from.slice(5, 7))} – ${monthYear(p.to)}`;
  return `${monthYear(p.from)} – ${monthYear(p.to)}`;
}

/** Compact form for narrow screens: "Sep 26" · "Jan 24 – Sep 26". */
export function periodLabelShort(p: NonNullable<Period>): string {
  return p.from === p.to ? mLabel(p.from) : `${mLabel(p.from)} – ${mLabel(p.to)}`;
}
