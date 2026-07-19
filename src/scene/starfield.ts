import * as THREE from 'three'

export type Starfield = {
  getLayerDebugInfo(): Array<{
    layerIndex: number
    opacityPercent: number
  }>
  group: THREE.Group
  update(options: {
    cameraTarget: THREE.Vector3
    preserveWorldPosition?: boolean
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
  parallaxFactor: number
  seed: number
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
  sizeScaleAttribute: THREE.BufferAttribute | null
  visibleKey: string | null
}

const baseStarfieldOpacity = 0.75
const baseStarfieldParallaxFactor = 0.03
const baseStarSizePixels = 2
const minimumStarSizeScale = 0.5
const minStarfieldBrightness = 0.24
const maxStarfieldBrightness = 0.64

const starfieldLayerConfigs: StarfieldLayerConfig[] = [
  {
    backgroundY: -0.2,
    chunkSize: 4,
    extraStarsPerChunk: 3,
    fadeOutEndViewport: 24,
    fadeOutStartViewport: 8,
    parallaxFactor: baseStarfieldParallaxFactor * 0.2,
    seed: 0x6d2b79f5,
    starsPerChunk: 4,
  },
  {
    backgroundY: -0.2,
    chunkSize: 6,
    extraStarsPerChunk: 2,
    fadeOutEndViewport: 100,
    fadeOutStartViewport: 16,
    parallaxFactor: baseStarfieldParallaxFactor * 0.2,
    seed: 0x27d4eb2d,
    starsPerChunk: 1,
  },
  {
    backgroundY: -0.3,
    chunkSize: 10,
    extraStarsPerChunk: 2,
    fadeOutEndViewport: 160,
    fadeOutStartViewport: 80,
    parallaxFactor: baseStarfieldParallaxFactor * 0.4,
    seed: 0x165667b1,
    starsPerChunk: 1,
  },
  {
    backgroundY: -0.4,
    chunkSize: 36,
    extraStarsPerChunk: 2,
    fadeOutEndViewport: 520,
    fadeOutStartViewport: 130,
    parallaxFactor: baseStarfieldParallaxFactor * 0.8,
    seed: 0xd3a2646c,
    starsPerChunk: 2,
  },
  {
    backgroundY: -0.6,
    chunkSize: 150,
    extraStarsPerChunk: 2,
    fadeOutEndViewport: 2_100,
    fadeOutStartViewport: 350,
    parallaxFactor: baseStarfieldParallaxFactor * 0.6,
    seed: 0x41c64e6d,
    starsPerChunk: 5,
  },
  {
    backgroundY: -0.8,
    chunkSize: 260,
    extraStarsPerChunk: 1,
    fadeOutEndViewport: 2_400,
    fadeOutStartViewport: 1_500,
    parallaxFactor: baseStarfieldParallaxFactor,
    seed: 0x9e3779b9,
    starsPerChunk: 3,
  },
  {
    backgroundY: -1,
    chunkSize: 420,
    extraStarsPerChunk: 1,
    parallaxFactor: baseStarfieldParallaxFactor * 0.6,
    seed: 0x85ebca6b,
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
  baseStarfieldOpacity * getFadeOutMultiplier(config, viewportSize)

const setStarAppearance = (
  colors: Float32Array,
  sizeScales: Float32Array,
  config: StarfieldLayerConfig,
  chunkX: number,
  chunkZ: number,
  starIndex: number,
  offset: number,
) => {
  const brightnessProgress = hash01(config.seed, chunkX, chunkZ, starIndex, 4)
  const brightness = THREE.MathUtils.lerp(
    minStarfieldBrightness,
    maxStarfieldBrightness,
    brightnessProgress,
  )
  sizeScales[offset / 3] = THREE.MathUtils.lerp(
    minimumStarSizeScale,
    1,
    brightnessProgress,
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
  if (
    layer.positionAttribute &&
    layer.colorAttribute &&
    layer.sizeScaleAttribute
  ) {
    return
  }

  const capacity = getLayerCapacity(layer.config)
  const positions = new Float32Array(capacity * 3)
  const colors = new Float32Array(capacity * 3)
  const sizeScales = new Float32Array(capacity)
  const positionAttribute = new THREE.BufferAttribute(positions, 3)
  const colorAttribute = new THREE.BufferAttribute(colors, 3)
  const sizeScaleAttribute = new THREE.BufferAttribute(sizeScales, 1)
  positionAttribute.setUsage(THREE.DynamicDrawUsage)
  colorAttribute.setUsage(THREE.DynamicDrawUsage)
  sizeScaleAttribute.setUsage(THREE.DynamicDrawUsage)

  layer.capacity = capacity
  layer.positionAttribute = positionAttribute
  layer.colorAttribute = colorAttribute
  layer.sizeScaleAttribute = sizeScaleAttribute
  layer.geometry.setAttribute('position', positionAttribute)
  layer.geometry.setAttribute('color', colorAttribute)
  layer.geometry.setAttribute('starSizeScale', sizeScaleAttribute)
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
  const sizeScaleAttribute = layer.sizeScaleAttribute
  const positions = positionAttribute?.array
  const colors = colorAttribute?.array
  const sizeScales = sizeScaleAttribute?.array
  if (
    !positionAttribute ||
    !colorAttribute ||
    !sizeScaleAttribute ||
    !(positions instanceof Float32Array) ||
    !(colors instanceof Float32Array) ||
    !(sizeScales instanceof Float32Array)
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
        setStarAppearance(
          colors,
          sizeScales,
          config,
          chunkX,
          chunkZ,
          starIndex,
          offset,
        )
        starCount += 1
      }
    }
  }

  layer.geometry.setDrawRange(0, starCount)
  positionAttribute.needsUpdate = true
  colorAttribute.needsUpdate = true
  sizeScaleAttribute.needsUpdate = true
  layer.visibleKey = visibleKey
}

const createStarfieldLayer = (
  config: StarfieldLayerConfig,
): StarfieldLayerState => {
  const geometry = new THREE.BufferGeometry()
  const material = new THREE.PointsMaterial({
    depthTest: true,
    depthWrite: false,
    opacity: baseStarfieldOpacity,
    size: baseStarSizePixels,
    sizeAttenuation: false,
    transparent: true,
    vertexColors: true,
  })
  material.toneMapped = false
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        'uniform float size;',
        'uniform float size;\nattribute float starSizeScale;',
      )
      .replace('gl_PointSize = size;', 'gl_PointSize = size * starSizeScale;')
  }

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
    sizeScaleAttribute: null,
    visibleKey: null,
  }
}

export const createStarfield = (): Starfield => {
  const group = new THREE.Group()
  group.name = 'starfield'
  group.renderOrder = -100

  const layers = starfieldLayerConfigs.map(createStarfieldLayer)
  let hasCameraTarget = false
  let parallaxTargetX = 0
  let parallaxTargetZ = 0
  let previousTargetX = 0
  let previousTargetZ = 0
  group.add(...layers.map((layer) => layer.group))

  return {
    getLayerDebugInfo: () =>
      layers.flatMap((layer, layerIndex) =>
        layer.group.visible
          ? [
              {
                layerIndex,
                opacityPercent: Math.round(layer.material.opacity * 1_000) / 10,
              },
            ]
          : [],
      ),
    group,
    update: (options) => {
      const targetX = options.cameraTarget.x
      const targetZ = options.cameraTarget.z
      if (!hasCameraTarget) {
        hasCameraTarget = true
        parallaxTargetX = targetX
        parallaxTargetZ = targetZ
      } else if (!options.preserveWorldPosition) {
        parallaxTargetX += targetX - previousTargetX
        parallaxTargetZ += targetZ - previousTargetZ
      }
      previousTargetX = targetX
      previousTargetZ = targetZ

      for (const layer of layers) {
        const { config } = layer
        const rawOpacity = getLayerOpacity(config, options.viewportSize)
        const opacity =
          rawOpacity <= minimumVisibleLayerOpacity ? 0 : rawOpacity
        const groupX = parallaxTargetX * (1 - config.parallaxFactor)
        const groupZ = parallaxTargetZ * (1 - config.parallaxFactor)
        const centerX = targetX - groupX
        const centerZ = targetZ - groupZ

        layer.material.opacity = opacity
        layer.group.visible = opacity > 0

        if (opacity <= 0) {
          continue
        }

        layer.group.position.set(groupX, config.backgroundY, groupZ)
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
