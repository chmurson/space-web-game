import * as THREE from 'three'

import earthTextureUrl from '../assets/bodies/earth-stylized.webp'
import moonTextureUrl from '../assets/bodies/moon-stylized.webp'

export type ScenarioAssets = {
  bodyDiffuseTextures: ReadonlyMap<string, THREE.Texture>
}

type BodyDiffuseTextureAsset = {
  bodyId: string
  key: string
  url: string
}

const bodyDiffuseTextureAssets: Record<string, BodyDiffuseTextureAsset> = {
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

const defaultBodyDiffuseTextureIds = ['earth', 'moon'] as const

const scenarioBodyDiffuseTextureIds: Record<string, readonly string[]> = {
  'earth-moon': defaultBodyDiffuseTextureIds,
  'menu-background': ['earth'],
  'moon-capture-debug': defaultBodyDiffuseTextureIds,
  'reach-moon': defaultBodyDiffuseTextureIds,
  'debug-snapshot': defaultBodyDiffuseTextureIds,
  tutorial: defaultBodyDiffuseTextureIds,
}

const textureLoadPromises = new Map<string, Promise<THREE.Texture | null>>()

const getBodyDiffuseTextureAssetsForScenario = (
  scenarioId: string,
): BodyDiffuseTextureAsset[] => {
  const ids =
    scenarioBodyDiffuseTextureIds[scenarioId] ?? defaultBodyDiffuseTextureIds

  return ids
    .map((id) => bodyDiffuseTextureAssets[id])
    .filter((asset): asset is BodyDiffuseTextureAsset => Boolean(asset))
}

const loadTextureAsset = (
  asset: BodyDiffuseTextureAsset,
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
  getBodyDiffuseTextureAssetsForScenario(scenarioId).every((asset) =>
    textureLoadPromises.has(asset.key),
  )

export const loadScenarioAssets = async (
  scenarioId: string,
): Promise<ScenarioAssets> => {
  const bodyTextureEntries = await Promise.all(
    getBodyDiffuseTextureAssetsForScenario(scenarioId).map(
      async (asset): Promise<[string, THREE.Texture | null]> => [
        asset.bodyId,
        await loadTextureAsset(asset),
      ],
    ),
  )
  const bodyDiffuseTextures = new Map<string, THREE.Texture>()

  for (const [bodyId, texture] of bodyTextureEntries) {
    if (texture) {
      bodyDiffuseTextures.set(bodyId, texture)
    }
  }

  return { bodyDiffuseTextures }
}
