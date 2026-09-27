const TYPE_LABELS: Record<string, string> = {
  CARD_TRANSACTION: 'Kartenzahlungen',
  CARD_TRANSACTION_INTERNATIONAL: 'Karte Ausland',
  TRANSFER_INSTANT_OUTBOUND: 'Überweisungen',
  TRANSFER_OUTBOUND: 'Überweisungen',
  TRANSFER_DIRECT_DEBIT_INBOUND: 'Lastschriften',
  BUY: 'Käufe',
  SELL: 'Verkäufe',
  DIVIDEND: 'Dividenden',
  INTEREST_PAYMENT: 'Zinsen',
  BENEFITS_SAVEBACK: 'Saveback',
  TRANSFER_INBOUND: 'Eingehend',
  TRANSFER_INSTANT_INBOUND: 'Sofort-Eingang',
  TAX_OPTIMIZATION: 'Steuerkorrektur',
};

export function typeLabel(t: string): string {
  return TYPE_LABELS[t] || t;
}

const numberFormatCache: Record<number, Intl.NumberFormat> = {};
function numFmt(decimals: number): Intl.NumberFormat {
  return (numberFormatCache[decimals] ??= new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }));
}
const intFmt = new Intl.NumberFormat('de-DE');

export function fmt(v: number, decimals = 2): string {
  if (isNaN(v)) return '—';
  return numFmt(decimals).format(v) + ' €';
}

export function fmtN(v: number): string {
  return intFmt.format(Math.round(v));
}

export function fmtP(v: number): string {
  return numFmt(1).format(v) + ' %';
}

export function fmtPP(v: number): string {
  return (v >= 0 ? '+' : '') + fmtP(v);
}

export function fmtD(d: Date | null): string {
  return d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

/** Formats a "YYYY-MM" month key as a short German label, e.g. "2024-03" -> "Mär 24". */
export function mLabel(mk: string): string {
  const [y, m] = mk.split('-');
  return y && m ? `${monthName(m)} ${y.slice(2)}` : mk;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** Formats a two-digit month string ("01".."12") as a short German name. */
export function monthName(mn: string): string {
  return MONTH_NAMES[parseInt(mn, 10) - 1] || mn;
}
