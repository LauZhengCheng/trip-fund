import { supabase } from './supabase'

/** owner=3, admin=2, member=1, not a member=0 — mirrors role_level() in the database. */
export async function getMyRoleLevel(tripId: string): Promise<number> {
  const { data, error } = await supabase.rpc('role_level', { p_trip_id: tripId })
  if (error) throw error
  return (data as number) ?? 0
}
