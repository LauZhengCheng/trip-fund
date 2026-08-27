import { supabase } from './supabase'

export type Comment = {
  id: string
  entry_id: string
  trip_id: string
  author_id: string
  body: string
  created_at: string
}

export async function listComments(entryId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createComment(input: {
  entryId: string
  tripId: string
  authorId: string
  body: string
}): Promise<void> {
  const { error } = await supabase.from('comments').insert({
    entry_id: input.entryId,
    trip_id: input.tripId,
    author_id: input.authorId,
    body: input.body,
  })
  if (error) throw error
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId)
  if (error) throw error
}

export function subscribeToComments(entryId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`comments-entry-${entryId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comments', filter: `entry_id=eq.${entryId}` },
      onChange,
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
