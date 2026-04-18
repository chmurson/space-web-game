import { createAppComponents } from './createAppComponents'
import { createAppConfigContext } from './createAppConfigContext'
import { createInitialAppRuntimeState } from './createInitialAppRuntimeState'

export const createGameApp = (app: HTMLDivElement) => {
  const config = createAppConfigContext()
  const runtimeState = createInitialAppRuntimeState(config)

  const components = createAppComponents({
    app,
    config,
    runtimeState,
  })

  components.initialize()
  components.start()
}
