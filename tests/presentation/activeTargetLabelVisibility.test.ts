import { describe, expect, it } from 'vitest'

import { createActiveTargetLabelVisibility } from '@/presentation/bodyPresentation/activeTargetLabelVisibility'

describe('createActiveTargetLabelVisibility', () => {
  it('shows the full label for three seconds after each target change', () => {
    const isFullLabelVisible = createActiveTargetLabelVisibility()

    expect(isFullLabelVisible('moon', 1_000)).toBe(true)
    expect(isFullLabelVisible('moon', 3_999)).toBe(true)
    expect(isFullLabelVisible('moon', 4_000)).toBe(false)
    expect(isFullLabelVisible('earth', 4_500)).toBe(true)
    expect(isFullLabelVisible('earth', 7_499)).toBe(true)
    expect(isFullLabelVisible('earth', 7_500)).toBe(false)
  })

  it('stays hidden when no active target is available', () => {
    const isFullLabelVisible = createActiveTargetLabelVisibility()

    expect(isFullLabelVisible(null, 1_000)).toBe(false)
  })
})
