import { supabase } from './supabase'

export type Wallet = {
  id: string
  trip_id: string
  label: string
  currency: string
  exponent: number
  is_default: boolean
}

export async function listWallets(tripId: string): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('id, trip_id, label, currency, exponent, is_default')
    .eq('trip_id', tripId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createWallet(
  tripId: string,
  label: string,
  currency: string,
  exponent: number,
  isDefault: boolean,
) {
  const { error } = await supabase.from('wallets').insert({
    trip_id: tripId,
    label,
    currency: currency.toUpperCase(),
    exponent,
    is_default: isDefault,
  })
  if (error) throw error
}
