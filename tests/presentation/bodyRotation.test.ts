import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import {
  EARTH_CLOUD_DRIFT_SECONDS,
  EARTH_PRESENTATION_TILT_DEGREES,
  EARTH_PRESENTATION_TILT_RADIANS,
  EARTH_VISUAL_DAY_SECONDS,
  getBodyVisualRotationY,
  getEarthCloudDriftRotationY,
  getEarthVisualRotationY,
  getTidallyLockedMoonRotationY,
  setBodyVisualQuaternion,
} from '@/presentation/bodyRotation'
import type { Body } from '@/simulation/types'

const createBody = (id: string, position: { x: number; y: number }): Body => ({
  id,
  name: id,
  mass: 1,
  radius: 1,
  position,
  velocity: { x: 0, y: 0 },
  color: '#ffffff',
})

const expectMoonNearSideTowardEarth = (input: { earth: Body; moon: Body }) => {
  const rotationY = getTidallyLockedMoonRotationY(input)
  const expectedX = input.earth.position.x - input.moon.position.x
  const expectedZ = input.earth.position.y - input.moon.position.y
  const expectedLength = Math.hypot(expectedX, expectedZ)

  expect(Math.cos(rotationY)).toBeCloseTo(expectedX / expectedLength)
  expect(-Math.sin(rotationY)).toBeCloseTo(expectedZ / expectedLength)
}

const getEarthNorthAxis = (elapsedSeconds: number) => {
  const earth = createBody('earth', { x: 0, y: 0 })
  const quaternion = new THREE.Quaternion()
  setBodyVisualQuaternion(quaternion, {
    bodies: [earth],
    body: earth,
    elapsedSeconds,
  })

  return new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)
}

describe('bodyRotation', () => {
  it('uses an approximately real 24-hour Earth day for visual spin', () => {
    expect(EARTH_VISUAL_DAY_SECONDS).toBe(24 * 60 * 60)
  })

  it('uses a slower relative drift cycle for Earth clouds', () => {
    expect(EARTH_CLOUD_DRIFT_SECONDS).toBe(EARTH_VISUAL_DAY_SECONDS * 5)
    expect(getEarthCloudDriftRotationY(0)).toBe(0)
    expect(
      getEarthCloudDriftRotationY(EARTH_CLOUD_DRIFT_SECONDS / 2),
    ).toBeCloseTo(Math.PI)
    expect(getEarthCloudDriftRotationY(EARTH_CLOUD_DRIFT_SECONDS)).toBeCloseTo(
      0,
    )
  })

  it('derives Earth spin from elapsed simulation time', () => {
    expect(getEarthVisualRotationY(0)).toBe(0)
    expect(getEarthVisualRotationY(EARTH_VISUAL_DAY_SECONDS / 2)).toBeCloseTo(
      Math.PI,
    )
    expect(getEarthVisualRotationY(EARTH_VISUAL_DAY_SECONDS)).toBeCloseTo(0)
  })

  it('tilts the Earth north pole away from the camera-side plane direction', () => {
    const northAxis = getEarthNorthAxis(0)

    expect(EARTH_PRESENTATION_TILT_DEGREES).toBe(23.5)
    expect(northAxis.y).toBeCloseTo(Math.cos(EARTH_PRESENTATION_TILT_RADIANS))
    expect(Math.hypot(northAxis.x, northAxis.z)).toBeCloseTo(
      Math.sin(EARTH_PRESENTATION_TILT_RADIANS),
    )
    expect(northAxis.x).toBeLessThan(0)
    expect(northAxis.z).toBeLessThan(0)
    expect(northAxis.x).toBeCloseTo(northAxis.z)
  })

  it('keeps the fixed Earth tilt stable while visual spin advances', () => {
    const initialNorthAxis = getEarthNorthAxis(0)
    const spunNorthAxis = getEarthNorthAxis(EARTH_VISUAL_DAY_SECONDS / 4)

    expect(spunNorthAxis.x).toBeCloseTo(initialNorthAxis.x)
    expect(spunNorthAxis.y).toBeCloseTo(initialNorthAxis.y)
    expect(spunNorthAxis.z).toBeCloseTo(initialNorthAxis.z)
  })

  it('orients the Moon texture center toward Earth in the simulation plane', () => {
    const earth = createBody('earth', { x: 0, y: 0 })

    expect(
      Math.abs(
        getTidallyLockedMoonRotationY({
          earth,
          moon: createBody('moon', { x: 10, y: 0 }),
        }),
      ),
    ).toBeCloseTo(Math.PI)
    expect(
      getTidallyLockedMoonRotationY({
        earth,
        moon: createBody('moon', { x: 0, y: 10 }),
      }),
    ).toBeCloseTo(Math.PI / 2)
  })

  it('points the Moon local +X texture-center axis at Earth', () => {
    const earth = createBody('earth', { x: -2, y: 3 })

    expectMoonNearSideTowardEarth({
      earth,
      moon: createBody('moon', { x: 10, y: 0 }),
    })
    expectMoonNearSideTowardEarth({
      earth,
      moon: createBody('moon', { x: 2, y: -8 }),
    })
  })

  it('keeps default orientation when the Moon has no Earth reference', () => {
    expect(
      getTidallyLockedMoonRotationY({
        earth: undefined,
        moon: createBody('moon', { x: 10, y: 0 }),
      }),
    ).toBe(0)
  })

  it('selects per-body rotation without mutating body state', () => {
    const earth = createBody('earth', { x: 0, y: 0 })
    const moon = createBody('moon', { x: 0, y: 10 })
    const asteroid = createBody('asteroid', { x: 5, y: 5 })
    const bodies = [earth, moon, asteroid]

    expect(
      getBodyVisualRotationY({
        bodies,
        body: earth,
        elapsedSeconds: EARTH_VISUAL_DAY_SECONDS / 4,
      }),
    ).toBeCloseTo(Math.PI / 2)
    expect(
      getBodyVisualRotationY({
        bodies,
        body: moon,
        elapsedSeconds: 0,
      }),
    ).toBeCloseTo(Math.PI / 2)
    expect(
      getBodyVisualRotationY({
        bodies,
        body: asteroid,
        elapsedSeconds: EARTH_VISUAL_DAY_SECONDS,
      }),
    ).toBe(0)
    expect(moon.position).toEqual({ x: 0, y: 10 })
  })
})
