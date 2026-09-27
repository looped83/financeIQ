import { fmt, fmtP, fmtSigned, mLabel } from '../../domain/format';
import { TARGETS } from '../../domain/targets';
import type { Analysis } from '../../domain/types';

export interface OverviewRates {
  savingsRate: number;
  passiveRatio: number;
  investRate: number;
}

/** Share of spending paid by card, in %. */
export function cardShare(a: Analysis): number {
  const card = a.mKeys.reduce((s, mk) => s + a.months[mk]!.cardExpense, 0);
  return a.totalExp < 0 ? (card / Math.abs(a.totalExp)) * 100 : 0;
}

/** Buys minus sells — what actually stayed invested. */
export function netInvested(a: Analysis): number {
  return a.totalInv - a.totalSold;
}

export function computeOverviewRates(a: Analysis): OverviewRates {
  return {
    savingsRate: a.totalInc > 0 ? (a.netBal / a.totalInc) * 100 : 0,
    passiveRatio: a.totalInc > 0 ? (a.totalDiv / a.totalInc) * 100 : 0,
    investRate: a.totalInc > 0 ? (netInvested(a) / a.totalInc) * 100 : 0,
  };
}

/** Which series a KPI's dot stands for; `status` marks a judged value (✓ / ⚠). */
export interface KpiCard {
  label: string;
  value: string;
  sub: string;
  dot?: 'income' | 'expense' | 'dividend' | 'invest';
  status?: 'good' | 'warn';
}

export function getOverviewKpis(a: Analysis, rates: OverviewRates): KpiCard[] {
  const positions = Object.keys(a.byAsset).length;
  return [
    { label: 'Einnahmen', value: fmt(a.totalInc, 0), sub: `Ø ${fmt(a.avgInc, 0)} / Monat`, dot: 'income' },
    { label: 'Ausgaben', value: fmt(Math.abs(a.totalExp), 0), sub: `Ø ${fmt(a.avgExp, 0)} / Monat`, dot: 'expense' },
    {
      label: 'Netto',
      value: fmtSigned(a.netBal, 0),
      sub: `Sparquote ${fmtP(rates.savingsRate)}`,
      status: rates.savingsRate >= TARGETS.savingsRate ? 'good' : 'warn',
    },
    {
      label: 'Dividenden (netto)',
      value: fmt(a.totalDiv, 0),
      sub: `Ø ${fmt(a.totalDiv / a.mc, 0)} / Monat · ${positions} ${positions === 1 ? 'Position' : 'Positionen'}`,
      dot: 'dividend',
    },
  ];
}

export interface RatioRow {
  label: string;
  value: string;
  /** Judged against a target; `null` for purely informational rows. */
  good: boolean | null;
}

export function computeFinancialRatios(a: Analysis, rates: OverviewRates): RatioRow[] {
  const { savingsRate, passiveRatio, investRate } = rates;
  const cardRatio = cardShare(a);
  const avgTxSize = a.exp.length > 0 ? Math.abs(a.totalExp) / a.exp.length : 0;
  const feeRatio = a.totalInv > 0 ? (a.totalFee / a.totalInv) * 100 : 0;

  let best = { k: '', v: -Infinity };
  let worst = { k: '', v: Infinity };
  for (const mk of a.mKeys) {
    const n = a.months[mk]?.net ?? 0;
    if (n > best.v) best = { k: mk, v: n };
    if (n < worst.v) worst = { k: mk, v: n };
  }

  return [
    { label: 'Sparquote', value: fmtP(savingsRate), good: savingsRate >= TARGETS.savingsRate },
    { label: 'Investitionsrate (netto)', value: fmtP(investRate), good: investRate >= TARGETS.investRate },
    { label: 'Passives Einkommen', value: fmtP(passiveRatio), good: passiveRatio >= TARGETS.passiveRate },
    { label: 'Kartenzahlungsanteil', value: fmtP(cardRatio), good: cardRatio < TARGETS.cardShare },
    { label: 'Gebührenquote', value: a.totalInv > 0 ? fmtP(feeRatio) : '–', good: a.totalInv > 0 ? feeRatio < TARGETS.feeRate : null },
    { label: 'Ø Ausgabe pro Buchung', value: fmt(avgTxSize), good: null },
    { label: 'Ø Buchungen pro Monat', value: Math.round(a.enriched.length / a.mc) + '×', good: null },
    { label: 'Bester Monat', value: `${mLabel(best.k)} (${fmt(best.v)})`, good: null },
    { label: 'Schwächster Monat', value: `${mLabel(worst.k)} (${fmt(worst.v)})`, good: worst.v >= 0 ? null : false },
  ];
}
