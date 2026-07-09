import { describe, expect, it } from 'vitest'

import {
  getTimeWarpTapeGestureCommittedStepCount,
  getTimeWarpTapeGestureDirection,
  getTimeWarpTapeGesturePreviewDeltaX,
  getTimeWarpTapeReleaseWillCommit,
  presentTimeWarpTapeControl,
} from '@/ui/touchControls/timeWarpTapeControl/createTimeWarpTapeControl'

describe('timeWarpTapeControl', () => {
  it('maps left drags to faster warp and right drags to slower warp', () => {
    expect(getTimeWarpTapeGestureDirection(-1)).toBe('increase')
    expect(getTimeWarpTapeGestureDirection(1)).toBe('decrease')
    expect(getTimeWarpTapeGestureDirection(0)).toBeNull()
  })

  it('counts crossed tape ticks and snaps after the midpoint', () => {
    expect(getTimeWarpTapeGestureCommittedStepCount(-27)).toBe(0)
    expect(getTimeWarpTapeGestureCommittedStepCount(-28)).toBe(1)
    expect(getTimeWarpTapeGestureCommittedStepCount(56)).toBe(2)
    expect(getTimeWarpTapeReleaseWillCommit(-14)).toBe(false)
    expect(getTimeWarpTapeReleaseWillCommit(-15)).toBe(true)
    expect(getTimeWarpTapeReleaseWillCommit(15)).toBe(true)
  })

  it('keeps preview motion relative to the latest uncommitted tick', () => {
    expect(getTimeWarpTapeGesturePreviewDeltaX(82, 100)).toBe(-18)
    expect(getTimeWarpTapeGesturePreviewDeltaX(116, 100)).toBe(16)
    expect(getTimeWarpTapeGesturePreviewDeltaX(100, 100)).toBe(0)
  })

  it('orders slower values left and faster values right under a fixed reader', () => {
    expect(
      presentTimeWarpTapeControl({
        currentValue: 300,
        decreaseSteps: [
          { canCommit: true, reason: null, value: 240 },
          { canCommit: true, reason: null, value: 180 },
        ],
        increaseSteps: [
          { canCommit: true, reason: null, value: 360 },
          { canCommit: false, reason: 'scenario-limit', value: 420 },
        ],
      }),
    ).toMatchObject({
      currentLabel: 'x5m',
      steps: [
        { label: 'x3m', offset: -2, tone: 'available' },
        { label: 'x4m', offset: -1, tone: 'available' },
        { label: 'x5m', offset: 0, tone: 'current' },
        { label: 'x6m', offset: 1, tone: 'available' },
        { label: 'x7m', offset: 2, tone: 'blocked' },
      ],
    })
  })

  it('marks the release as committable only when the nearest step is allowed', () => {
    expect(
      presentTimeWarpTapeControl(
        {
          currentValue: 300,
          decreaseSteps: [{ canCommit: true, reason: null, value: 240 }],
          increaseSteps: [{ canCommit: true, reason: null, value: 360 }],
        },
        -15,
      ),
    ).toMatchObject({
      releaseWillCommit: true,
      targetDirection: 'increase',
    })

    expect(
      presentTimeWarpTapeControl(
        {
          currentValue: 300,
          decreaseSteps: [{ canCommit: true, reason: null, value: 240 }],
          increaseSteps: [
            { canCommit: false, reason: 'scenario-limit', value: 300 },
          ],
        },
        -15,
      ),
    ).toMatchObject({
      releaseWillCommit: false,
      targetDirection: 'increase',
    })
  })
})
