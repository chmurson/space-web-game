import {
  parseReachMoonHighscorePeriod,
  reachMoonHighscorePeriods,
  type ReachMoonHighscorePeriod,
} from '../../../src/scenario/specific-scenarios/reachMoonHighscores'
import type { JsonBodyResult } from './types'

export const receiptSecretEnvName = 'REACH_MOON_RUN_RECEIPT_SECRET'

export const getEnvValue = (name: string): string | undefined =>
  (
    globalThis as {
      process?: { env?: Record<string, string | undefined> }
    }
  ).process?.env?.[name]

export const getRequestedPeriods = (
  request: Request,
): { ok: true; periods: ReachMoonHighscorePeriod[] } | { ok: false } => {
  const requestedPeriod = new URL(request.url).searchParams.get('period')
  if (requestedPeriod == null || requestedPeriod.length === 0) {
    return { ok: true, periods: [...reachMoonHighscorePeriods] }
  }

  const parsed = parseReachMoonHighscorePeriod(requestedPeriod)
  return parsed == null ? { ok: false } : { ok: true, periods: [parsed] }
}

export const readJsonBody = async (
  request: Request,
): Promise<JsonBodyResult> => {
  const body = await request.text()
  if (body.trim().length === 0) {
    return {
      code: 'missing_body',
      message: 'POST body must be a JSON object.',
      ok: false,
      status: 400,
    }
  }

  try {
    return { ok: true, value: JSON.parse(body) }
  } catch {
    return {
      code: 'invalid_json',
      message: 'POST body must be valid JSON.',
      ok: false,
      status: 400,
    }
  }
}
