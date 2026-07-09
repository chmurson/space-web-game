export type MeasureFunction = <Result>(
  label: string,
  run: () => Result,
) => Result

type FunctionMeasurement = {
  calls: number
  maxMs: number
  totalMs: number
}

export const createMeasuredFunction = (options: {
  enabled: () => boolean
  reportIntervalMs?: number
  reportLabel: string
}): {
  measure: MeasureFunction
  report: () => void
} => {
  const measurements = new Map<string, FunctionMeasurement>()
  const reportIntervalMs = options.reportIntervalMs ?? 1_000
  let lastReportAt = 0

  const record = (label: string, durationMs: number) => {
    const measurement = measurements.get(label) ?? {
      calls: 0,
      maxMs: 0,
      totalMs: 0,
    }

    measurement.calls += 1
    measurement.maxMs = Math.max(measurement.maxMs, durationMs)
    measurement.totalMs += durationMs
    measurements.set(label, measurement)
  }

  const measure = <Result>(label: string, run: () => Result): Result => {
    if (!options.enabled()) {
      return run()
    }

    const startedAt = performance.now()
    const recordElapsed = () => record(label, performance.now() - startedAt)

    try {
      const result = run()

      if (
        result &&
        typeof (result as { finally?: unknown }).finally === 'function'
      ) {
        return (result as unknown as Promise<unknown>).finally(
          recordElapsed,
        ) as unknown as Result
      }

      recordElapsed()
      return result
    } catch (error) {
      recordElapsed()
      throw error
    }
  }

  const report = () => {
    if (!options.enabled() || measurements.size === 0) {
      return
    }

    const now = performance.now()
    if (now - lastReportAt < reportIntervalMs) {
      return
    }

    lastReportAt = now
    console.info(options.reportLabel)
    console.table(
      Array.from(measurements.entries())
        .map(([label, measurement]) => ({
          label,
          calls: measurement.calls,
          totalMs: Number(measurement.totalMs.toFixed(3)),
          avgMs: Number((measurement.totalMs / measurement.calls).toFixed(3)),
          maxMs: Number(measurement.maxMs.toFixed(3)),
        }))
        .sort((left, right) => right.totalMs - left.totalMs),
    )
    measurements.clear()
  }

  return { measure, report }
}
