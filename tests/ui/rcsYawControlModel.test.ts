import { describe, expect, it } from 'vitest'

import {
  getNeutralRcsYawAnalogSnapshot,
  getRcsYawAnalogSnapshot,
  getRcsYawAnalogSnapshotFromTurn,
} from '@/ui/touchControls/rcsYawControlModel'

describe('RCS yaw control model', () => {
  it('maps center to neutral and horizontal drag to proportional turn', () => {
    const params = {
      thumbWidth: 48,
      trackLeft: 10,
      trackWidth: 180,
    }

    expect(getRcsYawAnalogSnapshot({ ...params, clientX: 100 })).toEqual({
      leftFillPx: 0,
      offsetPx: 0,
      rightFillPx: 0,
      turn: 0,
    })

    expect(getRcsYawAnalogSnapshot({ ...params, clientX: 67 })).toEqual({
      leftFillPx: 33,
      offsetPx: -33,
      rightFillPx: 0,
      turn: -0.5,
    })

    expect(getRcsYawAnalogSnapshot({ ...params, clientX: 133 })).toEqual({
      leftFillPx: 0,
      offsetPx: 33,
      rightFillPx: 33,
      turn: 0.5,
    })
  })

  it('maps direct turn values back to thumb offset and fill', () => {
    const params = {
      thumbWidth: 48,
      trackWidth: 180,
    }

    expect(getRcsYawAnalogSnapshotFromTurn({ ...params, turn: 0.5 })).toEqual({
      leftFillPx: 0,
      offsetPx: 33,
      rightFillPx: 33,
      turn: 0.5,
    })

    expect(getRcsYawAnalogSnapshotFromTurn({ ...params, turn: -2 })).toEqual({
      leftFillPx: 66,
      offsetPx: -66,
      rightFillPx: 0,
      turn: -1,
    })
  })

  it('clamps travel at the track edge and returns a neutral reset snapshot', () => {
    const params = {
      thumbWidth: 48,
      trackLeft: 10,
      trackWidth: 180,
    }

    expect(getRcsYawAnalogSnapshot({ ...params, clientX: -200 })).toEqual({
      leftFillPx: 66,
      offsetPx: -66,
      rightFillPx: 0,
      turn: -1,
    })

    expect(getRcsYawAnalogSnapshot({ ...params, clientX: 400 })).toEqual({
      leftFillPx: 0,
      offsetPx: 66,
      rightFillPx: 66,
      turn: 1,
    })

    expect(getNeutralRcsYawAnalogSnapshot()).toEqual({
      leftFillPx: 0,
      offsetPx: 0,
      rightFillPx: 0,
      turn: 0,
    })
  })
})
