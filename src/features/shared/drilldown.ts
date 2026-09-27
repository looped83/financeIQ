import type { AppActions } from '../../state/appStore';
import type { TransactionFilters } from '../../state/appState';

/** Click handler for a drill-down link: shows exactly the bookings behind a figure. */
export function showBookings(actions: AppActions, filters: Partial<TransactionFilters>): () => void {
  return () => actions.setTransactionFilters({ kind: 'all', category: '', search: '', ...filters });
}

/** Folded "Sonstige" buckets have no single payee to show. */
export const isFolded = (entries: [string, number][], i: number) => i >= entries.length - 1 && entries[i]?.[0] === 'Sonstige';
