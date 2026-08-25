export type EntryType =
  | 'contribution'
  | 'expense'
  | 'fx_out'
  | 'fx_in'
  | 'transfer_out'
  | 'transfer_in'
  | 'reimbursement'
  | 'refund'
  | 'settlement'

// Single source of truth for which entry types add to a wallet vs subtract from it.
// amount_minor is always stored as a positive magnitude; the type decides the sign.
const POSITIVE_TYPES = new Set<EntryType>(['contribution', 'fx_in', 'transfer_in', 'refund'])

export function isPositiveType(type: EntryType): boolean {
  return POSITIVE_TYPES.has(type)
}

export function signedMinorUnits(type: EntryType, amountMinor: number): number {
  return isPositiveType(type) ? amountMinor : -amountMinor
}

/** Human-entered amount (e.g. 12.50, or 185000 for a zero-exponent currency) -> integer minor units. */
export function toMinorUnits(amount: number, exponent: number): number {
  return Math.round(Math.abs(amount) * 10 ** exponent)
}

/** Integer minor units -> human-readable string with thousands separators and the currency's decimal places. */
export function formatMinorUnits(minor: number, exponent: number): string {
  const value = minor / 10 ** exponent
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(value)
}

export function computeBalance(
  entries: { type: EntryType; amount_minor: number; deleted_at?: string | null }[],
): number {
  return entries
    .filter((entry) => !entry.deleted_at)
    .reduce((sum, entry) => sum + signedMinorUnits(entry.type, entry.amount_minor), 0)
}
