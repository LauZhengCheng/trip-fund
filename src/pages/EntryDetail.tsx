import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { createComment, deleteComment, listComments, subscribeToComments, type Comment } from '../lib/comments'
import {
  restoreEntry,
  softDeleteEntry,
  updateEntryFields,
  type Entry,
} from '../lib/entries'
import { errorMessage } from '../lib/errors'
import { listEntryHistory, type EntryHistoryRow } from '../lib/history'
import { listMembers, type Member } from '../lib/members'
import { formatMinorUnits, isPositiveType, toMinorUnits } from '../lib/money'
import type { Wallet } from '../lib/wallets'

const CURRENCY_SYMBOLS: Record<string, string> = { MYR: 'RM', IDR: 'Rp' }

function amountText(amountMinor: number, entry: Entry, wallet: Wallet) {
  const symbol = CURRENCY_SYMBOLS[wallet.currency] ?? wallet.currency
  return `${isPositiveType(entry.type) ? '+' : '−'}${symbol} ${formatMinorUnits(amountMinor, wallet.exponent)}`
}

function describeChanges(before: Record<string, unknown>, after: Record<string, unknown>, wallet: Wallet): string[] {
  const lines: string[] = []
  if (before.amount_minor !== after.amount_minor) {
    const symbol = CURRENCY_SYMBOLS[wallet.currency] ?? wallet.currency
    lines.push(
      `Amount: ${symbol} ${formatMinorUnits(before.amount_minor as number, wallet.exponent)} → ${symbol} ${formatMinorUnits(after.amount_minor as number, wallet.exponent)}`,
    )
  }
  if (before.category !== after.category) {
    lines.push(`Category: ${(before.category as string) || '—'} → ${(after.category as string) || '—'}`)
  }
  if (before.note !== after.note) {
    lines.push(`Note: ${(before.note as string) || '—'} → ${(after.note as string) || '—'}`)
  }
  if (before.occurred_at !== after.occurred_at) {
    lines.push(
      `Date: ${new Date(before.occurred_at as string).toLocaleString()} → ${new Date(after.occurred_at as string).toLocaleString()}`,
    )
  }
  return lines
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-neutral-400">{label}</span>
      <span className="text-right font-medium text-neutral-900">{value}</span>
    </div>
  )
}

export function EntryDetail({
  entry,
  wallet,
  isAdmin,
  onClose,
  onChanged,
}: {
  entry: Entry
  wallet: Wallet
  isAdmin: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [history, setHistory] = useState<EntryHistoryRow[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit' | 'delete' | 'restore'>('view')
  const [error, setError] = useState('')

  function reloadHistory() {
    listEntryHistory(entry.id).then(setHistory).catch((err) => setError(errorMessage(err)))
  }

  useEffect(reloadHistory, [entry.id])

  useEffect(() => {
    listMembers(entry.trip_id).then(setMembers).catch(() => {})
  }, [entry.trip_id])

  function reloadComments() {
    listComments(entry.id).then(setComments).catch((err) => setError(errorMessage(err)))
  }

  useEffect(reloadComments, [entry.id])

  useEffect(() => subscribeToComments(entry.id, reloadComments), [entry.id])

  async function handlePostComment(e: FormEvent) {
    e.preventDefault()
    if (!user || !commentBody.trim()) return
    setPostingComment(true)
    try {
      await createComment({
        entryId: entry.id,
        tripId: entry.trip_id,
        authorId: user.id,
        body: commentBody.trim(),
      })
      setCommentBody('')
      reloadComments()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPostingComment(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deleteComment(commentId)
      reloadComments()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function nameFor(userId: string) {
    return members.find((m) => m.user_id === userId)?.display_name ?? 'Someone'
  }

  if (mode === 'edit') {
    return (
      <EditEntryForm
        entry={entry}
        wallet={wallet}
        onCancel={() => setMode('view')}
        onSaved={() => {
          setMode('view')
          reloadHistory()
          onChanged()
        }}
      />
    )
  }

  async function handleConfirm(reason: string) {
    try {
      if (mode === 'delete') await softDeleteEntry(entry.id, reason || null)
      else if (mode === 'restore') await restoreEntry(entry.id, reason || null)
      onChanged()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
      <div className="mx-auto max-w-sm space-y-4 rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{entry.note || entry.category || entry.type}</h2>
          <button onClick={onClose} className="shrink-0 text-sm text-neutral-400">
            Close
          </button>
        </div>

        <div className="space-y-1.5 rounded-xl bg-neutral-50 p-3">
          <Row label="Amount" value={amountText(entry.amount_minor, entry, wallet)} />
          <Row label="Type" value={entry.type} />
          <Row label="Category" value={entry.category || '—'} />
          <Row label="Date" value={new Date(entry.occurred_at).toLocaleString()} />
          <Row label="Wallet" value={wallet.label} />
          {entry.deleted_at && <Row label="Status" value="Deleted (in recycle bin)" />}
        </div>

        {isAdmin && !entry.deleted_at && mode === 'view' && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode('edit')}
              className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white"
            >
              Edit
            </button>
            <button
              onClick={() => setMode('delete')}
              className="flex-1 rounded-lg bg-red-50 py-2 text-sm font-medium text-red-600"
            >
              Delete
            </button>
          </div>
        )}

        {isAdmin && entry.deleted_at && mode === 'view' && (
          <button
            onClick={() => setMode('restore')}
            className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white"
          >
            Restore
          </button>
        )}

        {(mode === 'delete' || mode === 'restore') && (
          <ReasonPrompt
            title={mode === 'delete' ? 'Delete this entry?' : 'Restore this entry?'}
            confirmLabel={mode === 'delete' ? 'Delete' : 'Restore'}
            onCancel={() => setMode('view')}
            onConfirm={handleConfirm}
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-neutral-400">HISTORY</p>
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className="border-l-2 border-neutral-200 pl-3">
                <p className="text-xs text-neutral-400">
                  {nameFor(h.changed_by)} · {new Date(h.changed_at).toLocaleString()}
                </p>
                {h.action === 'insert' && <p className="text-sm text-neutral-700">Created</p>}
                {h.action === 'delete' && <p className="text-sm text-neutral-700">Deleted</p>}
                {h.action === 'restore' && <p className="text-sm text-neutral-700">Restored</p>}
                {h.action === 'update' &&
                  h.before &&
                  h.after &&
                  describeChanges(h.before, h.after, wallet).map((line, i) => (
                    <p key={i} className="text-sm text-neutral-700">
                      {line}
                    </p>
                  ))}
                {h.reason && <p className="mt-0.5 text-sm italic text-neutral-500">"{h.reason}"</p>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-neutral-400">COMMENTS</p>
          <div className="space-y-2">
            {comments.length === 0 && <p className="text-sm text-neutral-400">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-neutral-50 p-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-neutral-700">{c.body}</p>
                  {(c.author_id === user?.id || isAdmin) && (
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="shrink-0 text-xs text-neutral-400 underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {nameFor(c.author_id)} · {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={handlePostComment} className="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="Ask a question…"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={postingComment || !commentBody.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Post
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function ReasonPrompt({
  title,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 p-3">
      <p className="text-sm font-medium">{title}</p>
      <input
        type="text"
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg bg-neutral-100 py-2 text-sm font-medium text-neutral-600"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setSubmitting(true)
            onConfirm(reason)
          }}
          className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

function EditEntryForm({
  entry,
  wallet,
  onCancel,
  onSaved,
}: {
  entry: Entry
  wallet: Wallet
  onCancel: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(String(entry.amount_minor / 10 ** wallet.exponent))
  const [category, setCategory] = useState(entry.category ?? '')
  const [note, setNote] = useState(entry.note ?? '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await updateEntryFields({
        entryId: entry.id,
        amountMinor: toMinorUnits(Number(amount), wallet.exponent),
        category: category.trim() || null,
        note: note.trim() || null,
        occurredAt: entry.occurred_at,
        reason: reason.trim() || null,
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold">Edit entry</h2>

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
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Reason for this change <span className="font-normal text-neutral-400">(optional, but recommended)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. typed the wrong amount"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
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
