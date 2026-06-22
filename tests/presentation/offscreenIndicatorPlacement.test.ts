import { describe, expect, it } from 'vitest'

import { resolveOffscreenIndicatorPlacement } from '@/presentation/offscreenIndicatorPlacement'

const baseOptions = {
  blockerPadding: 6,
  blockerRects: [],
  edgePadding: 12,
  indicatorHeight: 20,
  indicatorWidth: 40,
  reservedBottom: 12,
  reservedTop: 12,
  viewportHeight: 300,
  viewportWidth: 400,
}

describe('offscreenIndicatorPlacement', () => {
  it('keeps a blocked left-edge indicator on the left edge', () => {
    const placement = resolveOffscreenIndicatorPlacement({
      ...baseOptions,
      blockerRects: [
        {
          bottom: 180,
          left: 0,
          right: 80,
          top: 120,
        },
      ],
      projectedX: -120,
      projectedY: 170,
    })

    expect(placement.edge).toBe('left')
    expect(placement.x).toBe(32)
    expect(placement.y).toBe(196)
  })

  it('switches to the nearer top edge instead of sliding under a left blocker', () => {
    const placement = resolveOffscreenIndicatorPlacement({
      ...baseOptions,
      blockerRects: [
        {
          bottom: 180,
          left: 0,
          right: 80,
          top: 120,
        },
      ],
      projectedX: -20,
      projectedY: -200,
    })

    expect(placement.edge).toBe('top')
    expect(placement.x).toBeCloseTo(119.543, 3)
    expect(placement.y).toBe(22)
  })

  it('caps top-edge placement beside a top HUD blocker', () => {
    const placement = resolveOffscreenIndicatorPlacement({
      ...baseOptions,
      blockerRects: [
        {
          bottom: 64,
          left: 150,
          right: 250,
          top: 0,
        },
      ],
      projectedX: 190,
      projectedY: -180,
    })

    expect(placement.edge).toBe('top')
    expect(placement.y).toBe(22)
    expect(placement.x).toBe(124)
  })

  it('preserves the directional edge when no blocker overlaps it', () => {
    const placement = resolveOffscreenIndicatorPlacement({
      ...baseOptions,
      projectedX: 520,
      projectedY: 160,
    })

    expect(placement).toEqual({
      edge: 'right',
      x: 368,
      y: 155.25,
    })
  })

  it('keeps the previous side until the projected point crosses two thirds of a blocker', () => {
    const placement = resolveOffscreenIndicatorPlacement({
      ...baseOptions,
      blockerRects: [
        {
          bottom: 180,
          left: 0,
          right: 80,
          top: 120,
        },
      ],
      previousPlacement: {
        edge: 'left',
        x: 32,
        y: 104,
      },
      projectedX: -120,
      projectedY: 170,
    })

    expect(placement).toEqual({
      edge: 'left',
      x: 32,
      y: 104,
    })
  })

  it('switches sides after the projected point crosses two thirds of a blocker', () => {
    const placement = resolveOffscreenIndicatorPlacement({
      ...baseOptions,
      blockerRects: [
        {
          bottom: 180,
          left: 0,
          right: 80,
          top: 120,
        },
      ],
      previousPlacement: {
        edge: 'left',
        x: 32,
        y: 104,
      },
      projectedX: -120,
      projectedY: 180,
    })

    expect(placement).toEqual({
      edge: 'left',
      x: 32,
      y: 196,
    })
  })
})
