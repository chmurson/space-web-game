export const REACH_MOON_RUN_RECEIPT_SCENARIO_ID = 'reach-moon'
export const REACH_MOON_RUN_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000

export type ReachMoonRunReceipt = {
  issuedAt: string
  runId: string
  scenarioId: string
  signature: string
}

export type ReachMoonRunReceiptValidationError = {
  code:
    | 'expired_receipt'
    | 'invalid_receipt'
    | 'invalid_signature'
    | 'missing_receipt'
    | 'wrong_scenario'
  field: 'runReceipt'
  message: string
}

export type ReachMoonRunReceiptValidationResult =
  | { ok: true; value: ReachMoonRunReceipt }
  | { errors: ReachMoonRunReceiptValidationError[]; ok: false }

type ReceiptPayload = Omit<ReachMoonRunReceipt, 'signature'>

const textEncoder = new TextEncoder()
const minRunReceiptSecretBytes = 32

const createError = (
  code: ReachMoonRunReceiptValidationError['code'],
  message: string,
): ReachMoonRunReceiptValidationError => ({
  code,
  field: 'runReceipt',
  message,
})

const invalid = (
  code: ReachMoonRunReceiptValidationError['code'],
  message: string,
): ReachMoonRunReceiptValidationResult => ({
  errors: [createError(code, message)],
  ok: false,
})

const ok = (
  value: ReachMoonRunReceipt,
): ReachMoonRunReceiptValidationResult => ({
  ok: true,
  value,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const toDateIso = (value: Date | string): string | null => {
  const date = value instanceof Date ? value : new Date(value)

  return Number.isFinite(date.valueOf()) ? date.toISOString() : null
}

const toDateMs = (value: Date | string): number | null => {
  const date = value instanceof Date ? value : new Date(value)
  const time = date.valueOf()

  return Number.isFinite(time) ? time : null
}

const ensureSecret = (secret: string) => {
  if (secret.trim().length === 0) {
    throw new RangeError('Run receipt secret is required.')
  }
  if (textEncoder.encode(secret).byteLength < minRunReceiptSecretBytes) {
    throw new RangeError(
      `Run receipt secret must be at least ${minRunReceiptSecretBytes} bytes.`,
    )
  }
}

const ensurePositiveTtl = (maxAgeMs: number) => {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    throw new RangeError('Run receipt maxAgeMs must be zero or greater.')
  }
}

const createReceiptPayload = (receipt: ReceiptPayload): string =>
  `${receipt.scenarioId}\n${receipt.issuedAt}\n${receipt.runId}`

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')
}

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> | null => {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    return bytes
  } catch {
    return null
  }
}

const importHmacKey = (secret: string, keyUsages: KeyUsage[]) =>
  crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    {
      hash: 'SHA-256',
      name: 'HMAC',
    },
    false,
    keyUsages,
  )

const signReceiptPayload = async (
  payload: ReceiptPayload,
  secret: string,
): Promise<string> => {
  ensureSecret(secret)

  const key = await importHmacKey(secret, ['sign'])
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(createReceiptPayload(payload)),
  )

  return toBase64Url(new Uint8Array(signature))
}

const verifyReceiptSignature = async (
  receipt: ReachMoonRunReceipt,
  secret: string,
): Promise<boolean> => {
  ensureSecret(secret)

  const signature = fromBase64Url(receipt.signature)
  if (signature == null) {
    return false
  }

  const key = await importHmacKey(secret, ['verify'])

  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    textEncoder.encode(createReceiptPayload(receipt)),
  )
}

const createRunId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : toBase64Url(crypto.getRandomValues(new Uint8Array(16)))

const readReceipt = (receipt: unknown): ReachMoonRunReceiptValidationResult => {
  if (receipt == null) {
    return invalid('missing_receipt', 'Run receipt is required.')
  }
  if (!isRecord(receipt)) {
    return invalid('invalid_receipt', 'Run receipt must be an object.')
  }

  const { issuedAt, runId, scenarioId, signature } = receipt
  if (
    typeof issuedAt !== 'string' ||
    typeof runId !== 'string' ||
    typeof scenarioId !== 'string' ||
    typeof signature !== 'string' ||
    issuedAt.length === 0 ||
    runId.length === 0 ||
    scenarioId.length === 0 ||
    signature.length === 0
  ) {
    return invalid(
      'invalid_receipt',
      'Run receipt must include scenarioId, issuedAt, runId, and signature.',
    )
  }

  return ok({
    issuedAt,
    runId,
    scenarioId,
    signature,
  })
}

export const createReachMoonRunReceipt = async (options: {
  issuedAt?: Date | string
  secret: string
}): Promise<ReachMoonRunReceipt> => {
  const issuedAt = toDateIso(options.issuedAt ?? new Date())
  if (issuedAt == null) {
    throw new RangeError('Run receipt issuedAt must be a date.')
  }

  const payload = {
    issuedAt,
    runId: createRunId(),
    scenarioId: REACH_MOON_RUN_RECEIPT_SCENARIO_ID,
  }

  return {
    ...payload,
    signature: await signReceiptPayload(payload, options.secret),
  }
}

export const validateReachMoonRunReceipt = async (
  receipt: unknown,
  options: {
    maxAgeMs?: number
    now?: Date | string
    secret: string
  },
): Promise<ReachMoonRunReceiptValidationResult> => {
  const parsed = readReceipt(receipt)
  if (!parsed.ok) {
    return parsed
  }

  const nowMs = toDateMs(options.now ?? new Date())
  if (nowMs == null) {
    throw new RangeError('Run receipt validation now must be a date.')
  }

  const issuedAtMs = toDateMs(parsed.value.issuedAt)
  if (issuedAtMs == null || issuedAtMs > nowMs) {
    return invalid('invalid_receipt', 'Run receipt issuedAt is invalid.')
  }

  const maxAgeMs = options.maxAgeMs ?? REACH_MOON_RUN_RECEIPT_TTL_MS
  ensurePositiveTtl(maxAgeMs)

  if (issuedAtMs + maxAgeMs < nowMs) {
    return invalid('expired_receipt', 'Run receipt has expired.')
  }

  if (parsed.value.scenarioId !== REACH_MOON_RUN_RECEIPT_SCENARIO_ID) {
    return invalid(
      'wrong_scenario',
      'Run receipt does not match this scenario.',
    )
  }

  if (!(await verifyReceiptSignature(parsed.value, options.secret))) {
    return invalid('invalid_signature', 'Run receipt signature is invalid.')
  }

  return parsed
}

export const validateReachMoonHighscoreSubmissionReceipt = async (
  input: unknown,
  options: Parameters<typeof validateReachMoonRunReceipt>[1],
): Promise<ReachMoonRunReceiptValidationResult> => {
  if (!isRecord(input)) {
    return invalid(
      'missing_receipt',
      'Highscore submission must include a run receipt.',
    )
  }

  return validateReachMoonRunReceipt(input.runReceipt, options)
}
