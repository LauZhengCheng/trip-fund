import { supabase } from './supabase'

export type EntryHistoryRow = {
  id: string
  entry_id: string
  action: 'insert' | 'update' | 'delete' | 'restore'
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  changed_by: string
  changed_at: string
}

export async function listEntryHistory(entryId: string): Promise<EntryHistoryRow[]> {
  const { data, error } = await supabase
    .from('entry_history')
    .select('*')
    .eq('entry_id', entryId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data
}
