import type { EntryType } from './money'

const DB_NAME = 'trip-fund-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending-entries'

export type PendingEntry = {
  localId: string
  tripId: string
  walletId: string
  type: EntryType
  amountMinor: number
  category: string | null
  note: string | null
  contributorId: string | null
  contributorName: string | null
  occurredAt: string
  createdBy: string
  queuedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'localId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function addPendingEntry(entry: PendingEntry): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingEntries(): Promise<PendingEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as PendingEntry[])
    request.onerror = () => reject(request.error)
  })
}

export async function removePendingEntry(localId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(localId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
