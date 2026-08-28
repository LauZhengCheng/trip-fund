import type { Entry } from './entries'
import type { EntryType } from './money'
import { addPendingEntry, getPendingEntries, removePendingEntry, type PendingEntry } from './offlineQueue'
import { supabase } from './supabase'

export type { PendingEntry } from './offlineQueue'

/** Queues an entry locally when there's no connection. Uses the same UUID scheme as createEntry, so a later flush just upserts it in. */
export async function queueEntry(input: {
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
}): Promise<string> {
  const localId = crypto.randomUUID()
  await addPendingEntry({
    localId,
    tripId: input.tripId,
    walletId: input.walletId,
    type: input.type,
    amountMinor: input.amountMinor,
    category: input.category,
    note: input.note,
    contributorId: input.contributorId ?? null,
    contributorName: input.contributorName ?? null,
    occurredAt: input.occurredAt,
    createdBy: input.createdBy,
    queuedAt: new Date().toISOString(),
  })
  return localId
}

export async function getPendingEntriesForWallet(walletId: string): Promise<PendingEntry[]> {
  const all = await getPendingEntries()
  return all.filter((p) => p.walletId === walletId)
}

/** Total across every wallet, for the "N pending sync" indicator. */
export async function countAllPendingEntries(): Promise<number> {
  return (await getPendingEntries()).length
}

export function pendingEntryToEntry(p: PendingEntry): Entry {
  return {
    id: p.localId,
    trip_id: p.tripId,
    wallet_id: p.walletId,
    type: p.type,
    amount_minor: p.amountMinor,
    category: p.category,
    note: p.note,
    contributor_id: p.contributorId,
    contributor_name: p.contributorName,
    occurred_at: p.occurredAt,
    created_at: p.queuedAt,
    updated_at: p.queuedAt,
    deleted_at: null,
  }
}

/**
 * Uploads everything queued while offline. Stops at the first failure instead
 * of retrying the rest, since a failure this early usually means we're still
 * offline -- the remaining items just get another chance on the next flush.
 * Upsert (not insert) makes replays safe if a previous flush partially landed.
 */
export async function flushPendingEntries(): Promise<number> {
  const pending = await getPendingEntries()
  let synced = 0
  for (const p of pending) {
    const { error } = await supabase.from('entries').upsert({
      id: p.localId,
      trip_id: p.tripId,
      wallet_id: p.walletId,
      type: p.type,
      amount_minor: p.amountMinor,
      category: p.category,
      note: p.note,
      contributor_id: p.contributorId,
      contributor_name: p.contributorName,
      occurred_at: p.occurredAt,
      created_by: p.createdBy,
    })
    if (error) break
    await removePendingEntry(p.localId)
    synced++
  }
  return synced
}
