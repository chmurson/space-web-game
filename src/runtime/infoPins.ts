export type BodyInfoPin = {
  bodyId: string
  kind: 'body'
}

export type ApsisInfoPin = {
  apsis: 'apoapsis' | 'periapsis'
  kind: 'apsis'
}

export type InfoPin = BodyInfoPin | ApsisInfoPin

export const apoapsisInfoPin: ApsisInfoPin = {
  apsis: 'apoapsis',
  kind: 'apsis',
}

export const periapsisInfoPin: ApsisInfoPin = {
  apsis: 'periapsis',
  kind: 'apsis',
}

export const createBodyInfoPin = (bodyId: string): BodyInfoPin => ({
  bodyId,
  kind: 'body',
})

export const getInfoPinKey = (pin: InfoPin) =>
  pin.kind === 'body' ? `body:${pin.bodyId}` : pin.apsis

export const isSameInfoPin = (first: InfoPin, second: InfoPin) =>
  getInfoPinKey(first) === getInfoPinKey(second)

export const includesInfoPin = (pins: readonly InfoPin[], pin: InfoPin) =>
  pins.some((candidate) => isSameInfoPin(candidate, pin))

export const isInfoPin = (value: unknown): value is InfoPin => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<InfoPin>
  if (candidate.kind === 'body') {
    return (
      'bodyId' in candidate &&
      typeof candidate.bodyId === 'string' &&
      candidate.bodyId.length > 0
    )
  }

  return (
    candidate.kind === 'apsis' &&
    'apsis' in candidate &&
    (candidate.apsis === 'apoapsis' || candidate.apsis === 'periapsis')
  )
}

export const normalizeInfoPins = (
  value: unknown,
  availableBodyIds?: ReadonlySet<string>,
): InfoPin[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const keys = new Set<string>()
  const pins: InfoPin[] = []
  for (const candidate of value) {
    if (!isInfoPin(candidate)) {
      continue
    }
    if (
      candidate.kind === 'body' &&
      availableBodyIds &&
      !availableBodyIds.has(candidate.bodyId)
    ) {
      continue
    }

    const key = getInfoPinKey(candidate)
    if (keys.has(key)) {
      continue
    }

    keys.add(key)
    pins.push({ ...candidate })
  }

  return pins
}

export const toggleInfoPin = (
  pins: readonly InfoPin[],
  pin: InfoPin,
): InfoPin[] =>
  includesInfoPin(pins, pin)
    ? pins.filter((candidate) => !isSameInfoPin(candidate, pin))
    : [...pins, { ...pin }]
