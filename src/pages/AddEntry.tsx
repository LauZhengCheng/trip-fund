import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { createEntry, createTransfer, getLastFxRate } from '../lib/entries'
import { errorMessage } from '../lib/errors'
import { toMinorUnits, type EntryType } from '../lib/money'
import type { Wallet } from '../lib/wallets'

type Mode = 'expense' | 'contribution' | 'move'

export function AddEntry({
  tripId,
  wallets,
  defaultWalletId,
  onDone,
}: {
  tripId: string
  wallets: Wallet[]
  defaultWalletId: string
  onDone: () => void
}) {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const wallet = wallets.find((w) => w.id === defaultWalletId) ?? wallets[0]

  // "Move money" fields
  const [fromWalletId, setFromWalletId] = useState(defaultWalletId)
  const [toWalletId, setToWalletId] = useState('')
  const [rate, setRate] = useState('')
  const fromWallet = wallets.find((w) => w.id === fromWalletId) ?? wallet
  const toWallet = wallets.find((w) => w.id === toWalletId)
  const isExchange = !!toWallet && toWallet.currency !== fromWallet.currency

  useEffect(() => {
    if (mode !== 'move') return
    const firstOther = wallets.find((w) => w.id !== fromWalletId)
    setToWalletId(firstOther?.id ?? '')
  }, [mode, fromWalletId, wallets])

  useEffect(() => {
    if (!isExchange) return
    getLastFxRate(tripId)
      .then((lastRate) => {
        if (lastRate) setRate(String(lastRate))
      })
      .catch(() => {})
    // only want to suggest a rate the first time this pair becomes an exchange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExchange, tripId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'move') {
        if (!toWallet) throw new Error('Pick a wallet to move money into')
        const fromAmountMinor = toMinorUnits(Number(amount), fromWallet.exponent)
        const rateValue = isExchange ? Number(rate) : 1
        const toAmountMinor = isExchange
          ? Math.round((fromAmountMinor / 10 ** fromWallet.exponent) * rateValue * 10 ** toWallet.exponent)
          : toMinorUnits(Number(amount), toWallet.exponent)

        await createTransfer({
          tripId,
          fromWalletId: fromWallet.id,
          toWalletId: toWallet.id,
          fromAmountMinor,
          toAmountMinor,
          fromType: isExchange ? 'fx_out' : 'transfer_out',
          toType: isExchange ? 'fx_in' : 'transfer_in',
          fxRate: isExchange ? rateValue : null,
          category: category.trim() || null,
          note: note.trim() || null,
          occurredAt: new Date().toISOString(),
        })
      } else {
        await createEntry({
          tripId,
          walletId: wallet.id,
          type: mode as EntryType,
          amountMinor: toMinorUnits(Number(amount), wallet.exponent),
          category: category.trim() || null,
          note: note.trim() || null,
          occurredAt: new Date().toISOString(),
          createdBy: user.id,
        })
      }
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
        <h2 className="text-lg font-semibold">Add entry</h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('expense')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === 'expense' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setMode('contribution')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === 'contribution' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            Contribution
          </button>
          {wallets.length >= 2 && (
            <button
              type="button"
              onClick={() => setMode('move')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                mode === 'move' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              Move
            </button>
          )}
        </div>

        {mode === 'move' ? (
          <>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-neutral-500">From</label>
                <select
                  value={fromWalletId}
                  onChange={(e) => setFromWalletId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-neutral-500">To</label>
                <select
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                >
                  {wallets
                    .filter((w) => w.id !== fromWalletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                Amount sent ({fromWallet.currency})
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

            {isExchange && toWallet && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">
                    Exchange rate (1 {fromWallet.currency} = ? {toWallet.currency})
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </div>
                {amount && rate && (
                  <p className="text-xs text-neutral-400">
                    ≈ {toWallet.currency}{' '}
                    {(Number(amount) * Number(rate)).toLocaleString('en-US', {
                      maximumFractionDigits: toWallet.exponent,
                    })}{' '}
                    received
                  </p>
                )}
              </>
            )}
          </>
        ) : (
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
        )}

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
