import { describe, expect, it } from 'vitest'
import type { Entry } from './entries'
import type { Member } from './members'
import { computeSettlement } from './settlement'

function entry(partial: Partial<Entry>): Entry {
  return {
    id: crypto.randomUUID(),
    trip_id: 'trip-1',
    wallet_id: 'wallet-1',
    type: 'expense',
    amount_minor: 0,
    category: null,
    note: null,
    contributor_id: null,
    contributor_name: null,
    occurred_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...partial,
  }
}

function member(id: string, name: string): Member {
  return { id, user_id: `user-${id}`, display_name: name, role: 'member' }
}

describe('computeSettlement', () => {
  it('matches the CLAUDE.md worked example: uneven contribution, even split of spend', () => {
    // 5 people agree RM 1,000 each, but A puts in RM 2,000 (fronting the extra).
    // Pool = RM 6,000, spend = RM 4,500, leftover = RM 1,500.
    // A should get back RM 1,100; everyone else gets back RM 100.
    const members = [
      member('a', 'A'),
      member('b', 'B'),
      member('c', 'C'),
      member('d', 'D'),
      member('e', 'E'),
    ]
    const entries = [
      entry({ type: 'contribution', amount_minor: 200_000, contributor_id: 'a' }),
      entry({ type: 'contribution', amount_minor: 100_000, contributor_id: 'b' }),
      entry({ type: 'contribution', amount_minor: 100_000, contributor_id: 'c' }),
      entry({ type: 'contribution', amount_minor: 100_000, contributor_id: 'd' }),
      entry({ type: 'contribution', amount_minor: 100_000, contributor_id: 'e' }),
      entry({ type: 'expense', amount_minor: 450_000 }),
    ]

    const rows = computeSettlement(entries, members)

    const byId = Object.fromEntries(rows.map((r) => [r.memberId, r]))
    expect(byId.a.refundMinor).toBe(110_000)
    expect(byId.b.refundMinor).toBe(10_000)
    expect(byId.c.refundMinor).toBe(10_000)
    expect(byId.d.refundMinor).toBe(10_000)
    expect(byId.e.refundMinor).toBe(10_000)
  })

  it('degenerates to an even split of the leftover when contributions are equal', () => {
    const members = [member('a', 'A'), member('b', 'B')]
    const entries = [
      entry({ type: 'contribution', amount_minor: 100_000, contributor_id: 'a' }),
      entry({ type: 'contribution', amount_minor: 100_000, contributor_id: 'b' }),
      entry({ type: 'expense', amount_minor: 120_000 }),
    ]

    const rows = computeSettlement(entries, members)

    for (const row of rows) {
      expect(row.refundMinor).toBe(40_000)
    }
  })

  it('counts a not-yet-joined contributor (free-text name) as a participant', () => {
    const members = [member('a', 'A')]
    const entries = [
      entry({ type: 'contribution', amount_minor: 100_000, contributor_id: 'a' }),
      entry({ type: 'contribution', amount_minor: 100_000, contributor_name: 'Guest Bob' }),
      entry({ type: 'expense', amount_minor: 100_000 }),
    ]

    const rows = computeSettlement(entries, members)

    expect(rows).toHaveLength(2)
    const guest = rows.find((r) => r.name === 'Guest Bob')
    expect(guest?.memberId).toBeNull()
    expect(guest?.shareMinor).toBe(50_000)
  })

  it('ignores transfers/exchanges and soft-deleted entries', () => {
    const members = [member('a', 'A'), member('b', 'B')]
    const entries = [
      entry({ type: 'contribution', amount_minor: 100_000, contributor_id: 'a' }),
      entry({ type: 'fx_out', amount_minor: 50_000 }),
      entry({ type: 'fx_in', amount_minor: 3_400_000 }),
      entry({ type: 'expense', amount_minor: 40_000, deleted_at: '2026-01-02T00:00:00Z' }),
      entry({ type: 'expense', amount_minor: 60_000 }),
    ]

    const rows = computeSettlement(entries, members)
    const byId = Object.fromEntries(rows.map((r) => [r.memberId, r]))
    expect(byId.a.shareMinor).toBe(30_000)
    expect(byId.b.shareMinor).toBe(30_000)
  })
})
