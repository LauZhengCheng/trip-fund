import { supabase } from './supabase'

export type Receipt = {
  id: string
  entry_id: string
  trip_id: string
  storage_path: string
  uploaded_by: string
  created_at: string
  url: string | null
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour -- plenty for one viewing session

export async function listReceipts(entryId: string): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('id, entry_id, trip_id, storage_path, uploaded_by, created_at')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const withUrls = await Promise.all(
    data.map(async (receipt) => {
      const { data: signed } = await supabase.storage
        .from('receipts')
        .createSignedUrl(receipt.storage_path, SIGNED_URL_TTL_SECONDS)
      return { ...receipt, url: signed?.signedUrl ?? null }
    }),
  )
  return withUrls
}

export async function uploadReceipt(input: {
  tripId: string
  entryId: string
  uploadedBy: string
  file: File
}): Promise<void> {
  const path = `${input.tripId}/${input.entryId}/${crypto.randomUUID()}-${input.file.name}`

  const { error: uploadError } = await supabase.storage.from('receipts').upload(path, input.file)
  if (uploadError) throw uploadError

  const { error: insertError } = await supabase.from('receipts').insert({
    entry_id: input.entryId,
    trip_id: input.tripId,
    storage_path: path,
    uploaded_by: input.uploadedBy,
  })
  if (insertError) throw insertError
}

export async function deleteReceipt(receiptId: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from('receipts').remove([storagePath])
  if (storageError) throw storageError

  const { error } = await supabase.from('receipts').delete().eq('id', receiptId)
  if (error) throw error
}
