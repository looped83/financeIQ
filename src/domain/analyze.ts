import { findCol } from './csv';
import { typeLabel } from './format';
import type {
  Analysis,
  ByAssetAgg,
  ByTypeAgg,
  EnrichedRow,
  MonthAgg,
  OutlierRow,
  RawRow,
  YearAgg,
} from './types';

/** Only transactions on or after this date are included in the analysis. */
export const MIN_DATE = new Date('2024-01-01');

function parseAmount(v: string | undefined): number {
  let s = String(v || '').replace(/[€$£\s]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Both separators present: the later one is the decimal separator,
    // the other is a thousands separator ("1.234,56" vs "1,234.56").
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(',', '.');
  }
  return parseFloat(s) || 0;
}

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v.substring(0, 10));
  const m = v.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);
  return null;
}

/**
 * Bank transfers (rent, insurance, utilities) often arrive with an empty `name`
 * column — the payee lives only in the description, e.g.
 * "Outgoing transfer for Jens Spitzner (DE47…)" or
 * "Sepa Direct Debit transfer to Vodafone GmbH (DE13…)".
 * Extract the payee so these recurring costs aggregate under a stable name
 * instead of collapsing into a single nameless "Sonstiges" bucket. The capture
 * stops before the trailing IBAN in parentheses.
 */
function payeeFromDescription(desc: string): string {
  const m = desc.match(/transfer (?:for|to) (.+?)(?:\s*\((?:[A-Z]{2}\d)|$)/i);
  return m ? m[1]!.trim() : '';
}

export function analyze(rows: RawRow[]): Analysis {
  return aggregate(enrich(rows));
}

/** Parses the raw CSV rows into typed transactions (dated on/after MIN_DATE), sorted by date. */
export function enrich(rows: RawRow[]): EnrichedRow[] {
  const amtCol = findCol(rows, ['amount', 'betrag', 'value', 'wert']);
  const dateCol = findCol(rows, ['date', 'datum', 'buchungsdatum', 'valuta']);
  const typeCol = findCol(rows, ['type', 'typ', 'buchungstext', 'transaction_type']);
  const catCol = findCol(rows, ['category', 'kategorie', 'cat']);
  const nameCol = findCol(rows, ['name', 'bezeichnung', 'empfaenger', 'recipient', 'asset_name']);
  const feeCol = findCol(rows, ['fee', 'gebuehr', 'fees']);
  const taxCol = findCol(rows, ['tax', 'steuer', 'taxes']);
  const assetCol = findCol(rows, ['asset_class', 'assetclass', 'asset_typ']);
  const descCol = findCol(rows, ['description', 'beschreibung', 'text', 'verwendungszweck']);

  const withDate = rows.map((r) => {
    const rawAmt = amtCol ? parseAmount(r[amtCol]) : 0;
    const fee = feeCol ? parseAmount(r[feeCol]) : 0;
    const tax = taxCol ? parseAmount(r[taxCol]) : 0;
    const date = dateCol ? parseDate(r[dateCol]) : null;
    const type = typeCol ? r[typeCol] ?? '' : '';
    const cat = catCol ? r[catCol] ?? '' : '';
    const asset = assetCol ? r[assetCol] ?? '' : '';
    const desc = descCol ? r[descCol] ?? '' : '';
    let name = nameCol ? r[nameCol] ?? '' : '';
    if (!name.trim() && desc) name = payeeFromDescription(desc);
    const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : '';
    const year = date ? String(date.getFullYear()) : '';
    const isBuy = type === 'BUY';
    const isSell = type === 'SELL';
    const isDiv = type === 'DIVIDEND';
    const isInterest = type === 'INTEREST_PAYMENT';
    const isCard = type === 'CARD_TRANSACTION' || type === 'CARD_TRANSACTION_INTERNATIONAL';
    const amt = isBuy || isSell ? rawAmt : rawAmt + tax;
    return {
      ...r,
      _amt: amt, _fee: fee, _tax: tax, _date: date, _month: month, _year: year,
      _type: type, _cat: cat, _name: name, _asset: asset, _desc: desc,
      _isBuy: isBuy, _isSell: isSell, _isDiv: isDiv, _isInterest: isInterest, _isCard: isCard,
      _isInternal: false, _isFixed: false,
    };
  });

  const enriched = withDate
    .filter((r): r is EnrichedRow => r._date !== null && r._date >= MIN_DATE)
    .sort((a, b) => a._date.getTime() - b._date.getTime());
  markInternalTransfers(enriched);
  markFixedCosts(enriched);
  return enriched;
}

/** Money that really came in or went out: no trades, no transfers between own accounts. */
export function isCashflow(r: EnrichedRow): boolean {
  return !r._isBuy && !r._isSell && !r._isInternal;
}

/** A real expense: cash out that is neither a trade, an own-account transfer nor a dividend/interest correction. */
export function isSpend(r: EnrichedRow): boolean {
  return r._amt < 0 && isCashflow(r) && !r._isDiv && !r._isInterest;
}

const TRANSFER_TYPE = /TRANSFER|BERWEISUNG|GUTSCHRIFT|LASTSCHRIFT|DAUERAUFTRAG/i;

/**
 * Compares payee names across spelling variants ("Lutz Brüggemann", "Lutz Bruggemann",
 * "Brueggemann Lutz"): umlauts folded, word order ignored.
 */
function payeeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([aou])e/g, '$1')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/**
 * A payee that money is transferred both to and from is treated as an own account
 * (another bank, a second broker): moving money there is neither income nor spending.
 */
function markInternalTransfers(rows: EnrichedRow[]): void {
  const flows = new Map<string, { in: boolean; out: boolean }>();
  const keyOf = (r: EnrichedRow) => (r._name && TRANSFER_TYPE.test(r._type) ? payeeKey(r._name) : '');
  for (const r of rows) {
    const key = keyOf(r);
    if (!key) continue;
    const f = flows.get(key) ?? { in: false, out: false };
    if (r._amt > 0) f.in = true;
    else if (r._amt < 0) f.out = true;
    flows.set(key, f);
  }
  for (const r of rows) {
    const f = flows.get(keyOf(r));
    r._isInternal = !!f && f.in && f.out;
  }
}

/**
 * Fixed costs (Fixkosten): payees paid in at least 3 months (2 when the data is shorter)
 * with a stable monthly total — coefficient of variation (std/mean) ≤ 0.30. Calibrated on
 * real data: rent/insurance/gym land at 0.0–0.22, groceries/shopping at 0.39+.
 * Decided once on the whole history, so every period agrees on what is fixed.
 */
function markFixedCosts(rows: EnrichedRow[], maxCv = 0.3): void {
  const byName = new Map<string, Map<string, number>>();
  const months = new Set<string>();
  for (const r of rows) {
    months.add(r._month);
    if (!r._name || !isSpend(r)) continue;
    let perMonth = byName.get(r._name);
    if (!perMonth) byName.set(r._name, (perMonth = new Map()));
    perMonth.set(r._month, (perMonth.get(r._month) ?? 0) + Math.abs(r._amt));
  }
  const minMonths = months.size >= 3 ? 3 : Math.max(2, months.size);
  const fixed = new Set<string>();
  for (const [name, perMonth] of byName) {
    if (perMonth.size < minMonths) continue;
    const vals = [...perMonth.values()];
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    if (mean > 0 && Math.sqrt(variance) / mean <= maxCv) fixed.add(name);
  }
  for (const r of rows) r._isFixed = fixed.has(r._name) && isSpend(r);
}

/**
 * Builds every aggregate the dashboard shows from already-enriched, date-sorted
 * transactions. Split from enrich() so a sub-range (the global period, a single
 * month) can be re-aggregated without re-parsing the CSV.
 */
export function aggregate(enriched: EnrichedRow[]): Analysis {
  const cash = enriched.filter(isCashflow);
  const inc = cash.filter((r) => r._amt > 0);
  const exp = cash.filter((r) => r._amt < 0);
  const buys = enriched.filter((r) => r._isBuy);
  const sells = enriched.filter((r) => r._isSell);
  const divs = enriched.filter((r) => r._isDiv);

  const totalInc = inc.reduce((s, r) => s + r._amt, 0);
  const totalExp = exp.reduce((s, r) => s + r._amt, 0);
  const totalInv = buys.reduce((s, r) => s + Math.abs(r._amt), 0);
  const totalSold = sells.reduce((s, r) => s + r._amt, 0);
  const totalDiv = divs.reduce((s, r) => s + r._amt, 0);
  const netBal = totalInc + totalExp;
  const totalFee = enriched.reduce((s, r) => s + Math.abs(r._fee), 0);

  // Monthly
  const months: Record<string, MonthAgg> = {};
  for (const r of enriched) {
    if (!r._month) continue;
    const m = (months[r._month] ??= {
      income: 0, expense: 0, invested: 0, sold: 0, dividend: 0, count: 0, cardCount: 0,
      net: 0, cumBal: 0, savingsRate: 0,
    });
    m.count++;
    if (r._isCard) m.cardCount++;
    if (r._isInternal) continue;
    if (r._isBuy) m.invested += Math.abs(r._amt);
    else if (r._isSell) m.sold += r._amt;
    else if (r._amt > 0) m.income += r._amt;
    else m.expense += r._amt;
    if (r._isDiv) m.dividend += r._amt;
  }
  const mKeys = Object.keys(months).sort();
  let cum = 0;
  for (const mk of mKeys) {
    const m = months[mk]!;
    m.net = m.income + m.expense;
    cum += m.net;
    m.cumBal = cum;
    m.savingsRate = m.income > 0 ? (m.net / m.income) * 100 : 0;
  }

  // Yearly
  const years: Record<string, YearAgg> = {};
  for (const mk of mKeys) {
    const y = mk.split('-')[0]!;
    const yr = (years[y] ??= {
      income: 0, expense: 0, invested: 0, sold: 0, dividend: 0, fees: 0, net: 0, months: 0,
    });
    const m = months[mk]!;
    yr.months++;
    yr.income += m.income;
    yr.expense += m.expense;
    yr.invested += m.invested;
    yr.sold += m.sold;
    yr.dividend += m.dividend;
    yr.net += m.net;
  }
  for (const r of enriched) {
    const yr = r._year ? years[r._year] : undefined;
    if (yr) {
      yr.fees += Math.abs(r._fee);
    }
  }
  const yKeys = Object.keys(years).sort();

  // By type
  const byType: Record<string, ByTypeAgg> = {};
  for (const r of enriched) {
    const t = r._type || 'Unbekannt';
    const bt = (byType[t] ??= { income: 0, expense: 0, count: 0 });
    if (r._amt > 0) bt.income += r._amt;
    else bt.expense += r._amt;
    bt.count++;
  }

  // By asset (dividends)
  const byAsset: Record<string, ByAssetAgg> = {};
  for (const r of divs) {
    const nm = r._name || 'Unbekannt';
    const ba = (byAsset[nm] ??= { total: 0, count: 0 });
    ba.total += r._amt;
    ba.count++;
  }

  // By asset class (trading)
  const byAssetClass: Record<string, number> = {};
  for (const r of buys) {
    const ac = r._asset || 'Unbekannt';
    byAssetClass[ac] = (byAssetClass[ac] ?? 0) + Math.abs(r._amt);
  }

  // Expense by category (Dividenden/Zinsen ausgeschlossen: vereinzelte Korrekturbuchungen
  // können netto negativ ausfallen, sind aber keine Ausgabenkategorie, sondern Ertragskorrekturen)
  const expCat: Record<string, number> = {};
  for (const r of exp) {
    if (r._isDiv || r._isInterest) continue;
    const t = typeLabel(r._type);
    expCat[t] = (expCat[t] ?? 0) + Math.abs(r._amt);
  }

  // Top merchants (card)
  const merchants: Record<string, { total: number; count: number }> = {};
  for (const r of enriched.filter((r) => r._isCard && r._amt < 0)) {
    const nm = r._name || 'Unbekannt';
    const mch = (merchants[nm] ??= { total: 0, count: 0 });
    mch.total += Math.abs(r._amt);
    mch.count++;
  }

  // Outliers (cash, z-score)
  const cashAmts = cash.map((r) => Math.abs(r._amt));
  const cashN = cashAmts.length || 1; // guard: a CSV with only BUY/SELL rows has no cash transactions
  const mean = cashAmts.reduce((s, v) => s + v, 0) / cashN;
  const std = Math.sqrt(cashAmts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / cashN);
  const outliers: OutlierRow[] =
    std > 0
      ? cash
          .filter((r) => Math.abs(Math.abs(r._amt) - mean) / std > 2)
          .map((r) => ({ ...r, _z: (Math.abs(r._amt) - mean) / std }) as OutlierRow)
          .sort((a, b) => b._z - a._z)
      : [];

  const mc = mKeys.length || 1;
  const avgInc = totalInc / mc;
  const avgExp = Math.abs(totalExp) / mc;
  const avgNet = netBal / mc;

  return {
    enriched, cash, inc, exp, buys, sells, divs,
    totalInc, totalExp, totalInv, totalSold, totalDiv, netBal, totalFee,
    months, mKeys, years, yKeys, byType, byAsset, byAssetClass, expCat, merchants, outliers,
    avgInc, avgExp, avgNet, mean, std, mc,
  };
}
