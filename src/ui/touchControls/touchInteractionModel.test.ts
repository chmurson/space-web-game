import { describe, expect, it } from 'vitest'
import { createTouchInteractionModel } from './touchInteractionModel'

describe('touchInteractionModel', () => {
  it('keeps left-zone preview non-committable until opacity reaches full threshold', () => {
    const model = createTouchInteractionModel()

    const snapshot = model.updateTimeWarpPreview({
      action: 'increaseTimeWarp',
      canCommit: true,
      opacity: 0.6,
      reason: null,
      value: 10,
    })

    expect(snapshot.timeWarp).toEqual({
      action: null,
      opacity: 0.6,
      reason: null,
      value: 10,
      visible: true,
    })
    expect(snapshot.shouldPulseHaptics).toBe(false)
  })

  it('keeps the preview visible and marks it blocked when the next step is clamped', () => {
    const model = createTouchInteractionModel()

    const snapshot = model.updateTimeWarpPreview({
      action: 'increaseTimeWarp',
      canCommit: false,
      opacity: 1,
      reason: 'thrust-active',
      value: 500,
    })

    expect(snapshot.timeWarp).toEqual({
      action: null,
      opacity: 1,
      reason: 'thrust-active',
      value: 500,
      visible: true,
    })

    const result = model.commitTimeWarpPreview()

    expect(result.action).toBeNull()
    expect(result.snapshot.timeWarp).toEqual({
      action: null,
      opacity: 0,
      reason: null,
      value: null,
      visible: false,
    })
    expect(result.snapshot.shouldPulseHaptics).toBe(false)
  })

  it('commits one time-warp step on release and returns the correct action', () => {
    const model = createTouchInteractionModel()

    model.updateTimeWarpPreview({
      action: 'decreaseTimeWarp',
      canCommit: true,
      opacity: 1,
      reason: null,
      value: 1,
    })

    const result = model.commitTimeWarpPreview()

    expect(result.action).toBe('decreaseTimeWarp')
    expect(result.snapshot.timeWarp).toEqual({
      action: null,
      opacity: 0,
      reason: null,
      value: null,
      visible: false,
    })
    expect(result.snapshot.shouldPulseHaptics).toBe(true)
  })

  it('hides the preview cleanly on cancel', () => {
    const model = createTouchInteractionModel()

    model.updateTimeWarpPreview({
      action: 'increaseTimeWarp',
      canCommit: true,
      opacity: 1,
      reason: null,
      value: 100,
    })

    expect(model.cancelTimeWarpPreview().timeWarp).toEqual({
      action: null,
      opacity: 0,
      reason: null,
      value: null,
      visible: false,
    })
  })

  it('shows thrust without forcing engagement', () => {
    const model = createTouchInteractionModel()

    const snapshot = model.showThrust({ x: 120, y: 240 })

    expect(snapshot.thrust).toEqual({
      anchor: { x: 120, y: 240 },
      engaged: false,
      latched: false,
      offset: 0,
      visible: true,
    })
    expect(snapshot.shouldPulseHaptics).toBe(false)
  })

  it('latches thrust on when dragged upward past the snap distance', () => {
    const model = createTouchInteractionModel()

    model.showThrust({ x: 100, y: 200 })
    const snapshot = model.updateThrustDrag({
      currentY: 160,
      startLatched: false,
      startY: 200,
    })

    expect(snapshot.thrust.engaged).toBe(true)
    expect(snapshot.thrust.latched).toBe(true)
    expect(snapshot.thrust.offset).toBe(-48)
    expect(snapshot.shouldPulseHaptics).toBe(true)
  })

  it('can unlatch when a latched drag is moved far enough downward', () => {
    const model = createTouchInteractionModel()

    model.showThrust({ x: 100, y: 200 })
    model.updateThrustDrag({
      currentY: 160,
      startLatched: false,
      startY: 200,
    })

    const snapshot = model.updateThrustDrag({
      currentY: 235,
      startLatched: true,
      startY: 200,
    })

    expect(snapshot.thrust.engaged).toBe(false)
    expect(snapshot.thrust.latched).toBe(false)
    expect(snapshot.thrust.offset).toBe(-13)
    expect(snapshot.shouldPulseHaptics).toBe(true)
  })

  it('hides thrust only when it is not latched', () => {
    const model = createTouchInteractionModel()

    model.showThrust({ x: 100, y: 200 })
    expect(model.hideThrust().thrust).toMatchObject({
      engaged: false,
      latched: false,
      offset: 0,
      visible: false,
    })

    model.showThrust({ x: 100, y: 200 })
    model.updateThrustDrag({
      currentY: 160,
      startLatched: false,
      startY: 200,
    })
    expect(model.hideThrust().thrust).toMatchObject({
      engaged: true,
      latched: true,
      offset: -48,
      visible: true,
    })
  })

  it('reuses a latched thrust control from the latched offset', () => {
    const model = createTouchInteractionModel()

    model.setPendingThrustAnchor({ x: 90, y: 150 })
    const snapshot = model.reuseLatchedThrust(true)

    expect(snapshot.thrust).toEqual({
      anchor: { x: 90, y: 150 },
      engaged: true,
      latched: true,
      offset: -48,
      visible: true,
    })
    expect(snapshot.shouldPulseHaptics).toBe(true)
  })
})
