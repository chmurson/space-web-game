import type { AssistTargetUiState } from '../../../runtime/gameQueries'
import type { Body } from '../../../simulation/types'
import { formatDistance } from '../../formatters'
import '../../targetBodyGlyphs.css'
import './targetControl.css'
import {
  createTargetControlView,
  type TargetControlRenderRow,
} from './targetControlView'

export type TargetControlBodyRow = {
  body: Body
  distanceMeters: number
  index: number
}

export type TargetControl = {
  element: HTMLElement
  syncUi(): void
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

  let lastRenderSignature: string | null = null

  const syncAfterTargetStateChange = () => {
    syncUi()
    options.onStateChange?.()
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

  const commitManualTarget = (index: number) => {
    if (options.getTargetState().mode === 'forced') {
      return
    }
    if (options.onSelectTargetIndex(index)) {
      syncAfterTargetStateChange()
      options.onCommit?.()
    }
  }

  const view = createTargetControlView({
    element,
    onCommitAutomaticTargetMode: commitAutomaticTargetMode,
    onCommitManualTarget: commitManualTarget,
  })

  const syncUi = () => {
    const targetState = options.getTargetState()
    const rows = options.getRows().map<TargetControlRenderRow>((row) => ({
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

    view.render({
      automaticTargetingAvailable: options.automaticTargetingAvailable,
      rows,
      targetState,
    })
  }

  syncUi()

  return {
    element,
    syncUi,
  }
}
