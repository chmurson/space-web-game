export const bindDevicePixelRatioChanges = (options: {
  onChange(): void
  windowTarget: Pick<Window, 'devicePixelRatio' | 'matchMedia'>
}) => {
  let activeMediaQuery: MediaQueryList | null = null
  let disposed = false

  const bindCurrentPixelRatio = () => {
    activeMediaQuery?.removeEventListener('change', handleChange)
    activeMediaQuery = options.windowTarget.matchMedia(
      `(resolution: ${options.windowTarget.devicePixelRatio}dppx)`,
    )
    activeMediaQuery.addEventListener('change', handleChange)
  }

  const handleChange = () => {
    options.onChange()
    if (!disposed) {
      bindCurrentPixelRatio()
    }
  }

  bindCurrentPixelRatio()

  return () => {
    disposed = true
    activeMediaQuery?.removeEventListener('change', handleChange)
    activeMediaQuery = null
  }
}
