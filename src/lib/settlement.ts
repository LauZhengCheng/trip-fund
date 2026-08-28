import type { Entry } from './entries'
import type { Member } from './members'
import { supabase } from './supabase'

export type SettlementRow = {
  name: string
  memberId: string | null
  contributedMinor: number
  shareMinor: number
  refundMinor: number
}

/**
 * Per-wallet settlement: everyone splits that wallet's total expenses equally,
 * regardless of how much each person put in. Deliberately not merged across
 * wallets/currencies -- wallets already track balances separately, and mixing
 * currencies here would need a conversion rate with no single correct answer.
 */
export function computeSettlement(entries: Entry[], members: Member[]): SettlementRow[] {
  const live = entries.filter((e) => !e.deleted_at)
  const totalExpenseMinor = live
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount_minor, 0)
  const contributions = live.filter((e) => e.type === 'contribution')

  const participants = new Map<string, { name: string; memberId: string | null }>()
  for (const m of members) {
    participants.set(`member:${m.id}`, { name: m.display_name, memberId: m.id })
  }
  for (const c of contributions) {
    if (c.contributor_id || !c.contributor_name) continue
    const key = `name:${c.contributor_name}`
    if (!participants.has(key)) {
      participants.set(key, { name: c.contributor_name, memberId: null })
    }
  }

  const list = [...participants.values()]
  const shareMinor = list.length > 0 ? Math.round(totalExpenseMinor / list.length) : 0

  return list.map((p) => {
    const contributedMinor = contributions
      .filter((c) => (p.memberId ? c.contributor_id === p.memberId : c.contributor_name === p.name))
      .reduce((sum, c) => sum + c.amount_minor, 0)
    return {
      name: p.name,
      memberId: p.memberId,
      contributedMinor,
      shareMinor,
      refundMinor: contributedMinor - shareMinor,
    }
  })
}

export type Settlement = {
  id: string
  trip_id: string
  wallet_id: string
  created_by: string
  created_at: string
  snapshot: SettlementRow[]
}

export async function saveSettlement(
  tripId: string,
  walletId: string,
  createdBy: string,
  rows: SettlementRow[],
): Promise<void> {
  const { error } = await supabase
    .from('settlements')
    .insert({ trip_id: tripId, wallet_id: walletId, created_by: createdBy, snapshot: rows })
  if (error) throw error
}

export async function listSettlements(walletId: string): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function deleteSettlement(settlementId: string): Promise<void> {
  const { error } = await supabase.from('settlements').delete().eq('id', settlementId)
  if (error) throw error
}
