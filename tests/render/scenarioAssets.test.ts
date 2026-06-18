import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadScenarioAssetModule = async () => {
  vi.resetModules()
  return import('@/render/scenarioAssets')
}

const createLoadedTexture = () => new THREE.Texture({} as HTMLImageElement)

describe('scenarioAssets', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads only the menu background body texture for the boot menu', async () => {
    const loadTexture = vi
      .spyOn(THREE.TextureLoader.prototype, 'load')
      .mockImplementation((_url, onLoad) => {
        const texture = createLoadedTexture()
        onLoad?.(texture)
        return texture
      })
    const { areScenarioAssetsCached, loadScenarioAssets } =
      await loadScenarioAssetModule()

    expect(areScenarioAssetsCached('menu-background')).toBe(false)
    const assets = await loadScenarioAssets('menu-background')

    expect(loadTexture).toHaveBeenCalledTimes(1)
    expect(assets.bodyDiffuseTextures.has('earth')).toBe(true)
    expect(assets.bodyDiffuseTextures.has('moon')).toBe(false)
    expect(areScenarioAssetsCached('menu-background')).toBe(true)
    expect(areScenarioAssetsCached('earth-moon')).toBe(false)
  })

  it('reuses cached texture promises for concurrent scenario loads', async () => {
    const loadTexture = vi
      .spyOn(THREE.TextureLoader.prototype, 'load')
      .mockImplementation((_url, onLoad) => {
        const texture = createLoadedTexture()
        setTimeout(() => onLoad?.(texture), 0)
        return texture
      })
    const { loadScenarioAssets } = await loadScenarioAssetModule()

    await Promise.all([
      loadScenarioAssets('tutorial'),
      loadScenarioAssets('earth-moon'),
      loadScenarioAssets('reach-moon'),
    ])

    expect(loadTexture).toHaveBeenCalledTimes(2)
  })

  it('loads Earth and Moon body textures for Reach the Moon', async () => {
    const loadTexture = vi
      .spyOn(THREE.TextureLoader.prototype, 'load')
      .mockImplementation((_url, onLoad) => {
        const texture = createLoadedTexture()
        onLoad?.(texture)
        return texture
      })
    const { areScenarioAssetsCached, loadScenarioAssets } =
      await loadScenarioAssetModule()

    const assets = await loadScenarioAssets('reach-moon')

    expect(loadTexture).toHaveBeenCalledTimes(2)
    expect(assets.bodyDiffuseTextures.has('earth')).toBe(true)
    expect(assets.bodyDiffuseTextures.has('moon')).toBe(true)
    expect(areScenarioAssetsCached('reach-moon')).toBe(true)
  })

  it('resolves with fallback assets when a texture fails', async () => {
    let loadCount = 0
    const loadTexture = vi
      .spyOn(THREE.TextureLoader.prototype, 'load')
      .mockImplementation((_url, onLoad, _onProgress, onError) => {
        const texture = createLoadedTexture()
        loadCount += 1
        if (loadCount === 2) {
          onError?.(new Error('missing texture'))
          return texture
        }

        onLoad?.(texture)
        return texture
      })
    const { areScenarioAssetsCached, loadScenarioAssets } =
      await loadScenarioAssetModule()

    const assets = await loadScenarioAssets('tutorial')

    expect(loadTexture).toHaveBeenCalledTimes(2)
    expect(assets.bodyDiffuseTextures.has('earth')).toBe(true)
    expect(assets.bodyDiffuseTextures.has('moon')).toBe(false)
    expect(areScenarioAssetsCached('tutorial')).toBe(false)
  })
})
