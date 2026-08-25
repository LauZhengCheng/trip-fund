import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { createEntry } from '../lib/entries'
import { errorMessage } from '../lib/errors'
import { toMinorUnits, type EntryType } from '../lib/money'
import type { Wallet } from '../lib/wallets'

export function AddEntry({
  tripId,
  wallet,
  onDone,
}: {
  tripId: string
  wallet: Wallet
  onDone: () => void
}) {
  const { user } = useAuth()
  const [type, setType] = useState<EntryType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError('')
    try {
      await createEntry({
        tripId,
        walletId: wallet.id,
        type,
        amountMinor: toMinorUnits(Number(amount), wallet.exponent),
        category: category.trim() || null,
        note: note.trim() || null,
        occurredAt: new Date().toISOString(),
        createdBy: user.id,
      })
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
        <h2 className="text-lg font-semibold">Add entry — {wallet.label}</h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              type === 'expense' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('contribution')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              type === 'contribution' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            Contribution
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Amount ({wallet.currency})
          </label>
          <input
            type="number"
            required
            min="0"
            step="any"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Category <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Food, Taxi, Hotel"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Note <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Dinner at the night market"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

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
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
