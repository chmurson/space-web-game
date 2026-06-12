export type TrajectoryHorizonAction =
  | 'increaseCoastHorizon'
  | 'decreaseCoastHorizon'

export type TrajectoryHorizonPreview = {
  canCommit: boolean
  value: number
}

export type TrajectoryHorizonPreviewOptions = {
  action: TrajectoryHorizonAction
  currentHours: number
  maxHours: number
  minHours: number
}

const valuesDiffer = (first: number, second: number) =>
  Math.abs(first - second) > Number.EPSILON

const baseHorizonStepsHours = [0.5, 1, 2, 4, 8, 16, 24, 48, 96, 192, 384, 768]

const clampHorizonHours = (
  value: number,
  options: {
    maxHours: number
    minHours: number
  },
) => Math.min(options.maxHours, Math.max(options.minHours, value))

const buildHorizonSteps = (options: { maxHours: number; minHours: number }) => {
  const steps = baseHorizonStepsHours.filter(
    (step) => step >= options.minHours && step <= options.maxHours,
  )

  if (!steps.includes(options.minHours)) {
    steps.unshift(options.minHours)
  }

  if (!steps.includes(options.maxHours)) {
    steps.push(options.maxHours)
  }

  return steps.sort((first, second) => first - second)
}

export const getNextTrajectoryHorizonHours = (
  options: TrajectoryHorizonPreviewOptions,
) => {
  const currentHours = clampHorizonHours(options.currentHours, options)
  const steps = buildHorizonSteps(options)

  if (options.action === 'increaseCoastHorizon') {
    return (
      steps.find((step) => step > currentHours + Number.EPSILON) ??
      steps.at(-1) ??
      currentHours
    )
  }

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index]
    if (step < currentHours - Number.EPSILON) {
      return step
    }
  }

  return steps[0] ?? currentHours
}

export const getTrajectoryHorizonPreview = (
  options: TrajectoryHorizonPreviewOptions,
): TrajectoryHorizonPreview => {
  const nextHours = getNextTrajectoryHorizonHours(options)

  return {
    canCommit: valuesDiffer(nextHours, options.currentHours),
    value: nextHours,
  }
}

export const getTrajectoryHorizonPreviews = (
  options: TrajectoryHorizonPreviewOptions & { count: number },
): TrajectoryHorizonPreview[] => {
  if (options.count <= 0) {
    return []
  }

  const previews: TrajectoryHorizonPreview[] = []
  let currentHours = options.currentHours

  for (let step = 0; step < options.count; step += 1) {
    const preview = getTrajectoryHorizonPreview({
      action: options.action,
      currentHours,
      maxHours: options.maxHours,
      minHours: options.minHours,
    })

    if (step > 0 && !preview.canCommit) {
      break
    }

    previews.push(preview)

    if (!preview.canCommit) {
      break
    }

    currentHours = preview.value
  }

  return previews
}
