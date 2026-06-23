export type ReachMoonScoreSummary = {
  baseScorePoints: number
  fuelBonusPoints: number
  fuelRemainingKg: number
  missionElapsedSeconds: number
  timePenaltyPoints: number
  totalScore: number
}

const baseScorePoints = 1_000
const maxFuelBonusPoints = 200
const timePenaltyPointsPerHour = 4

const clampFinite = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0

const formatInteger = (value: number) =>
  Math.round(value).toLocaleString('en-US')

const formatElapsed = (seconds: number) => {
  const roundedSeconds = Math.max(0, Math.round(seconds))
  const days = Math.floor(roundedSeconds / 86_400)
  const hours = Math.floor((roundedSeconds % 86_400) / 3_600)
  const minutes = Math.floor((roundedSeconds % 3_600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }

  return `${roundedSeconds}s`
}

export const calculateReachMoonScore = (input: {
  fuelCapacityKg: number
  fuelRemainingRatio: number
  missionElapsedSeconds: number
}): ReachMoonScoreSummary => {
  const missionElapsedSeconds = Math.round(
    clampFinite(input.missionElapsedSeconds),
  )
  const fuelCapacityKg = clampFinite(input.fuelCapacityKg)
  const fuelRemainingRatio =
    fuelCapacityKg > 0 ? Math.min(1, clampFinite(input.fuelRemainingRatio)) : 0
  const fuelRemainingKg = fuelCapacityKg * fuelRemainingRatio
  const fuelBonusPoints = Math.round(fuelRemainingRatio * maxFuelBonusPoints)
  const timePenaltyPoints =
    Math.floor(missionElapsedSeconds / 3_600) * timePenaltyPointsPerHour

  return {
    baseScorePoints,
    fuelBonusPoints,
    fuelRemainingKg,
    missionElapsedSeconds,
    timePenaltyPoints,
    totalScore: Math.max(
      0,
      baseScorePoints - timePenaltyPoints + fuelBonusPoints,
    ),
  }
}

export const formatReachMoonScoreSummary = (
  score: ReachMoonScoreSummary,
): string =>
  `Score ${formatInteger(score.totalScore)}. Time used ${formatElapsed(score.missionElapsedSeconds)} (-${formatInteger(score.timePenaltyPoints)}). Fuel left ${formatInteger(score.fuelRemainingKg)} kg (+${formatInteger(score.fuelBonusPoints)}). Base ${formatInteger(score.baseScorePoints)}.`

export const isReachMoonScoreSummary = (
  value: unknown,
): value is ReachMoonScoreSummary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<keyof ReachMoonScoreSummary, unknown>
  return (
    typeof record.baseScorePoints === 'number' &&
    typeof record.fuelBonusPoints === 'number' &&
    typeof record.fuelRemainingKg === 'number' &&
    typeof record.missionElapsedSeconds === 'number' &&
    typeof record.timePenaltyPoints === 'number' &&
    typeof record.totalScore === 'number'
  )
}
