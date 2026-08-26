import { supabase } from './supabase'
import type { Trip } from './trips'

export async function createInviteLink(tripId: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('trip_invites')
    .insert({ trip_id: tripId, created_by: userId })
    .select('id')
    .single()
  if (error) throw error
  return `${window.location.origin}?invite=${data.id}`
}

export async function acceptInvite(inviteId: string): Promise<Trip> {
  const { data, error } = await supabase.rpc('accept_invite', { p_invite_id: inviteId })
  if (error) throw error
  const trip = Array.isArray(data) ? data[0] : data
  if (!trip) throw new Error('This invite link is invalid or has been revoked.')
  return trip as Trip
}
