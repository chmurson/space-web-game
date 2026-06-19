import type { Body } from '../simulation/types'

const FULL_ROTATION_RADIANS = Math.PI * 2

export const EARTH_VISUAL_DAY_SECONDS = 24 * 60 * 60
export const EARTH_CLOUD_DRIFT_SECONDS = EARTH_VISUAL_DAY_SECONDS * 5

const wrapPositiveRadians = (radians: number) => {
  const wrapped = radians % FULL_ROTATION_RADIANS
  return wrapped < 0 ? wrapped + FULL_ROTATION_RADIANS : wrapped
}

export const getEarthVisualRotationY = (elapsedSeconds: number) =>
  wrapPositiveRadians(
    (elapsedSeconds / EARTH_VISUAL_DAY_SECONDS) * FULL_ROTATION_RADIANS,
  )

export const getEarthCloudDriftRotationY = (elapsedSeconds: number) =>
  wrapPositiveRadians(
    (elapsedSeconds / EARTH_CLOUD_DRIFT_SECONDS) * FULL_ROTATION_RADIANS,
  )

export const getTidallyLockedMoonRotationY = (input: {
  earth: Body | undefined
  moon: Body
}) => {
  if (!input.earth) {
    return 0
  }

  const towardEarthX = input.earth.position.x - input.moon.position.x
  // Simulation `y` maps to Three.js render `z` through `renderPosition`.
  const towardEarthRenderZ = input.earth.position.y - input.moon.position.y

  if (towardEarthX === 0 && towardEarthRenderZ === 0) {
    return 0
  }

  return Math.atan2(-towardEarthRenderZ, towardEarthX)
}

export const getBodyVisualRotationY = (input: {
  bodies: Body[]
  body: Body
  elapsedSeconds: number
}) => {
  if (input.body.id === 'earth') {
    return getEarthVisualRotationY(input.elapsedSeconds)
  }

  if (input.body.id === 'moon') {
    return getTidallyLockedMoonRotationY({
      earth: input.bodies.find((body) => body.id === 'earth'),
      moon: input.body,
    })
  }

  return 0
}
