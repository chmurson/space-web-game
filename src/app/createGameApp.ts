import { createAppComponents } from './createAppComponents'
import { createAppConfigContext } from './createAppConfigContext'
import { createInitialAppRuntimeState } from './createInitialAppRuntimeState'
import { loadScenarioAssets } from '../render/scenarioAssets'

const removeBootScreen = () => {
  const bootScreen = document.querySelector<HTMLElement>('[data-boot-screen]')
  if (!bootScreen) {
    return
  }

  bootScreen.dataset.hidden = 'true'
  window.setTimeout(() => {
    bootScreen.remove()
  }, 200)
}

export const createGameApp = async (app: HTMLDivElement) => {
  const config = createAppConfigContext()
  const runtimeState = createInitialAppRuntimeState(config)
  const startupAssets = await loadScenarioAssets(
    runtimeState.scenario.session.scenarioId,
  )

  const components = createAppComponents({
    app,
    config,
    runtimeState,
    startupAssets,
  })

  components.initialize()
  components.start()
  removeBootScreen()
}
