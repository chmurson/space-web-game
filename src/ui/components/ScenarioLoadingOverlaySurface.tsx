import type { SurfaceRootRefProps } from '../createPreactUiSurface'

export type ScenarioLoadingOverlaySurfaceProps = SurfaceRootRefProps & {
  hidden: boolean
  label: string
  visible: boolean
}

export const ScenarioLoadingOverlaySurface = ({
  hidden,
  label,
  rootRef,
  visible,
}: ScenarioLoadingOverlaySurfaceProps) => (
  <div
    class="scenario-loading-overlay"
    ref={rootRef}
    hidden={hidden}
    aria-hidden={!visible}
    data-visible={visible ? 'true' : 'false'}
  >
    <div class="scenario-loading-panel" role="status" aria-live="polite">
      <div class="scenario-loading-spinner" aria-hidden="true" />
      <div class="scenario-loading-label">{label}</div>
    </div>
  </div>
)
