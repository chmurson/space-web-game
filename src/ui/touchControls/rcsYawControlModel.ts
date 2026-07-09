export type RcsYawAnalogSnapshot = {
  leftFillPx: number
  offsetPx: number
  rightFillPx: number
  turn: number
}

export type RcsYawAnalogParams = {
  clientX: number
  thumbWidth: number
  trackLeft: number
  trackWidth: number
}

export type RcsYawTurnParams = {
  thumbWidth: number
  trackWidth: number
  turn: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const sanitizeTurn = (turn: number) => {
  if (!Number.isFinite(turn)) {
    return 0
  }

  return Math.abs(turn) < 0.001 ? 0 : clamp(turn, -1, 1)
}

export const getNeutralRcsYawAnalogSnapshot = (): RcsYawAnalogSnapshot => ({
  leftFillPx: 0,
  offsetPx: 0,
  rightFillPx: 0,
  turn: 0,
})

const getMaxOffsetPx = (trackWidth: number, thumbWidth: number) =>
  Math.max(1, (trackWidth - thumbWidth) / 2)

const createSnapshotFromOffset = (
  offsetPx: number,
  maxOffsetPx: number,
): RcsYawAnalogSnapshot => {
  const normalizedOffset = offsetPx / maxOffsetPx
  const turn = sanitizeTurn(-normalizedOffset)

  return {
    leftFillPx: Math.max(0, -offsetPx),
    offsetPx,
    rightFillPx: Math.max(0, offsetPx),
    turn,
  }
}

export const getRcsYawAnalogSnapshot = ({
  clientX,
  thumbWidth,
  trackLeft,
  trackWidth,
}: RcsYawAnalogParams): RcsYawAnalogSnapshot => {
  const maxOffsetPx = getMaxOffsetPx(trackWidth, thumbWidth)
  const centerX = trackLeft + trackWidth / 2
  const offsetPx = clamp(clientX - centerX, -maxOffsetPx, maxOffsetPx)

  return createSnapshotFromOffset(offsetPx, maxOffsetPx)
}

export const getRcsYawAnalogSnapshotFromTurn = ({
  thumbWidth,
  trackWidth,
  turn,
}: RcsYawTurnParams): RcsYawAnalogSnapshot => {
  const maxOffsetPx = getMaxOffsetPx(trackWidth, thumbWidth)
  const offsetPx = -sanitizeTurn(turn) * maxOffsetPx

  return createSnapshotFromOffset(offsetPx, maxOffsetPx)
}
