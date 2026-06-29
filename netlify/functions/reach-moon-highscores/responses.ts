import type {
  ApiErrorCode,
  ApiErrorResponse,
  LeaderboardResponse,
  SubmitResponse,
} from './types'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
}

const listCacheHeaders = {
  'cache-control': 'public, max-age=30, stale-while-revalidate=120',
  ...jsonHeaders,
}

const mutationHeaders = {
  'cache-control': 'no-store',
  ...jsonHeaders,
}

export const createErrorResponse = (
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): Response =>
  new Response(
    JSON.stringify({
      error: {
        code,
        ...(details === undefined ? {} : { details }),
        message,
      },
    } satisfies ApiErrorResponse),
    {
      headers: mutationHeaders,
      status,
    },
  )

export const createJsonResponse = (
  body: LeaderboardResponse | SubmitResponse,
  options: { cacheable?: boolean; status?: number } = {},
): Response =>
  new Response(JSON.stringify(body), {
    headers: options.cacheable ? listCacheHeaders : mutationHeaders,
    status: options.status ?? 200,
  })
