import {
  ScenarioLoadingOverlaySurface,
  type ScenarioLoadingOverlaySurfaceProps,
} from './components/ScenarioLoadingOverlaySurface'
import { createPreactUiSurface } from './createPreactUiSurface'

export type ScenarioLoadingOverlay = {
  setVisible(visible: boolean, label?: string): void
}

const defaultLabel = 'Loading scenario'
const hideDelayMs = 160

type ScenarioLoadingOverlayRenderProps = Omit<
  ScenarioLoadingOverlaySurfaceProps,
  'rootRef'
>

export const createScenarioLoadingOverlay = (options: {
  app: HTMLElement
}): ScenarioLoadingOverlay => {
  const surface = createPreactUiSurface<ScenarioLoadingOverlayRenderProps>({
    app: options.app,
    component: ScenarioLoadingOverlaySurface,
    missingRootError: 'Failed to create scenario loading overlay',
  })
  let hidden = true
  let hideTimer: number | undefined
  let label = defaultLabel
  let visible = false

  const renderOverlay = () => {
    surface.render({ hidden, label, visible })
  }

  renderOverlay()

  return {
    setVisible(nextVisible, nextLabel = defaultLabel) {
      const needsDelayedHide = !nextVisible && !hidden
      label = nextLabel
      visible = nextVisible
      hidden = nextVisible ? false : hidden

      if (hideTimer !== undefined) {
        window.clearTimeout(hideTimer)
        hideTimer = undefined
      }

      renderOverlay()

      if (needsDelayedHide) {
        hideTimer = window.setTimeout(() => {
          if (!visible) {
            hidden = true
            renderOverlay()
          }
          hideTimer = undefined
        }, hideDelayMs)
      }
    },
  }
}
