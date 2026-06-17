import * as THREE from 'three'

export type Starfield = {
  group: THREE.Group
  update(options: {
    cameraTarget: THREE.Vector3
    viewportHeight: number
    viewportSize: number
    viewportWidth: number
  }): void
}

type StarfieldLayerConfig = {
  backgroundY: number
  chunkSize: number
  extraStarsPerChunk: number
  fadeInEndViewport?: number
  fadeInStartViewport?: number
  fadeOutEndViewport?: number
  fadeOutStartViewport?: number
  maxBrightness: number
  minBrightness: number
  opacity: number
  parallaxFactor: number
  seed: number
  sizePixels: number
  starsPerChunk: number
}

type StarfieldLayerState = {
  config: StarfieldLayerConfig
  geometry: THREE.BufferGeometry
  group: THREE.Group
  material: THREE.PointsMaterial
  visibleKey: string | null
}

const starfieldLayerConfigs: StarfieldLayerConfig[] = [
  {
    backgroundY: -0.2,
    chunkSize: 1.2,
    extraStarsPerChunk: 3,
    fadeOutEndViewport: 24,
    fadeOutStartViewport: 8,
    maxBrightness: 0.64,
    minBrightness: 0.24,
    opacity: 0.4,
    parallaxFactor: 0.006,
    seed: 0x27d4eb2d,
    sizePixels: 0.62,
    starsPerChunk: 4,
  },
  {
    backgroundY: -0.3,
    chunkSize: 2.8,
    extraStarsPerChunk: 2,
    fadeOutEndViewport: 110,
    fadeOutStartViewport: 40,
    maxBrightness: 0.58,
    minBrightness: 0.22,
    opacity: 0.32,
    parallaxFactor: 0.012,
    seed: 0x165667b1,
    sizePixels: 0.7,
    starsPerChunk: 3,
  },
  {
    backgroundY: -0.4,
    chunkSize: 12,
    extraStarsPerChunk: 2,
    fadeInEndViewport: 75,
    fadeInStartViewport: 35,
    fadeOutEndViewport: 360,
    fadeOutStartViewport: 150,
    maxBrightness: 0.6,
    minBrightness: 0.22,
    opacity: 0.3,
    parallaxFactor: 0.024,
    seed: 0xd3a2646c,
    sizePixels: 0.85,
    starsPerChunk: 2,
  },
  {
    backgroundY: -0.6,
    chunkSize: 150,
    extraStarsPerChunk: 2,
    fadeInEndViewport: 90,
    fadeInStartViewport: 45,
    fadeOutEndViewport: 2_100,
    fadeOutStartViewport: 900,
    maxBrightness: 0.62,
    minBrightness: 0.24,
    opacity: 0.36,
    parallaxFactor: 0.018,
    seed: 0x41c64e6d,
    sizePixels: 0.95,
    starsPerChunk: 5,
  },
  {
    backgroundY: -0.8,
    chunkSize: 260,
    extraStarsPerChunk: 1,
    fadeInEndViewport: 500,
    fadeInStartViewport: 220,
    fadeOutEndViewport: 1_600,
    fadeOutStartViewport: 900,
    maxBrightness: 0.62,
    minBrightness: 0.25,
    opacity: 0.3,
    parallaxFactor: 0.03,
    seed: 0x9e3779b9,
    sizePixels: 1.1,
    starsPerChunk: 3,
  },
  {
    backgroundY: -1,
    chunkSize: 420,
    extraStarsPerChunk: 1,
    fadeInEndViewport: 1_100,
    fadeInStartViewport: 600,
    maxBrightness: 0.64,
    minBrightness: 0.28,
    opacity: 0.28,
    parallaxFactor: 0.018,
    seed: 0x85ebca6b,
    sizePixels: 1.25,
    starsPerChunk: 2,
  },
]

const hashInt = (input: number) => {
  let value = input | 0
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

const hashCoords = (...values: number[]) =>
  values.reduce(
    (hash, value) => hashInt(hash + Math.imul(value | 0, 0x9e3779b1)),
    0x5f3759df,
  )

const hash01 = (...values: number[]) => hashCoords(...values) / 0x1_0000_0000

const clampColor = (value: number) => THREE.MathUtils.clamp(value, 0, 1)

const smoothstep = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

const getFadeInMultiplier = (
  config: StarfieldLayerConfig,
  viewportSize: number,
) => {
  if (
    config.fadeInStartViewport === undefined ||
    config.fadeInEndViewport === undefined
  ) {
    return 1
  }

  if (viewportSize <= config.fadeInStartViewport) {
    return 0
  }

  if (viewportSize >= config.fadeInEndViewport) {
    return 1
  }

  const fadeProgress =
    (viewportSize - config.fadeInStartViewport) /
    (config.fadeInEndViewport - config.fadeInStartViewport)
  return smoothstep(fadeProgress)
}

const getFadeOutMultiplier = (
  config: StarfieldLayerConfig,
  viewportSize: number,
) => {
  if (
    config.fadeOutStartViewport === undefined ||
    config.fadeOutEndViewport === undefined
  ) {
    return 1
  }

  if (viewportSize <= config.fadeOutStartViewport) {
    return 1
  }

  if (viewportSize >= config.fadeOutEndViewport) {
    return 0
  }

  const fadeProgress =
    (viewportSize - config.fadeOutStartViewport) /
    (config.fadeOutEndViewport - config.fadeOutStartViewport)
  return 1 - smoothstep(fadeProgress)
}

const getLayerOpacity = (config: StarfieldLayerConfig, viewportSize: number) =>
  config.opacity *
  getFadeInMultiplier(config, viewportSize) *
  getFadeOutMultiplier(config, viewportSize)

const pushStarColor = (
  colors: number[],
  config: StarfieldLayerConfig,
  chunkX: number,
  chunkZ: number,
  starIndex: number,
) => {
  const brightness = THREE.MathUtils.lerp(
    config.minBrightness,
    config.maxBrightness,
    hash01(config.seed, chunkX, chunkZ, starIndex, 4),
  )
  const temperature = hash01(config.seed, chunkX, chunkZ, starIndex, 5) * 2 - 1
  const warm = Math.max(temperature, 0)
  const cool = Math.max(-temperature, 0)

  colors.push(
    clampColor(brightness * (0.9 + warm * 0.16)),
    clampColor(brightness * (0.94 + (1 - Math.abs(temperature)) * 0.06)),
    clampColor(brightness * (1.02 + cool * 0.18 - warm * 0.05)),
  )
}

const getVisibleRadius = (options: {
  chunkSize: number
  viewportHeight: number
  viewportSize: number
  viewportWidth: number
}) => {
  const aspect =
    options.viewportHeight <= 0
      ? 1
      : options.viewportWidth / options.viewportHeight
  const halfWidth = options.viewportSize * Math.max(aspect, 1) * 0.5
  const halfHeight = options.viewportSize * 0.5

  return (
    Math.hypot(halfWidth, halfHeight) + options.viewportSize + options.chunkSize
  )
}

const getVisibleChunkRange = (options: {
  center: number
  chunkSize: number
  radius: number
}) => ({
  max: Math.floor((options.center + options.radius) / options.chunkSize),
  min: Math.floor((options.center - options.radius) / options.chunkSize),
})

const buildLayerGeometry = (
  layer: StarfieldLayerState,
  options: {
    centerX: number
    centerZ: number
    viewportHeight: number
    viewportSize: number
    viewportWidth: number
  },
) => {
  const { config } = layer
  const radius = getVisibleRadius({
    chunkSize: config.chunkSize,
    viewportHeight: options.viewportHeight,
    viewportSize: options.viewportSize,
    viewportWidth: options.viewportWidth,
  })
  const chunkRangeX = getVisibleChunkRange({
    center: options.centerX,
    chunkSize: config.chunkSize,
    radius,
  })
  const chunkRangeZ = getVisibleChunkRange({
    center: options.centerZ,
    chunkSize: config.chunkSize,
    radius,
  })
  const visibleKey = [
    chunkRangeX.min,
    chunkRangeX.max,
    chunkRangeZ.min,
    chunkRangeZ.max,
  ].join(':')

  if (visibleKey === layer.visibleKey) {
    return
  }

  const positions: number[] = []
  const colors: number[] = []

  for (let chunkX = chunkRangeX.min; chunkX <= chunkRangeX.max; chunkX += 1) {
    for (let chunkZ = chunkRangeZ.min; chunkZ <= chunkRangeZ.max; chunkZ += 1) {
      const starCount =
        config.starsPerChunk +
        Math.floor(
          hash01(config.seed, chunkX, chunkZ, 0) *
            (config.extraStarsPerChunk + 1),
        )

      for (let starIndex = 0; starIndex < starCount; starIndex += 1) {
        positions.push(
          (chunkX + hash01(config.seed, chunkX, chunkZ, starIndex, 1)) *
            config.chunkSize,
          0,
          (chunkZ + hash01(config.seed, chunkX, chunkZ, starIndex, 2)) *
            config.chunkSize,
        )
        pushStarColor(colors, config, chunkX, chunkZ, starIndex)
      }
    }
  }

  layer.geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  layer.geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3),
  )
  layer.geometry.computeBoundingSphere()
  layer.visibleKey = visibleKey
}

const createStarfieldLayer = (
  config: StarfieldLayerConfig,
): StarfieldLayerState => {
  const geometry = new THREE.BufferGeometry()
  const material = new THREE.PointsMaterial({
    depthTest: true,
    depthWrite: false,
    opacity: config.opacity,
    size: config.sizePixels,
    sizeAttenuation: false,
    transparent: true,
    vertexColors: true,
  })
  material.toneMapped = false

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false

  const group = new THREE.Group()
  group.position.y = config.backgroundY
  group.renderOrder = -100
  group.add(points)

  return {
    config,
    geometry,
    group,
    material,
    visibleKey: null,
  }
}

export const createStarfield = (): Starfield => {
  const group = new THREE.Group()
  group.name = 'starfield'
  group.renderOrder = -100

  const layers = starfieldLayerConfigs.map(createStarfieldLayer)
  group.add(...layers.map((layer) => layer.group))

  return {
    group,
    update: (options) => {
      const targetX = options.cameraTarget.x
      const targetZ = options.cameraTarget.z

      for (const layer of layers) {
        const { config } = layer
        const opacity = getLayerOpacity(config, options.viewportSize)
        const centerX = targetX * config.parallaxFactor
        const centerZ = targetZ * config.parallaxFactor

        layer.material.opacity = opacity
        layer.group.visible = opacity > 0

        if (opacity <= 0) {
          continue
        }

        layer.group.position.set(
          targetX * (1 - config.parallaxFactor),
          config.backgroundY,
          targetZ * (1 - config.parallaxFactor),
        )
        buildLayerGeometry(layer, {
          centerX,
          centerZ,
          viewportHeight: options.viewportHeight,
          viewportSize: options.viewportSize,
          viewportWidth: options.viewportWidth,
        })
      }
    },
  }
}
