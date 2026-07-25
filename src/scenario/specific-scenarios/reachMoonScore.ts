import { MOON_RADIUS } from '../../simulation/constants'
import { formatDistance } from '../../ui/formatters'

export type ReachMoonScoreSummary = {
  baseScorePoints: number
  fuelBonusPoints: number
  fuelRemainingKg: number
  lunarOrbitCircularityPoints?: number
  lunarOrbitEccentricity?: number | null
  lunarOrbitQuality?: ReachMoonOrbitQualityMetric | null
  lunarOrbitQualityPoints?: number
  missionElapsedSeconds: number
  timePenaltyPoints: number
  totalScore: number
}

export type ReachMoonScoreSummaryDisplay = {
  fuelBonusPoints: string
  fuelLeft: string
  lunarOrbitQualityAltitude: string
  lunarOrbitQualityPoints: string
  missionElapsed: string
  timeScorePoints: string
  totalScore: string
}

export type ReachMoonOrbitQualityMetric = {
  orbitApoapsisAltitudeMeters: number
  orbitPeriapsisAltitudeMeters: number
}

export const REACH_MOON_FUEL_CAPACITY_KG = 32_000
export const REACH_MOON_BASE_SCORE_POINTS = 0
export const REACH_MOON_MAX_FUEL_BONUS_POINTS = 200
export const REACH_MOON_MAX_TIME_SCORE_POINTS = 50
export const MOON_ORBIT_ALTITUDE_BONUS_MAX_POINTS = 50
export const MOON_ORBIT_CIRCULARITY_BONUS_MAX_POINTS = 25
export const MOON_ORBIT_BONUS_MAX_POINTS =
  MOON_ORBIT_ALTITUDE_BONUS_MAX_POINTS + MOON_ORBIT_CIRCULARITY_BONUS_MAX_POINTS
export const MOON_ORBIT_FULL_BONUS_APOAPSIS_ALTITUDE_METERS = 100_000
export const MOON_ORBIT_ZERO_BONUS_APOAPSIS_ALTITUDE_METERS = 2_000_000
export const MOON_ORBIT_SAFE_PERIAPSIS_ALTITUDE_METERS = 25_000
export const MOON_ORBIT_MAX_RISK_PENALTY_POINTS = 50
export const MOON_ORBIT_FULL_CIRCULARITY_ECCENTRICITY = 0.02
export const MOON_ORBIT_ZERO_CIRCULARITY_ECCENTRICITY = 0.2

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

const clampOrbitQualityPoints = (value: number) =>
  Math.max(
    -MOON_ORBIT_MAX_RISK_PENALTY_POINTS,
    Math.min(MOON_ORBIT_BONUS_MAX_POINTS, value),
  )

const evaluatePolynomial = (
  coefficients: readonly number[],
  input: number,
): number =>
  coefficients.reduce(
    (score, coefficient, power) => score + coefficient * input ** power,
    0,
  )

const roundScorePoints = (value: number) => Math.round(value * 10) / 10

const roundEccentricity = (value: number) => Math.round(value * 1_000) / 1_000

const formatScorePoints = (value: number) =>
  roundScorePoints(value).toLocaleString('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(roundScorePoints(value)) ? 0 : 1,
  })

const formatInteger = (value: number) =>
  Math.round(value).toLocaleString('en-US')

type ReachMoonOrbitQualityBreakdown = {
  altitudeBonusPoints: number
  circularityBonusPoints: number
  eccentricity: number | null
  riskPenaltyPoints: number
  totalPoints: number
}

const calculateReachMoonOrbitEccentricity = (
  metric: ReachMoonOrbitQualityMetric,
): number => {
  const apoapsisAltitudeMeters = clampFinite(metric.orbitApoapsisAltitudeMeters)
  const periapsisAltitudeMeters = clampFinite(
    metric.orbitPeriapsisAltitudeMeters,
  )
  const apoapsisRadiusMeters = MOON_RADIUS + apoapsisAltitudeMeters
  const periapsisRadiusMeters = MOON_RADIUS + periapsisAltitudeMeters

  return (
    (apoapsisRadiusMeters - periapsisRadiusMeters) /
    (apoapsisRadiusMeters + periapsisRadiusMeters)
  )
}

export const calculateReachMoonOrbitQualityBreakdown = (
  metric: ReachMoonOrbitQualityMetric | null | undefined,
): ReachMoonOrbitQualityBreakdown => {
  if (!metric) {
    return {
      altitudeBonusPoints: 0,
      circularityBonusPoints: 0,
      eccentricity: null,
      riskPenaltyPoints: 0,
      totalPoints: 0,
    }
  }

  const apoapsisAltitudeMeters = clampFinite(metric.orbitApoapsisAltitudeMeters)
  const periapsisAltitudeMeters = clampFinite(
    metric.orbitPeriapsisAltitudeMeters,
  )
  const apoapsisRangeMeters =
    MOON_ORBIT_ZERO_BONUS_APOAPSIS_ALTITUDE_METERS -
    MOON_ORBIT_FULL_BONUS_APOAPSIS_ALTITUDE_METERS
  const apoapsisBonusPoints =
    apoapsisAltitudeMeters <= MOON_ORBIT_FULL_BONUS_APOAPSIS_ALTITUDE_METERS
      ? MOON_ORBIT_ALTITUDE_BONUS_MAX_POINTS
      : apoapsisAltitudeMeters >= MOON_ORBIT_ZERO_BONUS_APOAPSIS_ALTITUDE_METERS
        ? 0
        : MOON_ORBIT_ALTITUDE_BONUS_MAX_POINTS *
          (1 -
            (apoapsisAltitudeMeters -
              MOON_ORBIT_FULL_BONUS_APOAPSIS_ALTITUDE_METERS) /
              apoapsisRangeMeters)
  const periapsisRiskPenaltyPoints =
    periapsisAltitudeMeters >= MOON_ORBIT_SAFE_PERIAPSIS_ALTITUDE_METERS
      ? 0
      : -MOON_ORBIT_MAX_RISK_PENALTY_POINTS *
        (1 -
          periapsisAltitudeMeters / MOON_ORBIT_SAFE_PERIAPSIS_ALTITUDE_METERS)
  const eccentricity = calculateReachMoonOrbitEccentricity(metric)
  const circularityRange =
    MOON_ORBIT_ZERO_CIRCULARITY_ECCENTRICITY -
    MOON_ORBIT_FULL_CIRCULARITY_ECCENTRICITY
  const circularityBonusPoints =
    periapsisAltitudeMeters < MOON_ORBIT_SAFE_PERIAPSIS_ALTITUDE_METERS
      ? 0
      : eccentricity <= MOON_ORBIT_FULL_CIRCULARITY_ECCENTRICITY
        ? MOON_ORBIT_CIRCULARITY_BONUS_MAX_POINTS
        : eccentricity >= MOON_ORBIT_ZERO_CIRCULARITY_ECCENTRICITY
          ? 0
          : MOON_ORBIT_CIRCULARITY_BONUS_MAX_POINTS *
            (1 -
              (eccentricity - MOON_ORBIT_FULL_CIRCULARITY_ECCENTRICITY) /
                circularityRange)

  return {
    altitudeBonusPoints: roundScorePoints(apoapsisBonusPoints),
    circularityBonusPoints: roundScorePoints(circularityBonusPoints),
    eccentricity: roundEccentricity(eccentricity),
    riskPenaltyPoints: roundScorePoints(periapsisRiskPenaltyPoints),
    totalPoints: roundScorePoints(
      clampOrbitQualityPoints(
        apoapsisBonusPoints +
          circularityBonusPoints +
          periapsisRiskPenaltyPoints,
      ),
    ),
  }
}

export const calculateReachMoonOrbitQualityPoints = (
  metric: ReachMoonOrbitQualityMetric | null | undefined,
): number => calculateReachMoonOrbitQualityBreakdown(metric).totalPoints

export const formatReachMoonOrbitAltitude = (
  valueMeters: number | null | undefined,
): string => {
  if (valueMeters == null || !Number.isFinite(valueMeters)) {
    return 'No lunar orbit'
  }

  return formatDistance(Math.max(0, valueMeters))
}

export const formatReachMoonOrbitQualityContext = (
  metric: ReachMoonOrbitQualityMetric | null | undefined,
  score?: Pick<
    ReachMoonScoreSummary,
    'lunarOrbitCircularityPoints' | 'lunarOrbitEccentricity'
  >,
): string => {
  if (!metric) {
    return 'No close lunar orbit'
  }

  const altitudeContext = `Ap ${formatReachMoonOrbitAltitude(metric.orbitApoapsisAltitudeMeters)} / Pe ${formatReachMoonOrbitAltitude(metric.orbitPeriapsisAltitudeMeters)}`
  if (
    score?.lunarOrbitCircularityPoints == null &&
    score?.lunarOrbitEccentricity == null
  ) {
    return altitudeContext
  }

  const circularityBonusPoints = score.lunarOrbitCircularityPoints ?? 0
  if (
    metric.orbitPeriapsisAltitudeMeters <
    MOON_ORBIT_SAFE_PERIAPSIS_ALTITUDE_METERS
  ) {
    return `${altitudeContext} - too close`
  }
  if (circularityBonusPoints >= MOON_ORBIT_CIRCULARITY_BONUS_MAX_POINTS * 0.8) {
    return `${altitudeContext} - near circular`
  }
  if (circularityBonusPoints > 0) {
    return `${altitudeContext} - elongated`
  }

  return `${altitudeContext} - very elongated`
}

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
  lunarOrbitQuality?: ReachMoonOrbitQualityMetric | null
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
  const lunarOrbitQualityBreakdown = calculateReachMoonOrbitQualityBreakdown(
    input.lunarOrbitQuality,
  )
  const lunarOrbitQualityPoints = lunarOrbitQualityBreakdown.totalPoints

  return {
    baseScorePoints: REACH_MOON_BASE_SCORE_POINTS,
    fuelBonusPoints,
    fuelRemainingKg,
    lunarOrbitCircularityPoints:
      lunarOrbitQualityBreakdown.circularityBonusPoints,
    lunarOrbitEccentricity: lunarOrbitQualityBreakdown.eccentricity,
    lunarOrbitQuality: input.lunarOrbitQuality ?? null,
    lunarOrbitQualityPoints,
    missionElapsedSeconds,
    timePenaltyPoints,
    totalScore: roundScorePoints(
      fuelBonusPoints + timePenaltyPoints + lunarOrbitQualityPoints,
    ),
  }
}

export const calculateReachMoonMissionScore = (input: {
  fuelRemainingRatio: number
  lunarOrbitQuality?: ReachMoonOrbitQualityMetric | null
  missionElapsedSeconds: number
}): ReachMoonScoreSummary =>
  calculateReachMoonScore({
    fuelCapacityKg: REACH_MOON_FUEL_CAPACITY_KG,
    fuelRemainingRatio: input.fuelRemainingRatio,
    lunarOrbitQuality: input.lunarOrbitQuality,
    missionElapsedSeconds: input.missionElapsedSeconds,
  })

export const formatReachMoonScoreSummaryDisplay = (
  score: ReachMoonScoreSummary,
): ReachMoonScoreSummaryDisplay => ({
  fuelBonusPoints: formatScorePoints(score.fuelBonusPoints),
  fuelLeft: formatReachMoonFuelLeftPercent(score),
  lunarOrbitQualityAltitude: formatReachMoonOrbitQualityContext(
    score.lunarOrbitQuality,
    score,
  ),
  lunarOrbitQualityPoints: formatScorePoints(
    score.lunarOrbitQualityPoints ?? 0,
  ),
  missionElapsed: formatElapsed(score.missionElapsedSeconds),
  timeScorePoints: formatScorePoints(score.timePenaltyPoints),
  totalScore: formatScorePoints(score.totalScore),
})

export const formatReachMoonScoreSummary = (
  score: ReachMoonScoreSummary,
): string => {
  const display = formatReachMoonScoreSummaryDisplay(score)

  return `Score ${display.totalScore}. Time used ${display.missionElapsed} (+${display.timeScorePoints}). Fuel left ${display.fuelLeft} (+${display.fuelBonusPoints}). Lunar orbit ${display.lunarOrbitQualityAltitude} (${display.lunarOrbitQualityPoints}).`
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
