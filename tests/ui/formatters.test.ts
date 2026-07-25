import { describe, expect, it } from 'vitest'
import {
  formatCompactElapsed,
  formatDistance,
  formatSpeed,
  formatTimeWarpLabel,
  formatTrajectoryHorizonDuration,
} from '@/ui/formatters'

describe('formatDistance', () => {
  it.each([
    [114_000, '110 km'],
    [123_000, '120 km'],
    [135_000, '140 km'],
    [114_000_000, '110 Mm'],
    [123_000_000, '120 Mm'],
    [135_000_000, '140 Mm'],
  ])('formats %s meters with at most two significant digits', (meters, label) => {
    expect(formatDistance(meters)).toBe(label)
  })

  it('uses Math.round behavior at two-significant-digit boundaries', () => {
    expect(formatDistance(114_999)).toBe('110 km')
    expect(formatDistance(115_000)).toBe('120 km')
    expect(formatDistance(1_149_999)).toBe(`${(1.1).toLocaleString()} Mm`)
    expect(formatDistance(1_150_000)).toBe(`${(1.2).toLocaleString()} Mm`)
  })

  it('keeps the kilometer-to-megameter threshold and locale separators', () => {
    expect(formatDistance(999_999)).toBe(`${(1_000).toLocaleString()} km`)
    expect(formatDistance(1_000_000)).toBe('1 Mm')
  })

  it('keeps useful fractional significant digits without trailing zeroes', () => {
    expect(formatDistance(1_140)).toBe(`${(1.1).toLocaleString()} km`)
    expect(formatDistance(1_180)).toBe(`${(1.2).toLocaleString()} km`)
    expect(formatDistance(1_140_000)).toBe(`${(1.1).toLocaleString()} Mm`)
    expect(formatDistance(1_180_000)).toBe(`${(1.2).toLocaleString()} Mm`)
  })
})

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
    expect(formatTimeWarpLabel(2)).toBe('x2s')
    expect(formatTimeWarpLabel(4)).toBe('x4s')
    expect(formatTimeWarpLabel(8)).toBe('x8s')
    expect(formatTimeWarpLabel(15)).toBe('x15s')
    expect(formatTimeWarpLabel(30)).toBe('x30s')
    expect(formatTimeWarpLabel(60)).toBe('x1m')
    expect(formatTimeWarpLabel(120)).toBe('x2m')
    expect(formatTimeWarpLabel(240)).toBe('x4m')
    expect(formatTimeWarpLabel(480)).toBe('x8m')
    expect(formatTimeWarpLabel(900)).toBe('x15m')
    expect(formatTimeWarpLabel(1800)).toBe('x30m')
    expect(formatTimeWarpLabel(3600)).toBe('x1h')
    expect(formatTimeWarpLabel(7200)).toBe('x2h')
    expect(formatTimeWarpLabel(14400)).toBe('x4h')
    expect(formatTimeWarpLabel(28800)).toBe('x8h')
    expect(formatTimeWarpLabel(54000)).toBe('x15h')
  })
})

describe('formatTrajectoryHorizonDuration', () => {
  it('formats trajectory horizons without fractional days', () => {
    expect(formatTrajectoryHorizonDuration(30 * 60)).toBe('30m')
    expect(formatTrajectoryHorizonDuration(16 * 3600)).toBe('16h')
    expect(formatTrajectoryHorizonDuration(24 * 3600)).toBe('1d')
    expect(formatTrajectoryHorizonDuration(32 * 3600)).toBe('32h')
    expect(formatTrajectoryHorizonDuration(48 * 3600)).toBe('2d')
  })
})
