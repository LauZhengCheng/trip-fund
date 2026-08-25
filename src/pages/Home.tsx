import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { EntryList } from '../components/EntryList'
import { listEntries, type Entry } from '../lib/entries'
import { errorMessage } from '../lib/errors'
import { formatMinorUnits, computeBalance } from '../lib/money'
import type { Trip } from '../lib/trips'
import { createWallet, listWallets, type Wallet } from '../lib/wallets'
import { AddEntry } from './AddEntry'

const CURRENCY_SYMBOLS: Record<string, string> = { MYR: 'RM', IDR: 'Rp' }

export function Home({ trip, onBack }: { trip: Trip; onBack: () => void }) {
  const [wallets, setWallets] = useState<Wallet[] | null>(null)
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [showAddEntry, setShowAddEntry] = useState(false)

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

  const activeWallet = wallets?.find((w) => w.id === activeWalletId) ?? null
  const balance = computeBalance(entries)

  return (
    <div className="min-h-screen bg-neutral-50 pb-28">
      <div className="flex items-center justify-between px-5 pt-6 pb-2">
        <button onClick={onBack} className="text-sm text-neutral-500">
          ‹ Trips
        </button>
        <h1 className="text-lg font-bold">{trip.name}</h1>
        <div className="w-12" />
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
          <p className="mb-3 text-sm text-neutral-500">No wallets yet. Add your first one to start recording.</p>
          <button
            onClick={() => setShowAddWallet(true)}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            + Add wallet
          </button>
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
          />
        </div>
      )}

      {activeWallet && (
        <button
          onClick={() => setShowAddEntry(true)}
          className="fixed right-5 bottom-6 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-2xl text-white shadow-lg"
        >
          +
        </button>
      )}

      {wallets && wallets.length > 0 && (
        <button
          onClick={() => setShowAddWallet(true)}
          className="fixed left-5 bottom-8 text-xs text-neutral-400 underline"
        >
          + wallet
        </button>
      )}

      {showAddWallet && (
        <AddWallet
          tripId={trip.id}
          onDone={() => {
            setShowAddWallet(false)
            reloadWallets()
          }}
        />
      )}

      {showAddEntry && activeWallet && (
        <AddEntry
          tripId={trip.id}
          wallet={activeWallet}
          onDone={() => {
            setShowAddEntry(false)
            reloadEntries()
          }}
        />
      )}
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
