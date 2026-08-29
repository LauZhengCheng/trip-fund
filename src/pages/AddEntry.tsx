import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { createEntry, createTransfer, getLastFxRate } from '../lib/entries'
import { errorMessage } from '../lib/errors'
import type { Member } from '../lib/members'
import { toMinorUnits, type EntryType } from '../lib/money'
import { queueEntry } from '../lib/offline'
import type { Wallet } from '../lib/wallets'

type Mode = 'expense' | 'contribution' | 'move'
const OTHER_CONTRIBUTOR = '__other__'

export function AddEntry({
  tripId,
  wallets,
  members,
  defaultWalletId,
  onDone,
}: {
  tripId: string
  wallets: Wallet[]
  members: Member[]
  defaultWalletId: string
  onDone: () => void
}) {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  const wallet = wallets.find((w) => w.id === defaultWalletId) ?? wallets[0]

  // Contribution: who gave the money
  const [contributorChoice, setContributorChoice] = useState('')
  const [contributorName, setContributorName] = useState('')

  useEffect(() => {
    const goOnline = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // "Move money" fields
  const [fromWalletId, setFromWalletId] = useState(defaultWalletId)
  const [toWalletId, setToWalletId] = useState('')
  const [rate, setRate] = useState('')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [enterByReceived, setEnterByReceived] = useState(false)
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
        if (isOffline) throw new Error('Moving money between wallets needs an internet connection')
        if (!toWallet) throw new Error('Pick a wallet to move money into')
        const fromAmountMinor = toMinorUnits(Number(amount), fromWallet.exponent)

        let toAmountMinor: number
        let rateValue: number | null
        if (!isExchange) {
          toAmountMinor = toMinorUnits(Number(amount), toWallet.exponent)
          rateValue = null
        } else if (enterByReceived) {
          toAmountMinor = toMinorUnits(Number(receivedAmount), toWallet.exponent)
          const fromMajor = fromAmountMinor / 10 ** fromWallet.exponent
          const toMajor = toAmountMinor / 10 ** toWallet.exponent
          rateValue = fromMajor > 0 ? toMajor / fromMajor : null
        } else {
          rateValue = Number(rate)
          toAmountMinor = Math.round((fromAmountMinor / 10 ** fromWallet.exponent) * rateValue * 10 ** toWallet.exponent)
        }

        await createTransfer({
          tripId,
          fromWalletId: fromWallet.id,
          toWalletId: toWallet.id,
          fromAmountMinor,
          toAmountMinor,
          fromType: isExchange ? 'fx_out' : 'transfer_out',
          toType: isExchange ? 'fx_in' : 'transfer_in',
          fxRate: rateValue,
          category: null,
          note: note.trim() || null,
          occurredAt: new Date().toISOString(),
        })
      } else if (mode === 'contribution') {
        if (!contributorChoice) throw new Error('Pick who this contribution is from')
        const isOther = contributorChoice === OTHER_CONTRIBUTOR
        if (isOther && !contributorName.trim()) {
          throw new Error("Type the contributor's name")
        }

        const entryInput = {
          tripId,
          walletId: wallet.id,
          type: 'contribution' as EntryType,
          amountMinor: toMinorUnits(Number(amount), wallet.exponent),
          category: null,
          note: note.trim() || null,
          contributorId: isOther ? null : contributorChoice,
          contributorName: isOther ? contributorName.trim() : null,
          occurredAt: new Date().toISOString(),
          createdBy: user.id,
        }
        if (isOffline) {
          await queueEntry(entryInput)
        } else {
          await createEntry({ ...entryInput, receiptFile })
        }
      } else {
        const entryInput = {
          tripId,
          walletId: wallet.id,
          type: mode as EntryType,
          amountMinor: toMinorUnits(Number(amount), wallet.exponent),
          category: category.trim() || null,
          note: note.trim() || null,
          occurredAt: new Date().toISOString(),
          createdBy: user.id,
        }
        if (isOffline) {
          await queueEntry(entryInput)
        } else {
          await createEntry({ ...entryInput, receiptFile })
        }
      }
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
      >
        <h2 className="text-lg font-semibold">Add entry</h2>

        {isOffline && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            You're offline. This will be saved on your phone and uploaded once you're back online.
          </p>
        )}

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
              disabled={isOffline}
              className={`flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-40 ${
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
                <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
                  <button
                    type="button"
                    onClick={() => setEnterByReceived(false)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium ${
                      !enterByReceived ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                    }`}
                  >
                    I know the rate
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnterByReceived(true)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium ${
                      enterByReceived ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                    }`}
                  >
                    I know what I received
                  </button>
                </div>

                {!enterByReceived ? (
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
                    {amount && rate && (
                      <p className="mt-1 text-xs text-neutral-400">
                        ≈ {toWallet.currency}{' '}
                        {(Number(amount) * Number(rate)).toLocaleString('en-US', {
                          maximumFractionDigits: toWallet.exponent,
                        })}{' '}
                        received
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500">
                      Amount received ({toWallet.currency})
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                    />
                    {amount && receivedAmount && Number(amount) > 0 && (
                      <p className="mt-1 text-xs text-neutral-400">
                        Rate: 1 {fromWallet.currency} ≈{' '}
                        {(Number(receivedAmount) / Number(amount)).toLocaleString('en-US', {
                          maximumFractionDigits: 4,
                        })}{' '}
                        {toWallet.currency}
                      </p>
                    )}
                  </div>
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

        {mode === 'contribution' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Contributor</label>
            <select
              required
              value={contributorChoice}
              onChange={(e) => setContributorChoice(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            >
              <option value="" disabled>
                Who gave this money?
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
              <option value={OTHER_CONTRIBUTOR}>Someone not in the app yet…</option>
            </select>
            {contributorChoice === OTHER_CONTRIBUTOR && (
              <input
                type="text"
                required
                placeholder="Their name"
                value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            )}
            {contributorChoice === OTHER_CONTRIBUTOR && (
              <p className="mt-1 text-xs text-neutral-400">
                Once they join the trip, edit this entry to switch it to their real account.
              </p>
            )}
          </div>
        )}

        {mode === 'expense' && (
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
        )}

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

        {mode !== 'move' && !isOffline && (
          <div>
            <p className="mb-1 block text-xs font-medium text-neutral-500">
              Receipt photo <span className="font-normal text-neutral-400">(optional)</span>
            </p>
            <div className="flex items-center gap-2">
              <label className="inline-block cursor-pointer rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-600">
                {receiptFile ? 'Change photo' : '+ Add photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
              {receiptFile && (
                <span className="min-w-0 flex-1 truncate text-xs text-neutral-400">{receiptFile.name}</span>
              )}
            </div>
          </div>
        )}

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
