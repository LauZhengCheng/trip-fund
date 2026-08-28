import type { EntryType } from './money'
import { uploadReceipt } from './receipts'
import { supabase } from './supabase'

export type Entry = {
  id: string
  trip_id: string
  wallet_id: string
  type: EntryType
  amount_minor: number
  category: string | null
  note: string | null
  contributor_id: string | null
  contributor_name: string | null
  occurred_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export async function listEntries(walletId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('wallet_id', walletId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createEntry(input: {
  tripId: string
  walletId: string
  type: EntryType
  amountMinor: number
  category: string | null
  note: string | null
  contributorId?: string | null
  contributorName?: string | null
  occurredAt: string
  createdBy: string
  receiptFile?: File | null
}): Promise<string> {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('entries').insert({
    id,
    trip_id: input.tripId,
    wallet_id: input.walletId,
    type: input.type,
    amount_minor: input.amountMinor,
    category: input.category,
    note: input.note,
    contributor_id: input.contributorId ?? null,
    contributor_name: input.contributorName ?? null,
    occurred_at: input.occurredAt,
    created_by: input.createdBy,
  })
  if (error) throw error

  if (input.receiptFile) {
    await uploadReceipt({
      tripId: input.tripId,
      entryId: id,
      uploadedBy: input.createdBy,
      file: input.receiptFile,
    })
  }

  return id
}

export async function listDeletedEntries(walletId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('wallet_id', walletId)
    .not('deleted_at', 'is', null)
    .order('occurred_at', { ascending: false })
  if (error) throw error
  return data
}

export async function updateEntryFields(input: {
  entryId: string
  amountMinor: number
  category: string | null
  note: string | null
  contributorId?: string | null
  contributorName?: string | null
  occurredAt: string
  reason: string | null
}): Promise<Entry> {
  const { data, error } = await supabase.rpc('update_entry_fields', {
    p_entry_id: input.entryId,
    p_amount_minor: input.amountMinor,
    p_category: input.category,
    p_note: input.note,
    p_occurred_at: input.occurredAt,
    p_contributor_id: input.contributorId ?? null,
    p_contributor_name: input.contributorName ?? null,
    p_reason: input.reason,
  })
  if (error) throw error
  return data as Entry
}

export async function softDeleteEntry(entryId: string, reason: string | null): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_entry', { p_entry_id: entryId, p_reason: reason })
  if (error) throw error
}

export async function restoreEntry(entryId: string, reason: string | null): Promise<void> {
  const { error } = await supabase.rpc('restore_entry', { p_entry_id: entryId, p_reason: reason })
  if (error) throw error
}

export async function createTransfer(input: {
  tripId: string
  fromWalletId: string
  toWalletId: string
  fromAmountMinor: number
  toAmountMinor: number
  fromType: EntryType
  toType: EntryType
  fxRate: number | null
  category: string | null
  note: string | null
  occurredAt: string
}): Promise<void> {
  const { error } = await supabase.rpc('create_transfer', {
    p_trip_id: input.tripId,
    p_from_wallet_id: input.fromWalletId,
    p_to_wallet_id: input.toWalletId,
    p_from_amount_minor: input.fromAmountMinor,
    p_to_amount_minor: input.toAmountMinor,
    p_from_type: input.fromType,
    p_to_type: input.toType,
    p_fx_rate: input.fxRate,
    p_category: input.category,
    p_note: input.note,
    p_occurred_at: input.occurredAt,
  })
  if (error) throw error
}

/** Any insert/update on this wallet's entries -> refetch. Returns an unsubscribe function. */
export function subscribeToEntryChanges(walletId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`entries-wallet-${walletId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entries', filter: `wallet_id=eq.${walletId}` },
      onChange,
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Most recent exchange rate used on this trip, to prefill the rate field.
 * Doesn't try to match the exact currency pair -- a trip realistically only
 * ever exchanges between one pair (e.g. MYR <-> IDR), so "last rate used"
 * is a good enough suggestion without a fragile cross-table currency lookup.
 */
export async function getLastFxRate(tripId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('fx_rate')
    .eq('trip_id', tripId)
    .eq('type', 'fx_out')
    .not('fx_rate', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data[0]?.fx_rate ?? null
}
