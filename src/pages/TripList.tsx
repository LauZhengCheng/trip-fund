import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'
import { createTrip, deleteTrip, listMyTrips, setTripPinned, type Trip } from '../lib/trips'

const OWNER_ROLE = 'owner'
const LONG_PRESS_MS = 500

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M14.5 2.5a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4l-1.1 1.1a1 1 0 0 1-1.4 0l-.3-.3-3 3 .6 3.6a1 1 0 0 1-.3.9l-1 1a1 1 0 0 1-1.4 0l-3.6-3.6-4.8 4.8a1 1 0 0 1-1.4-1.4l4.8-4.8-3.6-3.6a1 1 0 0 1 0-1.4l1-1a1 1 0 0 1 .9-.3l3.6.6 3-3-.3-.3a1 1 0 0 1 0-1.4z" />
    </svg>
  )
}

function TripCard({
  trip,
  onSelect,
  onOpenMenu,
}: {
  trip: Trip
  onSelect: (trip: Trip) => void
  onOpenMenu: (trip: Trip) => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressedRef = useRef(false)

  function start() {
    longPressedRef.current = false
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true
      onOpenMenu(trip)
    }, LONG_PRESS_MS)
  }
  function cancel() {
    if (timerRef.current) clearTimeout(timerRef.current)
  }
  function handleClick() {
    if (longPressedRef.current) {
      longPressedRef.current = false
      return
    }
    onSelect(trip)
  }

  return (
    <button
      onClick={handleClick}
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchMove={cancel}
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onContextMenu={(e) => {
        e.preventDefault()
        onOpenMenu(trip)
      }}
      className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left font-medium select-none"
    >
      {trip.pinnedAt && <PinIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />}
      <span className="truncate">{trip.name}</span>
    </button>
  )
}

function TripMenu({
  trip,
  onClose,
  onChanged,
}: {
  trip: Trip
  onClose: () => void
  onChanged: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleTogglePin() {
    setBusy(true)
    setError('')
    try {
      await setTripPinned(trip.id, !trip.pinnedAt)
      onChanged()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setError('')
    try {
      await deleteTrip(trip.id)
      onChanged()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-1 rounded-2xl bg-white p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {!confirmingDelete ? (
          <>
            <p className="px-3 py-2 text-sm font-semibold text-neutral-900">{trip.name}</p>
            <button
              onClick={handleTogglePin}
              disabled={busy}
              className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-neutral-700 disabled:opacity-50"
            >
              {trip.pinnedAt ? 'Unpin' : 'Pin to top'}
            </button>
            {trip.myRole === OWNER_ROLE && (
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-red-600 disabled:opacity-50"
              >
                Delete trip
              </button>
            )}
            <button onClick={onClose} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-neutral-400">
              Cancel
            </button>
          </>
        ) : (
          <div className="p-3">
            <p className="mb-1 text-sm font-semibold text-neutral-900">Delete "{trip.name}"?</p>
            <p className="mb-3 text-xs text-neutral-500">
              This permanently deletes every wallet, entry, receipt and comment in this trip for
              everyone. This can't be undone. Type the trip name to confirm.
            </p>
            <input
              type="text"
              autoFocus
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={trip.name}
              className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-lg bg-neutral-100 py-2 text-sm font-medium text-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={busy || typedName !== trip.name}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}
        {error && <p className="px-3 pb-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}

export function TripList({
  onSelect,
  bannerError,
}: {
  onSelect: (trip: Trip) => void
  bannerError?: string
}) {
  const { user, signOut } = useAuth()
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [menuTrip, setMenuTrip] = useState<Trip | null>(null)

  function reload() {
    if (user) listMyTrips(user.id).then(setTrips)
  }

  useEffect(reload, [user])

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
          <div className="flex items-center gap-3">
            <Avatar />
            <button onClick={() => signOut()} className="text-xs text-neutral-400 underline">
              Sign out
            </button>
          </div>
        </div>

        {bannerError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{bannerError}</p>
        )}

        {trips === null && <p className="text-sm text-neutral-400">Loading…</p>}
        {trips?.length === 0 && (
          <p className="mb-6 text-sm text-neutral-500">No trips yet — create your first one below.</p>
        )}

        {trips && trips.length > 0 && (
          <p className="mb-2 text-xs text-neutral-400">Press and hold a trip for more options.</p>
        )}

        <div className="mb-6 flex flex-col gap-2">
          {trips?.map((trip) => (
            <TripCard key={trip.id} trip={trip} onSelect={onSelect} onOpenMenu={setMenuTrip} />
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

      {menuTrip && <TripMenu trip={menuTrip} onClose={() => setMenuTrip(null)} onChanged={reload} />}
    </div>
  )
}
