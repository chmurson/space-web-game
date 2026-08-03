import * as THREE from 'three'

import earthCloudTextureUrl from '../assets/bodies/earth-clouds.webp'
import earthTextureUrl from '../assets/bodies/earth-stylized.webp'
import moonTextureUrl from '../assets/bodies/moon-stylized.webp'

export type ScenarioAssets = {
  bodyCloudTextures: ReadonlyMap<string, THREE.Texture>
  bodyDiffuseTextures: ReadonlyMap<string, THREE.Texture>
}

type BodyTextureAsset = {
  bodyId: string
  key: string
  url: string
}

const bodyDiffuseTextureAssets: Record<string, BodyTextureAsset> = {
  earth: {
    bodyId: 'earth',
    key: 'body.earth.diffuse',
    url: earthTextureUrl,
  },
  moon: {
    bodyId: 'moon',
    key: 'body.moon.diffuse',
    url: moonTextureUrl,
  },
}

const bodyCloudTextureAssets: Record<string, BodyTextureAsset> = {
  earth: {
    bodyId: 'earth',
    key: 'body.earth.clouds',
    url: earthCloudTextureUrl,
  },
}

const defaultBodyDiffuseTextureIds = ['earth', 'moon'] as const

const scenarioBodyDiffuseTextureIds: Record<string, readonly string[]> = {
  'earth-moon': defaultBodyDiffuseTextureIds,
  'menu-background': ['earth'],
  'menu-background-kepler': ['earth'],
  'moon-capture-debug': defaultBodyDiffuseTextureIds,
  'reach-moon': defaultBodyDiffuseTextureIds,
  'debug-snapshot': defaultBodyDiffuseTextureIds,
  tutorial: defaultBodyDiffuseTextureIds,
}

const textureLoadPromises = new Map<string, Promise<THREE.Texture | null>>()

const getBodyTextureAssetsForScenario = (
  scenarioId: string,
  textureAssets: Record<string, BodyTextureAsset>,
): BodyTextureAsset[] => {
  const ids =
    scenarioBodyDiffuseTextureIds[scenarioId] ?? defaultBodyDiffuseTextureIds

  return ids
    .map((id) => textureAssets[id])
    .filter((asset): asset is BodyTextureAsset => Boolean(asset))
}

const getScenarioTextureAssets = (scenarioId: string) => [
  ...getBodyTextureAssetsForScenario(scenarioId, bodyDiffuseTextureAssets),
  ...getBodyTextureAssetsForScenario(scenarioId, bodyCloudTextureAssets),
]

const loadTextureAsset = (
  asset: BodyTextureAsset,
): Promise<THREE.Texture | null> => {
  const cached = textureLoadPromises.get(asset.key)
  if (cached) {
    return cached
  }

  const promise = new Promise<THREE.Texture | null>((resolve) => {
    new THREE.TextureLoader().load(
      asset.url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        resolve(texture)
      },
      undefined,
      () => {
        queueMicrotask(() => {
          textureLoadPromises.delete(asset.key)
        })
        resolve(null)
      },
    )
  })

  textureLoadPromises.set(asset.key, promise)
  return promise
}

export const areScenarioAssetsCached = (scenarioId: string) =>
  getScenarioTextureAssets(scenarioId).every((asset) =>
    textureLoadPromises.has(asset.key),
  )

export const loadScenarioAssets = async (
  scenarioId: string,
): Promise<ScenarioAssets> => {
  const bodyTextureEntries = await Promise.all(
    getBodyTextureAssetsForScenario(scenarioId, bodyDiffuseTextureAssets).map(
      async (asset): Promise<[string, THREE.Texture | null]> => [
        asset.bodyId,
        await loadTextureAsset(asset),
      ],
    ),
  )
  const bodyCloudTextureEntries = await Promise.all(
    getBodyTextureAssetsForScenario(scenarioId, bodyCloudTextureAssets).map(
      async (asset): Promise<[string, THREE.Texture | null]> => [
        asset.bodyId,
        await loadTextureAsset(asset),
      ],
    ),
  )
  const bodyDiffuseTextures = new Map<string, THREE.Texture>()
  const bodyCloudTextures = new Map<string, THREE.Texture>()

  for (const [bodyId, texture] of bodyTextureEntries) {
    if (texture) {
      bodyDiffuseTextures.set(bodyId, texture)
    }
  }

  for (const [bodyId, texture] of bodyCloudTextureEntries) {
    if (texture) {
      bodyCloudTextures.set(bodyId, texture)
    }
  }

  return { bodyCloudTextures, bodyDiffuseTextures }
}
