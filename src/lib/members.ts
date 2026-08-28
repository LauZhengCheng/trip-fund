import { supabase } from './supabase'

/** owner=3, admin=2, member=1, not a member=0 — mirrors role_level() in the database. */
export async function getMyRoleLevel(tripId: string): Promise<number> {
  const { data, error } = await supabase.rpc('role_level', { p_trip_id: tripId })
  if (error) throw error
  return (data as number) ?? 0
}

export type Member = {
  id: string
  user_id: string
  display_name: string
  role: string
}

export async function listMembers(tripId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('id, user_id, display_name, role')
    .eq('trip_id', tripId)
  if (error) throw error
  return data
}

export async function updateMemberRole(memberId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await supabase.from('members').update({ role }).eq('id', memberId)
  if (error) throw error
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('members').delete().eq('id', memberId)
  if (error) throw error
}

export function subscribeToMemberChanges(tripId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`members-trip-${tripId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'members', filter: `trip_id=eq.${tripId}` },
      onChange,
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
