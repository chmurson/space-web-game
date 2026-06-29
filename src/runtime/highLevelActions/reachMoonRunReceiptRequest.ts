import type { ReachMoonRunReceipt } from '../../server/reachMoonRunReceipts'

export type ReachMoonRunReceiptRequester = () => Promise<ReachMoonRunReceipt>

const requestTimeoutMs = 8_000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isReachMoonRunReceipt = (
  value: unknown,
): value is ReachMoonRunReceipt => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.issuedAt === 'string' &&
    typeof value.runId === 'string' &&
    typeof value.scenarioId === 'string' &&
    typeof value.signature === 'string'
  )
}

export const requestReachMoonRunReceipt: ReachMoonRunReceiptRequester =
  async () => {
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, requestTimeoutMs)

    try {
      const response = await fetch('/api/reach-moon/run-receipt', {
        method: 'POST',
        signal: abortController.signal,
      })
      const body: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          isRecord(body) &&
          isRecord(body.error) &&
          typeof body.error.message === 'string'
            ? body.error.message
            : `Run receipt request failed (${response.status}).`

        throw new Error(message)
      }

      if (!isRecord(body) || !isReachMoonRunReceipt(body.runReceipt)) {
        throw new Error('Run receipt response was invalid.')
      }

      return body.runReceipt
    } finally {
      clearTimeout(timeoutId)
    }
  }
