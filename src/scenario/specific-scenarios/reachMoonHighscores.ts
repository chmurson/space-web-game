import {
  calculateReachMoonMissionScore,
  type ReachMoonOrbitQualityMetric,
  type ReachMoonScoreSummary,
} from './reachMoonScore'

export const REACH_MOON_HIGHSCORE_PLAYER_NAME_MIN_LENGTH = 2
export const REACH_MOON_HIGHSCORE_PLAYER_NAME_MAX_LENGTH = 32

export const reachMoonHighscorePeriods = [
  'daily',
  'weekly',
  'all-time',
] as const

export type ReachMoonHighscorePeriod =
  (typeof reachMoonHighscorePeriods)[number]

export type ReachMoonHighscoreSubmitInput = {
  fuelRemainingRatio: number
  lunarOrbitQuality?: ReachMoonOrbitQualityMetric | null
  missionElapsedSeconds: number
  playerName?: string | null
}

export type NormalizedReachMoonHighscoreSubmitInput = {
  fuelRemainingRatio: number
  lunarOrbitQuality: ReachMoonOrbitQualityMetric | null
  missionElapsedSeconds: number
  playerName: string
}

export type ReachMoonHighscoreRecord = {
  id: string
  playerName: string
  score: ReachMoonScoreSummary
  submittedAt: string
}

export type RankedReachMoonHighscoreRecord = ReachMoonHighscoreRecord & {
  rank: number
}

export type ReachMoonHighscoreRollup = {
  entries: RankedReachMoonHighscoreRecord[]
  generatedAt: string
  period: ReachMoonHighscorePeriod
}

export type ReachMoonHighscoreRollups = Partial<
  Record<ReachMoonHighscorePeriod, ReachMoonHighscoreRollup>
>

export type ReachMoonHighscoreListResponse = {
  rollups: ReachMoonHighscoreRollups
}

export type ReachMoonHighscoreSubmitResponse = {
  record: ReachMoonHighscoreRecord
  rollups: ReachMoonHighscoreRollups
}

export const selectReachMoonHighscoreDisplayPeriod = (
  rollups: ReachMoonHighscoreRollups,
  fallbackPeriod: ReachMoonHighscorePeriod = 'daily',
): ReachMoonHighscorePeriod =>
  reachMoonHighscorePeriods.find(
    (period) => (rollups[period]?.entries.length ?? 0) > 0,
  ) ?? fallbackPeriod

export type ReachMoonHighscoreValidationError = {
  code:
    | 'invalid_date'
    | 'invalid_type'
    | 'out_of_range'
    | 'required'
    | 'too_long'
    | 'too_short'
  field:
    | 'fuelRemainingRatio'
    | 'input'
    | 'lunarOrbitQuality'
    | 'missionElapsedSeconds'
    | 'orbitApoapsisAltitudeMeters'
    | 'orbitPeriapsisAltitudeMeters'
    | 'playerName'
    | 'submittedAt'
  message: string
}

export type ReachMoonHighscoreValidationResult<T> =
  | { ok: true; value: T }
  | { errors: ReachMoonHighscoreValidationError[]; ok: false }

const fallbackNamePrefixes = [
  'Vostok',
  'Mercury',
  'Gemini',
  'Apollo',
  'Soyuz',
  'Salyut',
  'Skylab',
  'Shuttle',
  'Mir',
  'Artemis',
] as const

const fallbackNameRoles = [
  'Pilot',
  'Navigator',
  'Commander',
  'Ranger',
  'Voyager',
  'Engineer',
  'Pathfinder',
  'Orbiter',
  'Explorer',
  'Scout',
] as const

const createError = (
  field: ReachMoonHighscoreValidationError['field'],
  code: ReachMoonHighscoreValidationError['code'],
  message: string,
): ReachMoonHighscoreValidationError => ({ code, field, message })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const ok = <T>(value: T): ReachMoonHighscoreValidationResult<T> => ({
  ok: true,
  value,
})

const invalid = <T>(
  errors: ReachMoonHighscoreValidationError[],
): ReachMoonHighscoreValidationResult<T> => ({
  errors,
  ok: false,
})

const getRandomIndex = (randomValue: number, length: number) => {
  const clamped = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999_999_999)
    : 0

  return Math.floor(clamped * length)
}

export const generateReachMoonFallbackPilotName = (
  random: () => number = Math.random,
): string => {
  const prefix =
    fallbackNamePrefixes[getRandomIndex(random(), fallbackNamePrefixes.length)]
  const role =
    fallbackNameRoles[getRandomIndex(random(), fallbackNameRoles.length)]

  return `${prefix} ${role}`
}

const validatePlayerName = (
  value: unknown,
  random: () => number,
): ReachMoonHighscoreValidationResult<string> => {
  if (value == null) {
    return ok(generateReachMoonFallbackPilotName(random))
  }

  if (typeof value !== 'string') {
    return invalid([
      createError('playerName', 'invalid_type', 'Player name must be text.'),
    ])
  }

  const playerName = value.trim()
  if (playerName.length === 0) {
    return ok(generateReachMoonFallbackPilotName(random))
  }
  if (playerName.length < REACH_MOON_HIGHSCORE_PLAYER_NAME_MIN_LENGTH) {
    return invalid([
      createError(
        'playerName',
        'too_short',
        `Player name must be at least ${REACH_MOON_HIGHSCORE_PLAYER_NAME_MIN_LENGTH} characters.`,
      ),
    ])
  }
  if (playerName.length > REACH_MOON_HIGHSCORE_PLAYER_NAME_MAX_LENGTH) {
    return invalid([
      createError(
        'playerName',
        'too_long',
        `Player name must be at most ${REACH_MOON_HIGHSCORE_PLAYER_NAME_MAX_LENGTH} characters.`,
      ),
    ])
  }

  return ok(playerName)
}

const validateNumber = (
  field:
    | 'fuelRemainingRatio'
    | 'missionElapsedSeconds'
    | 'orbitApoapsisAltitudeMeters'
    | 'orbitPeriapsisAltitudeMeters',
  value: unknown,
  options: { max?: number; min: number },
): ReachMoonHighscoreValidationResult<number> => {
  if (value === undefined) {
    return invalid([createError(field, 'required', `${field} is required.`)])
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return invalid([
      createError(field, 'invalid_type', `${field} must be a finite number.`),
    ])
  }
  if (value < options.min || (options.max != null && value > options.max)) {
    const range =
      options.max == null
        ? `at least ${options.min}`
        : `between ${options.min} and ${options.max}`

    return invalid([
      createError(field, 'out_of_range', `${field} must be ${range}.`),
    ])
  }

  return ok(value)
}

const validateOptionalLunarOrbitQuality = (
  value: unknown,
): ReachMoonHighscoreValidationResult<ReachMoonOrbitQualityMetric | null> => {
  if (value == null) {
    return ok(null)
  }
  if (!isRecord(value)) {
    return invalid([
      createError(
        'lunarOrbitQuality',
        'invalid_type',
        'lunarOrbitQuality must be an object.',
      ),
    ])
  }

  const apoapsis = validateNumber(
    'orbitApoapsisAltitudeMeters',
    value.orbitApoapsisAltitudeMeters,
    { min: 0 },
  )
  const periapsis = validateNumber(
    'orbitPeriapsisAltitudeMeters',
    value.orbitPeriapsisAltitudeMeters,
    { min: 0 },
  )
  if (!apoapsis.ok || !periapsis.ok) {
    return invalid([
      ...(!apoapsis.ok ? apoapsis.errors : []),
      ...(!periapsis.ok ? periapsis.errors : []),
    ])
  }
  if (apoapsis.value < periapsis.value) {
    return invalid([
      createError(
        'orbitApoapsisAltitudeMeters',
        'out_of_range',
        'orbitApoapsisAltitudeMeters must be greater than or equal to orbitPeriapsisAltitudeMeters.',
      ),
    ])
  }

  return ok({
    orbitApoapsisAltitudeMeters: Math.round(apoapsis.value),
    orbitPeriapsisAltitudeMeters: Math.round(periapsis.value),
  })
}

const toDateIso = (value: Date | string): string | null => {
  const date = value instanceof Date ? value : new Date(value)

  return Number.isFinite(date.valueOf()) ? date.toISOString() : null
}

export const parseReachMoonHighscorePeriod = (
  value: unknown,
): ReachMoonHighscorePeriod | null =>
  typeof value === 'string' &&
  (reachMoonHighscorePeriods as readonly string[]).includes(value)
    ? (value as ReachMoonHighscorePeriod)
    : null

export const validateReachMoonHighscoreSubmitInput = (
  input: unknown,
  options: { random?: () => number } = {},
): ReachMoonHighscoreValidationResult<NormalizedReachMoonHighscoreSubmitInput> => {
  if (!isRecord(input)) {
    return invalid([
      createError(
        'input',
        'invalid_type',
        'Highscore input must be an object.',
      ),
    ])
  }

  const errors: ReachMoonHighscoreValidationError[] = []
  const playerName = validatePlayerName(
    input.playerName,
    options.random ?? Math.random,
  )
  const fuelRemainingRatio = validateNumber(
    'fuelRemainingRatio',
    input.fuelRemainingRatio,
    {
      max: 1,
      min: 0,
    },
  )
  const missionElapsedSeconds = validateNumber(
    'missionElapsedSeconds',
    input.missionElapsedSeconds,
    {
      min: 0,
    },
  )
  const lunarOrbitQuality = validateOptionalLunarOrbitQuality(
    input.lunarOrbitQuality,
  )

  if (
    !playerName.ok ||
    !fuelRemainingRatio.ok ||
    !missionElapsedSeconds.ok ||
    !lunarOrbitQuality.ok
  ) {
    if (!playerName.ok) {
      errors.push(...playerName.errors)
    }
    if (!fuelRemainingRatio.ok) {
      errors.push(...fuelRemainingRatio.errors)
    }
    if (!missionElapsedSeconds.ok) {
      errors.push(...missionElapsedSeconds.errors)
    }
    if (!lunarOrbitQuality.ok) {
      errors.push(...lunarOrbitQuality.errors)
    }

    return invalid(errors)
  }

  return ok({
    fuelRemainingRatio: fuelRemainingRatio.value,
    lunarOrbitQuality: lunarOrbitQuality.value,
    missionElapsedSeconds: Math.round(missionElapsedSeconds.value),
    playerName: playerName.value,
  })
}

export const createReachMoonHighscoreRecord = (
  input: unknown,
  options: {
    id: string
    random?: () => number
    submittedAt?: Date | string
  },
): ReachMoonHighscoreValidationResult<ReachMoonHighscoreRecord> => {
  const submittedAt = toDateIso(options.submittedAt ?? new Date())
  if (submittedAt == null) {
    return invalid([
      createError('submittedAt', 'invalid_date', 'submittedAt must be a date.'),
    ])
  }

  const normalized = validateReachMoonHighscoreSubmitInput(input, {
    random: options.random,
  })
  if (!normalized.ok) {
    return normalized
  }

  return ok({
    id: options.id,
    playerName: normalized.value.playerName,
    score: calculateReachMoonMissionScore({
      fuelRemainingRatio: normalized.value.fuelRemainingRatio,
      lunarOrbitQuality: normalized.value.lunarOrbitQuality,
      missionElapsedSeconds: normalized.value.missionElapsedSeconds,
    }),
    submittedAt,
  })
}

export const compareReachMoonHighscoreRecords = (
  left: ReachMoonHighscoreRecord,
  right: ReachMoonHighscoreRecord,
): number =>
  right.score.totalScore - left.score.totalScore ||
  left.score.missionElapsedSeconds - right.score.missionElapsedSeconds ||
  Date.parse(left.submittedAt) - Date.parse(right.submittedAt)

export const rankReachMoonHighscoreRecords = (
  records: readonly ReachMoonHighscoreRecord[],
): RankedReachMoonHighscoreRecord[] =>
  [...records]
    .sort(compareReachMoonHighscoreRecords)
    .map((record, index) => ({ ...record, rank: index + 1 }))

export const createReachMoonHighscoreRollup = (
  period: ReachMoonHighscorePeriod,
  records: readonly ReachMoonHighscoreRecord[],
  generatedAt: Date | string = new Date(),
): ReachMoonHighscoreRollup => {
  const generatedAtIso = toDateIso(generatedAt)
  if (generatedAtIso == null) {
    throw new RangeError('generatedAt must be a date.')
  }

  return {
    entries: rankReachMoonHighscoreRecords(records),
    generatedAt: generatedAtIso,
    period,
  }
}
