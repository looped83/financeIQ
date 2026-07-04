import { fmt } from '../../domain/format';
import type { Analysis } from '../../domain/types';

export interface MerchantRow {
  name: string;
  count: number;
  avg: string;
  total: string;
}

/** Top card-payment merchants by total spend. Used by both Übersicht and Kategorien. */
export function getTopMerchants(a: Analysis, limit = 10): MerchantRow[] {
  return Object.entries(a.merchants)
    .sort((x, y) => y[1].total - x[1].total)
    .slice(0, limit)
    .map(([name, v]) => ({ name, count: v.count, avg: fmt(v.total / v.count), total: fmt(v.total) }));
}
