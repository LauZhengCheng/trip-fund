import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { EntryList } from '../components/EntryList'
import { useAuth } from '../lib/auth'
import { listDeletedEntries, listEntries, subscribeToEntryChanges, type Entry } from '../lib/entries'
import { errorMessage } from '../lib/errors'
import { createInviteLink } from '../lib/invites'
import { getMyRoleLevel } from '../lib/members'
import { formatMinorUnits, computeBalance } from '../lib/money'
import type { Trip } from '../lib/trips'
import { createWallet, listWallets, subscribeToWalletChanges, type Wallet } from '../lib/wallets'
import { AddEntry } from './AddEntry'
import { EntryDetail } from './EntryDetail'

const CURRENCY_SYMBOLS: Record<string, string> = { MYR: 'RM', IDR: 'Rp' }
const ADMIN_LEVEL = 2

export function Home({ trip, onBack }: { trip: Trip; onBack: () => void }) {
  const [wallets, setWallets] = useState<Wallet[] | null>(null)
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [roleLevel, setRoleLevel] = useState(0)
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showRecycleBin, setShowRecycleBin] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)

  const isAdmin = roleLevel >= ADMIN_LEVEL

  useEffect(() => {
    getMyRoleLevel(trip.id).then(setRoleLevel)
  }, [trip.id])

  const reloadWallets = useCallback(async () => {
    const list = await listWallets(trip.id)
    setWallets(list)
    setActiveWalletId((current) => {
      if (current && list.some((w) => w.id === current)) return current
      return list.find((w) => w.is_default)?.id ?? list[0]?.id ?? null
    })
  }, [trip.id])

  useEffect(() => {
    reloadWallets()
  }, [reloadWallets])

  useEffect(() => subscribeToWalletChanges(trip.id, reloadWallets), [trip.id, reloadWallets])

  const reloadEntries = useCallback(async () => {
    if (!activeWalletId) {
      setEntries([])
      return
    }
    setEntries(await listEntries(activeWalletId))
  }, [activeWalletId])

  useEffect(() => {
    reloadEntries()
  }, [reloadEntries])

  useEffect(() => {
    if (!activeWalletId) return
    return subscribeToEntryChanges(activeWalletId, reloadEntries)
  }, [activeWalletId, reloadEntries])

  const activeWallet = wallets?.find((w) => w.id === activeWalletId) ?? null
  const balance = computeBalance(entries)

  return (
    <div className="min-h-screen bg-neutral-50 pb-28">
      <div className="flex items-center justify-between px-5 pt-6 pb-2">
        <button onClick={onBack} className="text-sm text-neutral-500">
          ‹ Trips
        </button>
        <h1 className="text-lg font-bold">{trip.name}</h1>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button onClick={() => setShowInvite(true)} className="text-sm text-neutral-500">
              Invite
            </button>
          )}
          <Avatar />
        </div>
      </div>

      {wallets && wallets.length > 0 && (
        <div className="mx-5 mb-5 flex gap-1 rounded-xl bg-neutral-200/60 p-1">
          {wallets.map((w) => (
            <button
              key={w.id}
              onClick={() => setActiveWalletId(w.id)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
                w.id === activeWalletId ? 'bg-neutral-900 text-white' : 'text-neutral-600'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

      {activeWallet && (
        <div className="mb-5 px-5">
          <p className="font-mono text-3xl font-semibold tabular-nums">
            {CURRENCY_SYMBOLS[activeWallet.currency] ?? activeWallet.currency}{' '}
            {formatMinorUnits(balance, activeWallet.exponent)}
          </p>
        </div>
      )}

      {wallets?.length === 0 && (
        <div className="px-5">
          <p className="mb-3 text-sm text-neutral-500">
            {isAdmin
              ? 'No wallets yet. Add your first one to start recording.'
              : 'No wallets yet — ask the trip admin to add one.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowAddWallet(true)}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              + Add wallet
            </button>
          )}
        </div>
      )}

      {activeWallet && (
        <div className="px-5">
          <p className="mb-2 text-xs font-bold tracking-wide text-neutral-400">RECENT ACTIVITY</p>
          <EntryList
            entries={entries}
            walletLabel={activeWallet.label}
            currency={activeWallet.currency}
            exponent={activeWallet.exponent}
            onSelect={setSelectedEntry}
          />
        </div>
      )}

      {isAdmin && activeWallet && (
        <button
          onClick={() => setShowAddEntry(true)}
          className="fixed right-5 bottom-6 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-2xl text-white shadow-lg"
        >
          +
        </button>
      )}

      {isAdmin && wallets && wallets.length > 0 && (
        <div className="fixed left-5 bottom-8 flex gap-3 text-xs text-neutral-400 underline">
          <button onClick={() => setShowAddWallet(true)}>+ wallet</button>
          <button onClick={() => setShowRecycleBin(true)}>Recycle bin</button>
        </div>
      )}

      {isAdmin && showAddWallet && (
        <AddWallet
          tripId={trip.id}
          onDone={() => {
            setShowAddWallet(false)
            reloadWallets()
          }}
        />
      )}

      {isAdmin && showAddEntry && activeWallet && wallets && (
        <AddEntry
          tripId={trip.id}
          wallets={wallets}
          defaultWalletId={activeWallet.id}
          onDone={() => {
            setShowAddEntry(false)
            reloadEntries()
          }}
        />
      )}

      {isAdmin && showInvite && <InviteLink tripId={trip.id} onDone={() => setShowInvite(false)} />}

      {isAdmin && showRecycleBin && activeWallet && (
        <RecycleBin
          wallet={activeWallet}
          onClose={() => setShowRecycleBin(false)}
          onSelect={(entry) => {
            setShowRecycleBin(false)
            setSelectedEntry(entry)
          }}
        />
      )}

      {selectedEntry && activeWallet && (
        <EntryDetail
          entry={selectedEntry}
          wallet={activeWallet}
          isAdmin={isAdmin}
          onClose={() => setSelectedEntry(null)}
          onChanged={reloadEntries}
        />
      )}
    </div>
  )
}

function RecycleBin({
  wallet,
  onClose,
  onSelect,
}: {
  wallet: Wallet
  onClose: () => void
  onSelect: (entry: Entry) => void
}) {
  const [deleted, setDeleted] = useState<Entry[] | null>(null)

  useEffect(() => {
    listDeletedEntries(wallet.id).then(setDeleted)
  }, [wallet.id])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
      <div className="mx-auto max-w-sm space-y-4 rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recycle bin — {wallet.label}</h2>
          <button onClick={onClose} className="text-sm text-neutral-400">
            Close
          </button>
        </div>
        {deleted === null && <p className="text-sm text-neutral-400">Loading…</p>}
        {deleted?.length === 0 && <p className="text-sm text-neutral-400">Nothing here.</p>}
        {deleted && deleted.length > 0 && (
          <EntryList
            entries={deleted}
            walletLabel={wallet.label}
            currency={wallet.currency}
            exponent={wallet.exponent}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  )
}

function InviteLink({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const { user } = useAuth()
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    createInviteLink(tripId, user.id)
      .then(setLink)
      .catch((err) => setError(errorMessage(err)))
  }, [tripId, user])

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold">Invite a family member</h2>
        <p className="text-sm text-neutral-500">
          Anyone who opens this link and signs in gets read-only (member) access to this trip.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {link && (
          <div>
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm"
            />
            <button
              onClick={handleCopy}
              className="mt-2 w-full rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        )}

        <button
          onClick={onDone}
          className="w-full rounded-lg bg-neutral-100 py-2 text-sm font-medium text-neutral-600"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function AddWallet({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const [label, setLabel] = useState('')
  const [currency, setCurrency] = useState('MYR')
  const [exponent, setExponent] = useState(2)
  const [isDefault, setIsDefault] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createWallet(tripId, label.trim(), currency.trim(), exponent, isDefault)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold">Add wallet</h2>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Wallet name</label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. IDR Cash"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-500">Currency code</label>
            <input
              type="text"
              required
              placeholder="e.g. MYR"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-neutral-500">Decimal places</label>
            <input
              type="number"
              required
              min="0"
              max="4"
              value={exponent}
              onChange={(e) => setExponent(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>
        <p className="text-xs text-neutral-400">
          Decimal places = how the amount splits into cents. MYR uses 2 (RM 12.50), IDR uses 0
          (Rp 85,000 — no cents).
        </p>

        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Show this wallet by default on the home screen
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-lg bg-neutral-100 py-2 text-sm font-medium text-neutral-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  )
}
