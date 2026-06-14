import type { AssistTargetUiState } from '../../../runtime/gameQueries'
import type { Body } from '../../../simulation/types'
import { formatDistance } from '../../formatters'
import '../../targetBodyGlyphs.css'
import './targetControl.css'

export type TargetControlBodyRow = {
  body: Body
  distanceMeters: number
  index: number
}

export type TargetControl = {
  element: HTMLElement
  syncUi(): void
}

type RenderedTargetControlBodyRow = TargetControlBodyRow & {
  distanceLabel: string
}

const tapMoveTolerancePx = 18

export const createTargetBodySphere = (body: Pick<Body, 'color'>) => {
  const sphere = document.createElement('span')
  sphere.className = 'target-body-sphere'
  sphere.style.setProperty('--target-body-color', body.color)
  return sphere
}

export const createTargetStatusMark = (mode: AssistTargetUiState['mode']) => {
  const mark = document.createElement('span')
  mark.className = `target-status-mark target-status-mark-${mode}`
  mark.setAttribute('aria-hidden', 'true')
  return mark
}

const getTargetStatusLabel = (mode: AssistTargetUiState['mode']) => {
  if (mode === 'auto') {
    return 'tracking target'
  }
  if (mode === 'manual') {
    return 'pinned target'
  }
  return 'locked target'
}

export const createTargetControl = (options: {
  automaticTargetingAvailable: boolean
  getRows(): TargetControlBodyRow[]
  getTargetState(): AssistTargetUiState
  onCommit?(): void
  onReturnToAutomaticTarget(): boolean
  onSelectTargetIndex(index: number): boolean
  onStateChange?(): void
}): TargetControl => {
  const element = document.createElement('div')
  element.className = 'touch-target-control'
  element.setAttribute('aria-label', 'Target body selector')

  const automaticRow = document.createElement('button')
  automaticRow.type = 'button'
  automaticRow.className = 'touch-target-control-automatic-row'
  automaticRow.setAttribute('role', 'switch')

  const list = document.createElement('div')
  list.className = 'touch-target-control-list'

  element.append(automaticRow, list)

  let lastRenderSignature: string | null = null

  const activateOnTouchTap = (element: HTMLElement, activate: () => void) => {
    let touchStart: { id: number; x: number; y: number } | null = null

    element.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches[0]
      if (!touch) {
        touchStart = null
        return
      }
      touchStart = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
      }
    })

    element.addEventListener('touchend', (event) => {
      const start = touchStart
      touchStart = null
      const touch = start
        ? Array.from(event.changedTouches).find(
            (changedTouch) => changedTouch.identifier === start.id,
          )
        : null
      if (
        !start ||
        !touch ||
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) >
          tapMoveTolerancePx
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      activate()
    })

    element.addEventListener('touchcancel', () => {
      touchStart = null
    })
  }

  const syncAfterTargetStateChange = () => {
    syncUi()
    options.onStateChange?.()
  }

  const getAutomaticTargetDisplayBody = (targetState: AssistTargetUiState) => {
    if (targetState.mode === 'auto') {
      return targetState.activeTarget
    }

    return targetState.recommendedTarget ?? targetState.activeTarget
  }

  const commitAutomaticTargetMode = () => {
    const targetState = options.getTargetState()
    if (!options.automaticTargetingAvailable || targetState.mode === 'forced') {
      return
    }

    if (targetState.mode === 'auto') {
      const activeRow = options
        .getRows()
        .find((row) => row.body.id === targetState.activeTarget.id)
      if (activeRow && options.onSelectTargetIndex(activeRow.index)) {
        syncAfterTargetStateChange()
      }
      return
    }

    if (options.onReturnToAutomaticTarget()) {
      syncAfterTargetStateChange()
    }
  }

  automaticRow.addEventListener('click', commitAutomaticTargetMode)
  activateOnTouchTap(automaticRow, commitAutomaticTargetMode)

  const renderAutomaticRow = (targetState: AssistTargetUiState) => {
    automaticRow.hidden = !options.automaticTargetingAvailable
    if (!options.automaticTargetingAvailable) {
      return
    }

    const automaticTargetBody = getAutomaticTargetDisplayBody(targetState)
    const automaticEnabled = targetState.mode === 'auto'
    automaticRow.disabled = targetState.mode === 'forced'
    automaticRow.classList.toggle(
      'touch-target-control-automatic-row-enabled',
      automaticEnabled,
    )
    automaticRow.setAttribute('aria-checked', String(automaticEnabled))
    automaticRow.setAttribute(
      'aria-label',
      automaticEnabled
        ? `Automatic targeting on: ${automaticTargetBody.name}`
        : `Automatic targeting off: ${automaticTargetBody.name}`,
    )

    const copy = document.createElement('span')
    copy.className = 'touch-target-control-automatic-copy'

    const name = document.createElement('span')
    name.className = 'touch-target-control-automatic-name'
    name.textContent = 'Automatic'

    const targetName = document.createElement('span')
    targetName.className = 'touch-target-control-automatic-target'
    targetName.textContent = automaticTargetBody.name

    copy.append(name, targetName)

    const switchTrack = document.createElement('span')
    switchTrack.className = 'touch-target-control-switch'
    switchTrack.setAttribute('aria-hidden', 'true')
    switchTrack.appendChild(document.createElement('span'))

    automaticRow.replaceChildren(
      createTargetStatusMark('auto'),
      copy,
      switchTrack,
    )
  }

  const renderRow = (
    row: RenderedTargetControlBodyRow,
    targetState: AssistTargetUiState,
  ) => {
    const active = row.body.id === targetState.activeTarget.id
    const recommended = row.body.id === targetState.recommendedTarget?.id
    const rowMode = active ? targetState.mode : recommended ? 'auto' : null
    const button = document.createElement('button')
    button.type = 'button'
    button.className = [
      'touch-target-control-row',
      active ? 'touch-target-control-row-active' : '',
      recommended ? 'touch-target-control-row-recommended' : '',
    ]
      .filter(Boolean)
      .join(' ')
    button.disabled = targetState.mode === 'forced'
    button.setAttribute(
      'aria-label',
      `${row.body.name}, ${row.distanceLabel}${
        rowMode ? `, ${getTargetStatusLabel(rowMode)}` : ''
      }`,
    )

    const copy = document.createElement('span')
    copy.className = 'touch-target-control-body'

    const name = document.createElement('span')
    name.className = 'touch-target-control-name'
    name.textContent = row.body.name

    const distance = document.createElement('span')
    distance.className = 'touch-target-control-distance'
    distance.textContent = row.distanceLabel

    copy.append(name, distance)
    button.append(createTargetBodySphere(row.body), copy)
    if (rowMode) {
      button.append(createTargetStatusMark(rowMode))
    }

    const commitManualTarget = () => {
      if (options.onSelectTargetIndex(row.index)) {
        syncAfterTargetStateChange()
        options.onCommit?.()
      }
    }

    button.addEventListener('click', commitManualTarget)
    activateOnTouchTap(button, commitManualTarget)

    return button
  }

  const syncUi = () => {
    const targetState = options.getTargetState()
    const rows = options.getRows().map<RenderedTargetControlBodyRow>((row) => ({
      ...row,
      distanceLabel: formatDistance(row.distanceMeters),
    }))
    const renderSignature = [
      options.automaticTargetingAvailable ? 'auto-available' : 'auto-hidden',
      targetState.mode,
      targetState.activeTarget.id,
      targetState.recommendedTarget?.id ?? '',
      rows
        .map(
          (row) =>
            `${row.index}:${row.body.id}:${row.body.name}:${row.body.color}:${row.distanceLabel}`,
        )
        .join('|'),
    ].join('::')
    if (renderSignature === lastRenderSignature) {
      return
    }
    lastRenderSignature = renderSignature

    renderAutomaticRow(targetState)
    list.replaceChildren(...rows.map((row) => renderRow(row, targetState)))
  }

  syncUi()

  return {
    element,
    syncUi,
  }
}
