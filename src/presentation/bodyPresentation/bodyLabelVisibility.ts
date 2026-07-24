const bodyLabelIntroDurationMs = 3_000
const bodyLabelSmallEnterRadiusPx = 6
const bodyLabelSmallExitRadiusPx = 8

type BodyLabelVisibilityState = {
  enteredAtMs: number
  onscreen: boolean
  small: boolean
}

export const createBodyLabelVisibility = () => {
  const states = new Map<string, BodyLabelVisibilityState>()

  return (options: {
    apparentRadiusPx: number
    bodyId: string
    nowMs: number
    onscreen: boolean
  }) => {
    let state = states.get(options.bodyId)
    if (!state) {
      state = {
        enteredAtMs: Number.NEGATIVE_INFINITY,
        onscreen: false,
        small: false,
      }
      states.set(options.bodyId, state)
    }

    if (state.small) {
      state.small = options.apparentRadiusPx <= bodyLabelSmallExitRadiusPx
    } else {
      state.small = options.apparentRadiusPx <= bodyLabelSmallEnterRadiusPx
    }

    if (!options.onscreen) {
      state.onscreen = false
      return false
    }

    if (!state.onscreen) {
      state.enteredAtMs = options.nowMs
    }
    state.onscreen = true

    return (
      state.small ||
      options.nowMs < state.enteredAtMs + bodyLabelIntroDurationMs
    )
  }
}
