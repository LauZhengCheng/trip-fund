import { supabase } from './supabase'
import type { EntryType } from './money'

export type Entry = {
  id: string
  trip_id: string
  wallet_id: string
  type: EntryType
  amount_minor: number
  category: string | null
  note: string | null
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
  occurredAt: string
  createdBy: string
}) {
  const { error } = await supabase.from('entries').insert({
    id: crypto.randomUUID(),
    trip_id: input.tripId,
    wallet_id: input.walletId,
    type: input.type,
    amount_minor: input.amountMinor,
    category: input.category,
    note: input.note,
    occurred_at: input.occurredAt,
    created_by: input.createdBy,
  })
  if (error) throw error
}
