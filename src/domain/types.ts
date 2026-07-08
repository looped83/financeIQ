/** A CSV row after parseCSV(): all values are trimmed strings, keys are normalized headers. */
export type RawRow = Record<string, string>;

// Intersections (not `interface extends`) because RawRow's `string` index
// signature would otherwise force every added field to be a string too.
export type EnrichedRow = RawRow & {
  _amt: number;
  _fee: number;
  _tax: number;
  _date: Date;
  _month: string;
  _year: string;
  _type: string;
  _cat: string;
  _name: string;
  _asset: string;
  _desc: string;
  _isBuy: boolean;
  _isSell: boolean;
  _isDiv: boolean;
  _isInterest: boolean;
  _isCard: boolean;
};

export type OutlierRow = EnrichedRow & {
  _z: number;
};

export interface MonthAgg {
  income: number;
  expense: number;
  invested: number;
  sold: number;
  dividend: number;
  count: number;
  cardCount: number;
  net: number;
  cumBal: number;
  savingsRate: number;
}

export interface YearAgg {
  income: number;
  expense: number;
  invested: number;
  sold: number;
  dividend: number;
  fees: number;
  net: number;
  months: number;
}

export interface ByTypeAgg {
  income: number;
  expense: number;
  count: number;
}

export interface ByAssetAgg {
  total: number;
  count: number;
}

export interface Subscription {
  name: string;
  amt: number;
  months: Set<string>;
}

export interface Analysis {
  enriched: EnrichedRow[];
  cash: EnrichedRow[];
  inc: EnrichedRow[];
  exp: EnrichedRow[];
  buys: EnrichedRow[];
  sells: EnrichedRow[];
  divs: EnrichedRow[];

  totalInc: number;
  totalExp: number;
  totalInv: number;
  totalSold: number;
  totalDiv: number;
  netBal: number;
  totalFee: number;

  months: Record<string, MonthAgg>;
  mKeys: string[];
  years: Record<string, YearAgg>;
  yKeys: string[];

  byType: Record<string, ByTypeAgg>;
  byAsset: Record<string, ByAssetAgg>;
  byAssetClass: Record<string, number>;
  expCat: Record<string, number>;
  merchants: Record<string, { total: number; count: number }>;
  outliers: OutlierRow[];
  subscriptions: Subscription[];

  avgInc: number;
  avgExp: number;
  avgNet: number;
  mean: number;
  std: number;
  mc: number;
}
