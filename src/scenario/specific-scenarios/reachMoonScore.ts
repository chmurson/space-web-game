export type ReachMoonScoreSummary = {
  baseScorePoints: number
  fuelBonusPoints: number
  fuelRemainingKg: number
  missionElapsedSeconds: number
  timePenaltyPoints: number
  totalScore: number
}

export const REACH_MOON_FUEL_CAPACITY_KG = 32_000
export const REACH_MOON_BASE_SCORE_POINTS = 1_000
export const REACH_MOON_MAX_FUEL_BONUS_POINTS = 200
export const REACH_MOON_TIME_PENALTY_POINTS_PER_HOUR = 4

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
  const fuelBonusPoints = Math.round(
    fuelRemainingRatio * REACH_MOON_MAX_FUEL_BONUS_POINTS,
  )
  const timePenaltyPoints =
    Math.floor(missionElapsedSeconds / 3_600) *
    REACH_MOON_TIME_PENALTY_POINTS_PER_HOUR

  return {
    baseScorePoints: REACH_MOON_BASE_SCORE_POINTS,
    fuelBonusPoints,
    fuelRemainingKg,
    missionElapsedSeconds,
    timePenaltyPoints,
    totalScore: Math.max(
      0,
      REACH_MOON_BASE_SCORE_POINTS - timePenaltyPoints + fuelBonusPoints,
    ),
  }
}

export const calculateReachMoonMissionScore = (input: {
  fuelRemainingRatio: number
  missionElapsedSeconds: number
}): ReachMoonScoreSummary =>
  calculateReachMoonScore({
    fuelCapacityKg: REACH_MOON_FUEL_CAPACITY_KG,
    fuelRemainingRatio: input.fuelRemainingRatio,
    missionElapsedSeconds: input.missionElapsedSeconds,
  })

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
