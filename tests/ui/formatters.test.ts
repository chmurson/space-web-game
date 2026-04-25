import { describe, expect, it } from 'vitest'
import {
  formatCompactElapsed,
  formatSpeed,
  formatTimeWarpLabel,
} from '@/ui/formatters'

describe('formatCompactElapsed', () => {
  it('shows split day and hour units for long durations', () => {
    expect(formatCompactElapsed(2.5 * 24 * 3600)).toBe('2d12h')
  })

  it('shows split hour and minute units under one day', () => {
    expect(formatCompactElapsed(2.5 * 3600)).toBe('2h30m')
  })

  it('falls back to minutes and seconds for short durations', () => {
    expect(formatCompactElapsed(5 * 60 + 29)).toBe('5m')
    expect(formatCompactElapsed(42)).toBe('42s')
  })
})

describe('formatSpeed', () => {
  it('formats high speeds in km/s', () => {
    expect(formatSpeed(15_000)).toBe('15.00 km/s')
  })

  it('formats speeds at threshold in km/s', () => {
    expect(formatSpeed(10_000)).toBe('10.00 km/s')
  })

  it('formats low speeds in m/s', () => {
    expect(formatSpeed(1_234)).toBe('1.23 km/s')
  })

  it('formats speeds just below threshold in m/s', () => {
    expect(formatSpeed(9_999)).toBe('10.00 km/s')
  })

  it('formats zero speed', () => {
    expect(formatSpeed(0)).toBe('0 m/s')
  })
})

describe('formatTimeWarpLabel', () => {
  it('formats duration-oriented warp labels', () => {
    expect(formatTimeWarpLabel(1)).toBe('x1s')
    expect(formatTimeWarpLabel(10)).toBe('x10s')
    expect(formatTimeWarpLabel(30)).toBe('x30s')
    expect(formatTimeWarpLabel(60)).toBe('x1m')
    expect(formatTimeWarpLabel(300)).toBe('x5m')
    expect(formatTimeWarpLabel(1800)).toBe('x30m')
    expect(formatTimeWarpLabel(3600)).toBe('x1h')
    expect(formatTimeWarpLabel(7200)).toBe('x2h')
    expect(formatTimeWarpLabel(18000)).toBe('x5h')
  })
})
