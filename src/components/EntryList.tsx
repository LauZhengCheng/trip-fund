import type { Entry } from '../lib/entries'
import { formatMinorUnits, isPositiveType } from '../lib/money'

const CURRENCY_SYMBOLS: Record<string, string> = { MYR: 'RM', IDR: 'Rp' }

function relativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

export function EntryList({
  entries,
  walletLabel,
  currency,
  exponent,
  onSelect,
}: {
  entries: Entry[]
  walletLabel: string
  currency: string
  exponent: number
  onSelect?: (entry: Entry) => void
}) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-400">No entries yet.</p>
  }

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => {
        const positive = isPositiveType(entry.type)
        const edited = entry.updated_at !== entry.created_at
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect?.(entry)}
            className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {entry.note || entry.category || entry.type}
                </p>
                {edited && (
                  <span className="shrink-0 rounded-full border border-neutral-400 px-1.5 text-[10px] font-bold text-neutral-500">
                    Edited
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-neutral-400">
                {walletLabel} · {relativeTime(entry.occurred_at)}
              </p>
            </div>
            <p
              className={`shrink-0 whitespace-nowrap font-mono text-sm font-semibold tabular-nums ${
                positive ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {positive ? '+' : '−'}
              {symbol} {formatMinorUnits(entry.amount_minor, exponent)}
            </p>
          </button>
        )
      })}
    </div>
  )
}
