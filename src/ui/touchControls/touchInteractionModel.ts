export type TimeWarpAction = 'increaseTimeWarp' | 'decreaseTimeWarp'

export type TouchOverlayPoint = {
  x: number
  y: number
}

export type TimeWarpPreviewState = {
  action: TimeWarpAction | null
  opacity: number
  visible: boolean
  value: number | null
}

export type ThrustVisualState = {
  anchor: TouchOverlayPoint
  engaged: boolean
  latched: boolean
  offset: number
  visible: boolean
}

export type TouchInteractionSnapshot = {
  shouldPulseHaptics: boolean
  thrust: ThrustVisualState
  timeWarp: TimeWarpPreviewState
}

const thrustControlTravelPx = 48
const thrustSnapDistancePx = 30

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const createSnapshot = (
  thrust: ThrustVisualState,
  timeWarp: TimeWarpPreviewState,
  shouldPulseHaptics = false,
): TouchInteractionSnapshot => ({
  shouldPulseHaptics,
  thrust: {
    anchor: { ...thrust.anchor },
    engaged: thrust.engaged,
    latched: thrust.latched,
    offset: thrust.offset,
    visible: thrust.visible,
  },
  timeWarp: {
    action: timeWarp.action,
    opacity: timeWarp.opacity,
    value: timeWarp.value,
    visible: timeWarp.visible,
  },
})

export type TouchInteractionModel = {
  cancelTimeWarpPreview(): TouchInteractionSnapshot
  commitTimeWarpPreview(): {
    action: TimeWarpAction | null
    snapshot: TouchInteractionSnapshot
  }
  getSnapshot(): TouchInteractionSnapshot
  hideThrust(): TouchInteractionSnapshot
  reuseLatchedThrust(startLatched: boolean): TouchInteractionSnapshot
  setPendingThrustAnchor(anchor: TouchOverlayPoint): TouchInteractionSnapshot
  showThrust(anchor: TouchOverlayPoint): TouchInteractionSnapshot
  updateThrustDrag(params: {
    currentY: number
    startLatched: boolean
    startY: number
  }): TouchInteractionSnapshot
  updateTimeWarpPreview(params: {
    action: TimeWarpAction
    canCommit: boolean
    opacity: number
    value: number
  }): TouchInteractionSnapshot
}

export const createTouchInteractionModel = (): TouchInteractionModel => {
  const thrust: ThrustVisualState = {
    anchor: { x: 0, y: 0 },
    engaged: false,
    latched: false,
    offset: 0,
    visible: false,
  }

  const timeWarp: TimeWarpPreviewState = {
    action: null,
    opacity: 0,
    value: null,
    visible: false,
  }

  const getSnapshot = (shouldPulseHaptics = false) =>
    createSnapshot(thrust, timeWarp, shouldPulseHaptics)

  const syncThrustEngaged = (nextEngaged: boolean) => {
    const changed = thrust.engaged !== nextEngaged
    thrust.engaged = nextEngaged
    return changed
  }

  return {
    cancelTimeWarpPreview() {
      timeWarp.action = null
      timeWarp.opacity = 0
      timeWarp.value = null
      timeWarp.visible = false
      return getSnapshot()
    },
    commitTimeWarpPreview() {
      const action = timeWarp.action
      const shouldPulseHaptics = action !== null
      timeWarp.action = null
      timeWarp.opacity = 0
      timeWarp.value = null
      timeWarp.visible = false
      return {
        action,
        snapshot: getSnapshot(shouldPulseHaptics),
      }
    },
    getSnapshot() {
      return getSnapshot()
    },
    hideThrust() {
      thrust.offset = thrust.latched ? -thrustControlTravelPx : 0
      const shouldPulseHaptics = syncThrustEngaged(thrust.latched)
      thrust.visible = thrust.latched
      return getSnapshot(shouldPulseHaptics)
    },
    reuseLatchedThrust(startLatched) {
      thrust.visible = true
      thrust.latched = startLatched
      thrust.offset = startLatched ? -thrustControlTravelPx : 0
      const shouldPulseHaptics = syncThrustEngaged(startLatched)
      return getSnapshot(shouldPulseHaptics)
    },
    setPendingThrustAnchor(anchor) {
      thrust.anchor = { ...anchor }
      return getSnapshot()
    },
    showThrust(anchor) {
      thrust.anchor = { ...anchor }
      thrust.visible = true
      thrust.offset = 0
      const shouldPulseHaptics = syncThrustEngaged(thrust.latched)
      return getSnapshot(shouldPulseHaptics)
    },
    updateThrustDrag({ currentY, startLatched, startY }) {
      const deltaY = currentY - startY
      const rawOffset = clamp(
        (startLatched ? -thrustControlTravelPx : 0) + deltaY,
        -thrustControlTravelPx,
        0,
      )
      const shouldLatch = startLatched
        ? deltaY < thrustSnapDistancePx
        : deltaY <= -thrustSnapDistancePx

      thrust.visible = true
      thrust.latched = shouldLatch
      thrust.offset = shouldLatch ? -thrustControlTravelPx : rawOffset
      const shouldPulseHaptics = syncThrustEngaged(shouldLatch)
      return getSnapshot(shouldPulseHaptics)
    },
    updateTimeWarpPreview({ action, canCommit, opacity, value }) {
      if (opacity > 0 && canCommit) {
        timeWarp.action = opacity >= 1 ? action : null
        timeWarp.opacity = opacity
        timeWarp.value = value
        timeWarp.visible = true
        return getSnapshot()
      }

      timeWarp.action = null
      timeWarp.opacity = 0
      timeWarp.value = null
      timeWarp.visible = false
      return getSnapshot()
    },
  }
}
