export type IntentionalSwipeThresholdPoint = {
  x: number
  y: number
}

const getAxisThresholdProgress = (delta: number, threshold: number) => {
  if (threshold <= 0) {
    return 0
  }

  const distance = Math.abs(delta)
  return distance >= threshold ? threshold / distance : Number.POSITIVE_INFINITY
}

export const getIntentionalSwipeThresholdPoint = (options: {
  currentX: number
  currentY: number
  startX: number
  startY: number
  thresholdX: number
  thresholdY: number
}): IntentionalSwipeThresholdPoint | null => {
  const deltaX = options.currentX - options.startX
  const deltaY = options.currentY - options.startY
  const crossX = getAxisThresholdProgress(deltaX, options.thresholdX)
  const crossY = getAxisThresholdProgress(deltaY, options.thresholdY)
  const thresholdProgress = Math.min(crossX, crossY)

  if (!Number.isFinite(thresholdProgress)) {
    return null
  }

  return {
    x: options.startX + deltaX * thresholdProgress,
    y: options.startY + deltaY * thresholdProgress,
  }
}
