import { reachMoonHighscorePeriods } from '../../../src/scenario/specific-scenarios/reachMoonHighscores'
import { createErrorResponse, createJsonResponse } from './responses'
import { buildLeaderboardResponse, getHighscoreStore } from './storage'
import { getRequestedPeriods } from './validation'

export const handleGet = async (
  request: Request,
  now: Date,
): Promise<Response> => {
  const periodSelection = getRequestedPeriods(request)
  if (!periodSelection.ok) {
    return createErrorResponse(
      400,
      'invalid_period',
      'Unsupported highscore period.',
      { supportedPeriods: reachMoonHighscorePeriods },
    )
  }

  try {
    return createJsonResponse(
      await buildLeaderboardResponse(
        getHighscoreStore(),
        periodSelection.periods,
        now,
      ),
      { cacheable: true },
    )
  } catch {
    return createErrorResponse(
      503,
      'storage_error',
      'Highscore storage is unavailable.',
    )
  }
}
