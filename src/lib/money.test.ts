import { describe, expect, it } from 'vitest'
import { computeBalance, formatMinorUnits, signedMinorUnits, toMinorUnits } from './money'

describe('toMinorUnits', () => {
  it('converts a MYR amount (2 decimal places)', () => {
    expect(toMinorUnits(12.5, 2)).toBe(1250)
  })

  it('converts an IDR amount (0 decimal places)', () => {
    expect(toMinorUnits(185000, 0)).toBe(185000)
  })

  it('rounds away floating point noise', () => {
    expect(toMinorUnits(19.99, 2)).toBe(1999)
  })

  it('never returns a negative value, even if given one', () => {
    expect(toMinorUnits(-50, 2)).toBe(5000)
  })
})

describe('formatMinorUnits', () => {
  it('formats MYR with 2 decimals and thousands separators', () => {
    expect(formatMinorUnits(150000, 2)).toBe('1,500.00')
  })

  it('formats IDR with no decimals and thousands separators', () => {
    expect(formatMinorUnits(6570000, 0)).toBe('6,570,000')
  })
})

describe('signedMinorUnits', () => {
  it('makes an expense negative', () => {
    expect(signedMinorUnits('expense', 185000)).toBe(-185000)
  })

  it('keeps a contribution positive', () => {
    expect(signedMinorUnits('contribution', 50000)).toBe(50000)
  })

  it('keeps the incoming leg of an exchange positive and the outgoing leg negative', () => {
    expect(signedMinorUnits('fx_in', 6800000)).toBe(6800000)
    expect(signedMinorUnits('fx_out', 200000)).toBe(-200000)
  })
})

describe('computeBalance', () => {
  it('matches the IDR Cash walkthrough: +6,800,000 exchanged in, then two expenses', () => {
    const entries = [
      { type: 'fx_in' as const, amount_minor: 6_800_000 },
      { type: 'expense' as const, amount_minor: 185_000 },
      { type: 'expense' as const, amount_minor: 45_000 },
    ]
    expect(computeBalance(entries)).toBe(6_570_000)
  })

  it('ignores soft-deleted entries', () => {
    const entries = [
      { type: 'contribution' as const, amount_minor: 1000, deleted_at: null },
      { type: 'expense' as const, amount_minor: 500, deleted_at: '2026-01-01T00:00:00Z' },
    ]
    expect(computeBalance(entries)).toBe(1000)
  })
})
