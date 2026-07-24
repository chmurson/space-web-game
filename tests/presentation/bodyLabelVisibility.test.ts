import { describe, expect, it } from 'vitest'

import { createBodyLabelVisibility } from '@/presentation/bodyPresentation/bodyLabelVisibility'

describe('createBodyLabelVisibility', () => {
  it('shows an onscreen body for three seconds after each viewport entry', () => {
    const isVisible = createBodyLabelVisibility()

    expect(
      isVisible({
        apparentRadiusPx: 40,
        bodyId: 'earth',
        nowMs: 1_000,
        onscreen: true,
      }),
    ).toBe(true)
    expect(
      isVisible({
        apparentRadiusPx: 40,
        bodyId: 'earth',
        nowMs: 3_999,
        onscreen: true,
      }),
    ).toBe(true)
    expect(
      isVisible({
        apparentRadiusPx: 40,
        bodyId: 'earth',
        nowMs: 4_000,
        onscreen: true,
      }),
    ).toBe(false)

    expect(
      isVisible({
        apparentRadiusPx: 40,
        bodyId: 'earth',
        nowMs: 4_500,
        onscreen: false,
      }),
    ).toBe(false)
    expect(
      isVisible({
        apparentRadiusPx: 40,
        bodyId: 'earth',
        nowMs: 5_000,
        onscreen: true,
      }),
    ).toBe(true)
    expect(
      isVisible({
        apparentRadiusPx: 40,
        bodyId: 'earth',
        nowMs: 8_000,
        onscreen: true,
      }),
    ).toBe(false)
  })

  it('uses 6/8-pixel radius hysteresis for persistent small-body labels', () => {
    const isVisible = createBodyLabelVisibility()
    const check = (apparentRadiusPx: number, nowMs: number) =>
      isVisible({
        apparentRadiusPx,
        bodyId: 'moon',
        nowMs,
        onscreen: true,
      })

    expect(check(9, 0)).toBe(true)
    expect(check(9, 3_000)).toBe(false)
    expect(check(6, 3_001)).toBe(true)
    expect(check(7, 3_002)).toBe(true)
    expect(check(8, 3_003)).toBe(true)
    expect(check(8.1, 3_004)).toBe(false)
    expect(check(7, 3_005)).toBe(false)
    expect(check(6, 3_006)).toBe(true)
  })
})
