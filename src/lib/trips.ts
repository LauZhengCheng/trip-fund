import { supabase } from './supabase'

export type Trip = {
  id: string
  name: string
  base_currency: string
  created_at: string
  myRole: string
  pinnedAt: string | null
}

type TripRow = {
  id: string
  name: string
  base_currency: string
  created_at: string
  members: { role: string; pinned_at: string | null }[]
}

/** Pinned trips first (most recently pinned first), then the rest by newest. */
function sortTrips(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) => {
    if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1
    if (a.pinnedAt && b.pinnedAt) return b.pinnedAt.localeCompare(a.pinnedAt)
    return b.created_at.localeCompare(a.created_at)
  })
}

export async function listMyTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('id, name, base_currency, created_at, members!inner(role, pinned_at)')
    .eq('members.user_id', userId)
  if (error) throw error

  const trips = (data as TripRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    base_currency: t.base_currency,
    created_at: t.created_at,
    myRole: t.members[0]?.role ?? 'member',
    pinnedAt: t.members[0]?.pinned_at ?? null,
  }))
  return sortTrips(trips)
}

export async function createTrip(name: string, userId: string): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({ name, base_currency: 'MYR', created_by: userId })
    .select('id, name, base_currency, created_at')
    .single()
  if (error) throw error
  return { ...data, myRole: 'owner', pinnedAt: null }
}

export async function setTripPinned(tripId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_trip_pinned', { p_trip_id: tripId, p_pinned: pinned })
  if (error) throw error
}

export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId)
  if (error) throw error
}
