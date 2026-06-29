import { createReachMoonRunReceipt } from '../../src/server/reachMoonRunReceipts'
import { createErrorResponse } from './reach-moon-highscores/responses'
import {
  getEnvValue,
  receiptSecretEnvName,
} from './reach-moon-highscores/validation'

const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
}

export const config = {
  path: [
    '/api/reach-moon/run-receipt',
    '/.netlify/functions/reach-moon-run-receipt',
  ],
  rateLimit: {
    aggregateBy: ['ip', 'domain'],
    windowLimit: 60,
    windowSize: 60,
  },
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    const response = createErrorResponse(
      405,
      'method_not_allowed',
      'Use POST to issue a Reach the Moon run receipt.',
    )
    response.headers.set('allow', 'POST')
    return response
  }

  const receiptSecret = getEnvValue(receiptSecretEnvName)
  if (!receiptSecret) {
    return createErrorResponse(
      500,
      'missing_receipt_secret',
      `${receiptSecretEnvName} is required before run receipts can be issued.`,
    )
  }

  const runReceipt = await createReachMoonRunReceipt({
    secret: receiptSecret,
  }).catch((error: unknown) => {
    if (error instanceof RangeError) {
      return createErrorResponse(
        500,
        'invalid_receipt_secret',
        `${receiptSecretEnvName} is invalid.`,
      )
    }

    throw error
  })
  if (runReceipt instanceof Response) {
    return runReceipt
  }

  return new Response(JSON.stringify({ runReceipt }), {
    headers: jsonHeaders,
    status: 201,
  })
}
