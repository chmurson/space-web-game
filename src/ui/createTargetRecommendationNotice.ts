import type { AssistTargetUiState } from '../runtime/gameQueries'
import type { Body } from '../simulation/types'

export type TargetRecommendationNoticeRefs = {
  dismissButton: HTMLButtonElement | null
  element: HTMLElement
  message: HTMLSpanElement | null
  openButton: HTMLButtonElement | null
}

export type TargetRecommendationNoticeModel = {
  activeNoticeKey: string | null
  dismissedNoticeKey: string | null
  manualTargetId: string | null
  notifiedRecommendedTargetId: string | null
  seenAutoTargetId: string | null
  seenRecommendedTargetId: string | null
}

const autoTargetNoticeDurationMs = 3200

export const createTargetRecommendationNoticeModel =
  (): TargetRecommendationNoticeModel => ({
    activeNoticeKey: null,
    dismissedNoticeKey: null,
    manualTargetId: null,
    notifiedRecommendedTargetId: null,
    seenAutoTargetId: null,
    seenRecommendedTargetId: null,
  })

type TargetNotice = {
  durationMs?: number
  key: string
  message: string
  target: Body
  variant: 'durable' | 'transient'
}

export const acknowledgeTargetRecommendationNoticeModel = (
  model: TargetRecommendationNoticeModel,
  targetState: AssistTargetUiState,
) => {
  model.activeNoticeKey = null
  model.dismissedNoticeKey = null
  model.manualTargetId =
    targetState.mode === 'manual' ? targetState.activeTarget.id : null
  model.seenRecommendedTargetId =
    targetState.mode === 'manual'
      ? (targetState.recommendedTarget?.id ?? null)
      : null
  model.notifiedRecommendedTargetId = null
  model.seenAutoTargetId =
    targetState.mode === 'auto' ? targetState.activeTarget.id : null
}

export const dismissTargetRecommendationNoticeModel = (
  model: TargetRecommendationNoticeModel,
) => {
  model.dismissedNoticeKey = model.activeNoticeKey
}

const syncManualRecommendationNoticeModel = (
  model: TargetRecommendationNoticeModel,
  targetState: AssistTargetUiState,
): TargetNotice | null => {
  model.seenAutoTargetId = null
  const recommendedTarget = targetState.recommendedTarget
  const recommendedTargetId = recommendedTarget?.id ?? null
  if (model.manualTargetId !== targetState.activeTarget.id) {
    acknowledgeTargetRecommendationNoticeModel(model, targetState)
    return null
  }

  if (recommendedTarget === null) {
    model.seenRecommendedTargetId = null
    model.dismissedNoticeKey = null
    model.notifiedRecommendedTargetId = null
    return null
  }

  if (model.seenRecommendedTargetId !== recommendedTargetId) {
    model.seenRecommendedTargetId = recommendedTargetId
    model.dismissedNoticeKey = null
    model.notifiedRecommendedTargetId = recommendedTargetId
  }

  if (model.notifiedRecommendedTargetId !== recommendedTargetId) {
    return null
  }

  const key = `manual:${targetState.activeTarget.id}:${recommendedTargetId}`
  if (model.dismissedNoticeKey === key) {
    return null
  }

  return {
    key,
    message: `${recommendedTarget.name} is now recommended for trajectory targeting`,
    target: recommendedTarget,
    variant: 'durable',
  }
}

const syncAutoTargetNoticeModel = (
  model: TargetRecommendationNoticeModel,
  targetState: AssistTargetUiState,
): TargetNotice | null => {
  model.manualTargetId = null
  model.seenRecommendedTargetId = null
  model.notifiedRecommendedTargetId = null

  const activeTargetId = targetState.activeTarget.id
  if (model.seenAutoTargetId !== activeTargetId) {
    const hadAutoTarget = model.seenAutoTargetId !== null
    model.seenAutoTargetId = activeTargetId
    model.dismissedNoticeKey = null
    if (hadAutoTarget) {
      return {
        durationMs: autoTargetNoticeDurationMs,
        key: `auto:${activeTargetId}`,
        message: `${targetState.activeTarget.name} is now the trajectory target`,
        target: targetState.activeTarget,
        variant: 'transient',
      }
    }
  }

  return null
}

export const syncTargetRecommendationNoticeModel = (
  model: TargetRecommendationNoticeModel,
  targetState: AssistTargetUiState,
): TargetNotice | null => {
  const notice =
    targetState.mode === 'manual'
      ? syncManualRecommendationNoticeModel(model, targetState)
      : targetState.mode === 'auto'
        ? syncAutoTargetNoticeModel(model, targetState)
        : null

  model.activeNoticeKey = notice?.key ?? null
  if (targetState.mode === 'forced') {
    acknowledgeTargetRecommendationNoticeModel(model, targetState)
  }

  return notice
}

export const createTargetRecommendationNoticePresenter = (options: {
  onOpenTargetControl(): void
  refs: TargetRecommendationNoticeRefs
}) => {
  const model = createTargetRecommendationNoticeModel()
  let visibleNoticeKey: string | null = null
  let visibleNoticeVariant: TargetNotice['variant'] | null = null
  let transientHideTimeoutId: number | null = null

  const clearTransientHideTimeout = () => {
    if (transientHideTimeoutId !== null) {
      window.clearTimeout(transientHideTimeoutId)
      transientHideTimeoutId = null
    }
  }

  const hide = () => {
    clearTransientHideTimeout()
    visibleNoticeKey = null
    visibleNoticeVariant = null
    options.refs.element.hidden = true
    options.refs.element.dataset.visible = 'false'
    options.refs.element.dataset.noticeVariant = ''
    options.refs.element.setAttribute('aria-hidden', 'true')
  }

  const show = (notice: TargetNotice) => {
    if (visibleNoticeKey === notice.key && !options.refs.element.hidden) {
      return
    }

    clearTransientHideTimeout()
    visibleNoticeKey = notice.key
    visibleNoticeVariant = notice.variant
    options.refs.element.hidden = false
    options.refs.element.dataset.visible = 'true'
    options.refs.element.dataset.noticeVariant = notice.variant
    options.refs.element.setAttribute('aria-hidden', 'false')
    const isDurable = notice.variant === 'durable'
    if (options.refs.dismissButton) {
      options.refs.dismissButton.hidden = !isDurable
      options.refs.dismissButton.disabled = !isDurable
    }
    if (options.refs.openButton) {
      options.refs.openButton.disabled = !isDurable
    }
    options.refs.message?.replaceChildren(notice.message)
    options.refs.openButton?.setAttribute(
      'aria-label',
      isDurable ? `${notice.message}; open target selector` : notice.message,
    )
    options.refs.openButton?.setAttribute('title', notice.message)

    if (notice.variant === 'transient') {
      transientHideTimeoutId = window.setTimeout(() => {
        if (visibleNoticeKey === notice.key) {
          hide()
        }
      }, notice.durationMs ?? autoTargetNoticeDurationMs)
    }
  }

  options.refs.openButton?.addEventListener('click', () => {
    if (visibleNoticeVariant !== 'durable') {
      return
    }
    options.onOpenTargetControl()
  })
  options.refs.dismissButton?.addEventListener('click', () => {
    if (visibleNoticeVariant !== 'durable') {
      return
    }
    dismissTargetRecommendationNoticeModel(model)
    hide()
  })

  hide()

  return {
    acknowledgeCurrentTargetState(targetState: AssistTargetUiState) {
      acknowledgeTargetRecommendationNoticeModel(model, targetState)
      hide()
    },
    sync(targetState: AssistTargetUiState) {
      const notice = syncTargetRecommendationNoticeModel(model, targetState)
      if (notice) {
        show(notice)
      } else if (
        visibleNoticeVariant !== 'transient' ||
        targetState.mode !== 'auto'
      ) {
        hide()
      }
    },
  }
}
