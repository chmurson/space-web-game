import type { TrajectoryPredictionImplementation } from '../prediction/trajectoryPrediction'

export type DeveloperFeatureFlags = {
  noHorizonLimit: boolean
  trajectoryPredictionImplementation: TrajectoryPredictionImplementation
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

  if (flags.trajectoryPredictionImplementation === 'kepler') {
    url.searchParams.set('trajectoryPrediction', 'kepler')
  } else {
    url.searchParams.delete('trajectoryPrediction')
  }

  window.location.assign(url.toString())
}
