import { describe, expect, it } from 'vitest'

import {
  apoapsisInfoPin,
  createBodyInfoPin,
  getInfoPinKey,
  normalizeInfoPins,
  periapsisInfoPin,
  toggleInfoPin,
} from '@/runtime/infoPins'

describe('infoPins', () => {
  it('normalizes valid unique pins and rejects unavailable bodies', () => {
    expect(
      normalizeInfoPins(
        [
          createBodyInfoPin('earth'),
          createBodyInfoPin('earth'),
          createBodyInfoPin('missing'),
          periapsisInfoPin,
          { apsis: 'invalid', kind: 'apsis' },
          null,
        ],
        new Set(['earth']),
      ).map(getInfoPinKey),
    ).toEqual(['body:earth', 'periapsis'])
  })

  it('toggles immutable player pin collections', () => {
    const initial = [createBodyInfoPin('earth')]
    const added = toggleInfoPin(initial, apoapsisInfoPin)
    const removed = toggleInfoPin(added, createBodyInfoPin('earth'))

    expect(initial.map(getInfoPinKey)).toEqual(['body:earth'])
    expect(added.map(getInfoPinKey)).toEqual(['body:earth', 'apoapsis'])
    expect(removed.map(getInfoPinKey)).toEqual(['apoapsis'])
  })
})
