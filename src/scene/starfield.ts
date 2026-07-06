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
  colorAttribute: THREE.BufferAttribute | null
  config: StarfieldLayerConfig
  capacity: number
  geometry: THREE.BufferGeometry
  group: THREE.Group
  material: THREE.PointsMaterial
  positionAttribute: THREE.BufferAttribute | null
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
    opacity: 0.36,
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
    opacity: 0.28,
    parallaxFactor: 0.012,
    seed: 0x165667b1,
    sizePixels: 0.7,
    starsPerChunk: 3,
  },
  {
    backgroundY: -0.4,
    chunkSize: 12,
    extraStarsPerChunk: 2,
    fadeOutEndViewport: 420,
    fadeOutStartViewport: 180,
    maxBrightness: 0.6,
    minBrightness: 0.22,
    opacity: 0.22,
    parallaxFactor: 0.024,
    seed: 0xd3a2646c,
    sizePixels: 0.85,
    starsPerChunk: 2,
  },
  {
    backgroundY: -0.6,
    chunkSize: 150,
    extraStarsPerChunk: 2,
    fadeOutEndViewport: 2_100,
    fadeOutStartViewport: 900,
    maxBrightness: 0.62,
    minBrightness: 0.24,
    opacity: 0.28,
    parallaxFactor: 0.018,
    seed: 0x41c64e6d,
    sizePixels: 0.95,
    starsPerChunk: 5,
  },
  {
    backgroundY: -0.8,
    chunkSize: 260,
    extraStarsPerChunk: 1,
    fadeOutEndViewport: 1_800,
    fadeOutStartViewport: 900,
    maxBrightness: 0.62,
    minBrightness: 0.25,
    opacity: 0.18,
    parallaxFactor: 0.03,
    seed: 0x9e3779b9,
    sizePixels: 1.1,
    starsPerChunk: 3,
  },
  {
    backgroundY: -1,
    chunkSize: 420,
    extraStarsPerChunk: 1,
    maxBrightness: 0.64,
    minBrightness: 0.28,
    opacity: 0.16,
    parallaxFactor: 0.018,
    seed: 0x85ebca6b,
    sizePixels: 1.25,
    starsPerChunk: 2,
  },
]

const minimumVisibleLayerOpacity = 0.02
const maxStarfieldViewportSize = 2_500
const maxStarfieldViewportAspectRatio = 4

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
  config.opacity * getFadeOutMultiplier(config, viewportSize)

const setStarColor = (
  colors: Float32Array,
  config: StarfieldLayerConfig,
  chunkX: number,
  chunkZ: number,
  starIndex: number,
  offset: number,
) => {
  const brightness = THREE.MathUtils.lerp(
    config.minBrightness,
    config.maxBrightness,
    hash01(config.seed, chunkX, chunkZ, starIndex, 4),
  )
  const temperature = hash01(config.seed, chunkX, chunkZ, starIndex, 5) * 2 - 1
  const warm = Math.max(temperature, 0)
  const cool = Math.max(-temperature, 0)

  colors[offset] = clampColor(brightness * (0.9 + warm * 0.16))
  colors[offset + 1] = clampColor(
    brightness * (0.94 + (1 - Math.abs(temperature)) * 0.06),
  )
  colors[offset + 2] = clampColor(
    brightness * (1.02 + cool * 0.18 - warm * 0.05),
  )
}

const getVisibleRadius = (options: {
  chunkSize: number
  viewportHeight: number
  viewportSize: number
  viewportWidth: number
}) => {
  const rawAspect =
    options.viewportHeight <= 0
      ? 1
      : options.viewportWidth / options.viewportHeight
  const aspect = THREE.MathUtils.clamp(
    rawAspect,
    1,
    maxStarfieldViewportAspectRatio,
  )
  const halfWidth = options.viewportSize * aspect * 0.5
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

const getLayerCapacity = (config: StarfieldLayerConfig) => {
  const viewportSize = config.fadeOutEndViewport ?? maxStarfieldViewportSize
  const radius = getVisibleRadius({
    chunkSize: config.chunkSize,
    viewportHeight: 1,
    viewportSize,
    viewportWidth: maxStarfieldViewportAspectRatio,
  })
  const chunkRange = getVisibleChunkRange({
    center: 0,
    chunkSize: config.chunkSize,
    radius,
  })
  const chunkCount = (chunkRange.max - chunkRange.min + 1) ** 2

  return chunkCount * (config.starsPerChunk + config.extraStarsPerChunk)
}

const ensureLayerAttributes = (layer: StarfieldLayerState) => {
  if (layer.positionAttribute && layer.colorAttribute) {
    return
  }

  const capacity = getLayerCapacity(layer.config)
  const positions = new Float32Array(capacity * 3)
  const colors = new Float32Array(capacity * 3)
  const positionAttribute = new THREE.BufferAttribute(positions, 3)
  const colorAttribute = new THREE.BufferAttribute(colors, 3)
  positionAttribute.setUsage(THREE.DynamicDrawUsage)
  colorAttribute.setUsage(THREE.DynamicDrawUsage)

  layer.capacity = capacity
  layer.positionAttribute = positionAttribute
  layer.colorAttribute = colorAttribute
  layer.geometry.setAttribute('position', positionAttribute)
  layer.geometry.setAttribute('color', colorAttribute)
}

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

  const chunkCount =
    (chunkRangeX.max - chunkRangeX.min + 1) *
    (chunkRangeZ.max - chunkRangeZ.min + 1)
  ensureLayerAttributes(layer)

  const positionAttribute = layer.positionAttribute
  const colorAttribute = layer.colorAttribute
  const positions = positionAttribute?.array
  const colors = colorAttribute?.array
  if (
    !positionAttribute ||
    !colorAttribute ||
    !(positions instanceof Float32Array) ||
    !(colors instanceof Float32Array)
  ) {
    return
  }
  if (
    chunkCount * (config.starsPerChunk + config.extraStarsPerChunk) >
    layer.capacity
  ) {
    return
  }

  let starCount = 0

  for (let chunkX = chunkRangeX.min; chunkX <= chunkRangeX.max; chunkX += 1) {
    for (let chunkZ = chunkRangeZ.min; chunkZ <= chunkRangeZ.max; chunkZ += 1) {
      const chunkStarCount =
        config.starsPerChunk +
        Math.floor(
          hash01(config.seed, chunkX, chunkZ, 0) *
            (config.extraStarsPerChunk + 1),
        )

      for (let starIndex = 0; starIndex < chunkStarCount; starIndex += 1) {
        const offset = starCount * 3
        positions[offset] =
          (chunkX + hash01(config.seed, chunkX, chunkZ, starIndex, 1)) *
          config.chunkSize
        positions[offset + 1] = 0
        positions[offset + 2] =
          (chunkZ + hash01(config.seed, chunkX, chunkZ, starIndex, 2)) *
          config.chunkSize
        setStarColor(colors, config, chunkX, chunkZ, starIndex, offset)
        starCount += 1
      }
    }
  }

  layer.geometry.setDrawRange(0, starCount)
  positionAttribute.needsUpdate = true
  colorAttribute.needsUpdate = true
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
    colorAttribute: null,
    config,
    capacity: 0,
    geometry,
    group,
    material,
    positionAttribute: null,
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
        const rawOpacity = getLayerOpacity(config, options.viewportSize)
        const opacity =
          rawOpacity <= minimumVisibleLayerOpacity ? 0 : rawOpacity
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
