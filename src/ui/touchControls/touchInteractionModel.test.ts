import { describe, expect, it } from 'vitest'
import { createTouchInteractionModel } from './touchInteractionModel'

describe('touchInteractionModel', () => {
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
