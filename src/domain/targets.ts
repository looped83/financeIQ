/** Target values every page judges against (✓ / ⚠, goal lines, hint thresholds). */
export const TARGETS = {
  /** Net as a share of income, in %. */
  savingsRate: 20,
  /** Net invested (buys − sells) as a share of income, in %. */
  investRate: 15,
  /** Dividends as a share of income, in %. */
  passiveRate: 5,
  /** Trading fees as a share of buys, in %. */
  feeRate: 0.5,
  /** Card payments as a share of spending, in % — above this counts as card-heavy. */
  cardShare: 50,
} as const;
