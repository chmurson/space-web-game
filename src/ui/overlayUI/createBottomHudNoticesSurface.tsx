import type { SurfaceRootRefProps } from '../createPreactUiSurface'
import { createPreactUiSurface } from '../createPreactUiSurface'

export type BottomHudNoticesRefs = {
  bottomPillArea: HTMLElement
  fuelDepletedNotice: HTMLElement
  transientNotice: HTMLElement
  transientNoticeBody: HTMLSpanElement
  transientNoticeTitle: HTMLSpanElement
  targetRecommendationNotice: HTMLElement
  targetRecommendationNoticeDismissButton: HTMLButtonElement
  targetRecommendationNoticeMessage: HTMLSpanElement
  targetRecommendationNoticeOpenButton: HTMLButtonElement
}

type BottomHudNoticesSurfaceRenderProps = Record<string, never>
type BottomHudNoticesSurfaceProps = BottomHudNoticesSurfaceRenderProps &
  SurfaceRootRefProps

const getRequiredElement = <ElementType extends Element>(
  element: ElementType | null,
  message: string,
): ElementType => {
  if (!element) {
    throw new Error(message)
  }

  return element
}

const BottomHudNoticesSurface = ({ rootRef }: BottomHudNoticesSurfaceProps) => (
  <div class="bottom-pill-area" ref={rootRef}>
    <div
      class="hud-notice hud-notice-durable fuel-depleted-notice"
      data-visible="false"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden="true"
      hidden
    >
      <span class="hud-notice-title">Fuel depleted</span>
      <span class="hud-notice-body">Thrusters disabled</span>
    </div>
    <div
      class="hud-notice hud-notice-transient"
      data-visible="false"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden="true"
      hidden
    >
      <span class="hud-notice-title" />
      <span class="hud-notice-body" />
    </div>
    <div
      class="hud-notice target-recommendation-notice"
      data-visible="false"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden="true"
      hidden
    >
      <button type="button" class="target-recommendation-notice-open">
        <span class="target-recommendation-notice-message" />
      </button>
      <button
        type="button"
        class="target-recommendation-notice-dismiss"
        aria-label="Dismiss target recommendation"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  </div>
)

export const createBottomHudNoticesSurface = (
  app: HTMLElement,
): BottomHudNoticesRefs => {
  const surface = createPreactUiSurface<BottomHudNoticesSurfaceRenderProps>({
    app,
    component: BottomHudNoticesSurface,
    missingRootError: 'Failed to create bottom HUD notices surface',
  })

  surface.render({})
  surface.element.parentElement?.style.setProperty('display', 'contents')

  const bottomPillArea = surface.element
  const fuelDepletedNotice = getRequiredElement(
    bottomPillArea.querySelector<HTMLElement>('.fuel-depleted-notice'),
    'Failed to create fuel depleted notice',
  )
  const transientNotice = getRequiredElement(
    bottomPillArea.querySelector<HTMLElement>('.hud-notice-transient'),
    'Failed to create transient HUD notice',
  )
  const targetRecommendationNotice = getRequiredElement(
    bottomPillArea.querySelector<HTMLElement>('.target-recommendation-notice'),
    'Failed to create target recommendation notice',
  )

  return {
    bottomPillArea,
    fuelDepletedNotice,
    transientNotice,
    transientNoticeBody: getRequiredElement(
      transientNotice.querySelector<HTMLSpanElement>('.hud-notice-body'),
      'Failed to create transient HUD notice body',
    ),
    transientNoticeTitle: getRequiredElement(
      transientNotice.querySelector<HTMLSpanElement>('.hud-notice-title'),
      'Failed to create transient HUD notice title',
    ),
    targetRecommendationNotice,
    targetRecommendationNoticeDismissButton: getRequiredElement(
      targetRecommendationNotice.querySelector<HTMLButtonElement>(
        '.target-recommendation-notice-dismiss',
      ),
      'Failed to create target recommendation dismiss button',
    ),
    targetRecommendationNoticeMessage: getRequiredElement(
      targetRecommendationNotice.querySelector<HTMLSpanElement>(
        '.target-recommendation-notice-message',
      ),
      'Failed to create target recommendation message',
    ),
    targetRecommendationNoticeOpenButton: getRequiredElement(
      targetRecommendationNotice.querySelector<HTMLButtonElement>(
        '.target-recommendation-notice-open',
      ),
      'Failed to create target recommendation open button',
    ),
  }
}
