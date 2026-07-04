export type ReachMoonScoreSummary = {
  baseScorePoints: number
  fuelBonusPoints: number
  fuelRemainingKg: number
  missionElapsedSeconds: number
  timePenaltyPoints: number
  totalScore: number
}

export type ReachMoonScoreSummaryDisplay = {
  fuelBonusPoints: string
  fuelLeft: string
  missionElapsed: string
  timeScorePoints: string
  totalScore: string
}

export const REACH_MOON_FUEL_CAPACITY_KG = 32_000
export const REACH_MOON_BASE_SCORE_POINTS = 0
export const REACH_MOON_MAX_FUEL_BONUS_POINTS = 200
export const REACH_MOON_MAX_TIME_SCORE_POINTS = 50

const secondsPerDay = 86_400

const fuelScoreCoefficients = [
  -0.06993007, 216.7948718, -1_968.244949, 9_897.654427, -17_214.2094,
  12_740.38461, -3_472.222221,
] as const

const timeScoreCoefficients = [
  54.469281, -4.235333, -0.348178, 0.058982, -0.001999,
] as const

const clampFinite = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0

const clampPoints = (value: number, max: number) =>
  Math.max(0, Math.min(max, value))

const evaluatePolynomial = (
  coefficients: readonly number[],
  input: number,
): number =>
  coefficients.reduce(
    (score, coefficient, power) => score + coefficient * input ** power,
    0,
  )

const roundScorePoints = (value: number) => Math.round(value * 10) / 10

const formatScorePoints = (value: number) =>
  roundScorePoints(value).toLocaleString('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(roundScorePoints(value)) ? 0 : 1,
  })

const formatInteger = (value: number) =>
  Math.round(value).toLocaleString('en-US')

export const formatReachMoonFuelLeftPercent = (
  score: Pick<ReachMoonScoreSummary, 'fuelRemainingKg'>,
): string => {
  const fuelRemainingRatio = getReachMoonFuelRemainingRatio(score)

  return `${formatInteger(fuelRemainingRatio * 100)}%`
}

export const getReachMoonFuelRemainingRatio = (
  score: Pick<ReachMoonScoreSummary, 'fuelRemainingKg'>,
): number =>
  Math.min(1, clampFinite(score.fuelRemainingKg) / REACH_MOON_FUEL_CAPACITY_KG)

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
  const missionElapsedDays = missionElapsedSeconds / secondsPerDay
  const fuelBonusPoints = roundScorePoints(
    clampPoints(
      evaluatePolynomial(fuelScoreCoefficients, fuelRemainingRatio),
      REACH_MOON_MAX_FUEL_BONUS_POINTS,
    ),
  )
  const timePenaltyPoints = roundScorePoints(
    clampPoints(
      evaluatePolynomial(timeScoreCoefficients, missionElapsedDays),
      REACH_MOON_MAX_TIME_SCORE_POINTS,
    ),
  )

  return {
    baseScorePoints: REACH_MOON_BASE_SCORE_POINTS,
    fuelBonusPoints,
    fuelRemainingKg,
    missionElapsedSeconds,
    timePenaltyPoints,
    totalScore: roundScorePoints(fuelBonusPoints + timePenaltyPoints),
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

export const formatReachMoonScoreSummaryDisplay = (
  score: ReachMoonScoreSummary,
): ReachMoonScoreSummaryDisplay => ({
  fuelBonusPoints: formatScorePoints(score.fuelBonusPoints),
  fuelLeft: formatReachMoonFuelLeftPercent(score),
  missionElapsed: formatElapsed(score.missionElapsedSeconds),
  timeScorePoints: formatScorePoints(score.timePenaltyPoints),
  totalScore: formatScorePoints(score.totalScore),
})

export const formatReachMoonScoreSummary = (
  score: ReachMoonScoreSummary,
): string => {
  const display = formatReachMoonScoreSummaryDisplay(score)

  return `Score ${display.totalScore}. Time used ${display.missionElapsed} (+${display.timeScorePoints}). Fuel left ${display.fuelLeft} (+${display.fuelBonusPoints}).`
}

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
