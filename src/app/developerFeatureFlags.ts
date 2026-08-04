export type DeveloperFeatureFlags = {
  noHorizonLimit: boolean
}

export const isDeveloperFeatureFlagsMenuEnabled = () => {
  if (typeof window === 'undefined') return false

  const localHostnames = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  const isLocalEnvironment = localHostnames.has(window.location.hostname)
  const devtoolsQueryEnabled =
    new URLSearchParams(window.location.search).get('devtools') === '1'

  return isLocalEnvironment || devtoolsQueryEnabled
}

export const writeDeveloperFeatureFlagsToUrl = (
  flags: DeveloperFeatureFlags,
) => {
  const url = new URL(window.location.href)

  if (flags.noHorizonLimit) url.searchParams.set('nohiroznlimit', '1')
  else url.searchParams.delete('nohiroznlimit')

  url.searchParams.delete('trajectoryPrediction')

  window.location.assign(url.toString())
}
