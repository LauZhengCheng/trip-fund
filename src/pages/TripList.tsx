import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'
import { createTrip, listMyTrips, type Trip } from '../lib/trips'

export function TripList({ onSelect }: { onSelect: (trip: Trip) => void }) {
  const { user, signOut } = useAuth()
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listMyTrips().then(setTrips)
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return
    setCreating(true)
    setError('')
    try {
      const trip = await createTrip(name.trim(), user.id)
      setName('')
      onSelect(trip)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-5 py-8">
      <div className="mx-auto max-w-sm">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-bold">Your Trips</h1>
          <button onClick={() => signOut()} className="text-xs text-neutral-400 underline">
            Sign out
          </button>
        </div>

        {trips === null && <p className="text-sm text-neutral-400">Loading…</p>}
        {trips?.length === 0 && (
          <p className="mb-6 text-sm text-neutral-500">No trips yet — create your first one below.</p>
        )}

        <div className="mb-6 flex flex-col gap-2">
          {trips?.map((trip) => (
            <button
              key={trip.id}
              onClick={() => onSelect(trip)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left font-medium"
            >
              {trip.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            placeholder="New trip name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? '…' : '+ New'}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
