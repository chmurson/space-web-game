const activeTargetFullLabelDurationMs = 3_000

export const createActiveTargetLabelVisibility = () => {
  let activeTargetId: string | null = null
  let fullLabelUntilMs = Number.NEGATIVE_INFINITY

  return (nextActiveTargetId: string | null, nowMs: number) => {
    if (nextActiveTargetId !== activeTargetId) {
      activeTargetId = nextActiveTargetId
      fullLabelUntilMs = nowMs + activeTargetFullLabelDurationMs
    }

    return nextActiveTargetId !== null && nowMs < fullLabelUntilMs
  }
}
