import { render, type JSX } from 'preact'
import type { AssistTargetUiState } from '../../../runtime/gameQueries'
import type { Body } from '../../../simulation/types'

export type TargetControlRenderRow = {
  body: Body
  distanceLabel: string
  index: number
}

type TargetControlRenderState = {
  automaticTargetingAvailable: boolean
  rows: TargetControlRenderRow[]
  targetState: AssistTargetUiState
}

type TargetControlView = {
  render(renderState: TargetControlRenderState): void
}

type TouchTapHandlers = Pick<
  JSX.HTMLAttributes<HTMLButtonElement>,
  'onTouchCancel' | 'onTouchEnd' | 'onTouchStart'
>

type TouchStart = { id: number; x: number; y: number }
type TouchTapSessions = Map<string, TouchStart>

const tapMoveTolerancePx = 18

const createTouchTapHandlers = (
  touchTapSessions: TouchTapSessions,
  key: string,
  activate: () => void,
): TouchTapHandlers => {
  return {
    onTouchStart: (event) => {
      const touch = event.changedTouches[0]
      if (!touch) {
        touchTapSessions.delete(key)
        return
      }
      touchTapSessions.set(key, {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
      })
    },
    onTouchEnd: (event) => {
      const start = touchTapSessions.get(key) ?? null
      touchTapSessions.delete(key)
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
    },
    onTouchCancel: () => {
      touchTapSessions.delete(key)
    },
  }
}

const getAutomaticTargetDisplayBody = (targetState: AssistTargetUiState) => {
  if (targetState.mode === 'auto') {
    return targetState.activeTarget
  }

  return targetState.recommendedTarget ?? targetState.activeTarget
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

const TargetBodySphere = ({ body }: { body: Pick<Body, 'color'> }) => (
  <span
    class="target-body-sphere"
    style={{ '--target-body-color': body.color } as JSX.CSSProperties}
  />
)

const TargetStatusMark = ({ mode }: { mode: AssistTargetUiState['mode'] }) => (
  <span
    aria-hidden="true"
    class={`target-status-mark target-status-mark-${mode}`}
  />
)

const AutomaticTargetingRow = ({
  automaticTargetingAvailable,
  onCommitAutomaticTargetMode,
  targetState,
  touchTapSessions,
}: {
  automaticTargetingAvailable: boolean
  onCommitAutomaticTargetMode(): void
  targetState: AssistTargetUiState
  touchTapSessions: TouchTapSessions
}) => {
  if (!automaticTargetingAvailable) {
    return (
      <button
        class="touch-target-control-automatic-row"
        hidden
        role="switch"
        type="button"
      />
    )
  }

  const automaticTargetBody = getAutomaticTargetDisplayBody(targetState)
  const automaticEnabled = targetState.mode === 'auto'
  const touchTapHandlers = createTouchTapHandlers(
    touchTapSessions,
    'automatic',
    onCommitAutomaticTargetMode,
  )

  return (
    <button
      aria-checked={automaticEnabled}
      aria-label={
        automaticEnabled
          ? `Automatic targeting on: ${automaticTargetBody.name}`
          : `Automatic targeting off: ${automaticTargetBody.name}`
      }
      class={[
        'touch-target-control-automatic-row',
        automaticEnabled ? 'touch-target-control-automatic-row-enabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={targetState.mode === 'forced'}
      onClick={onCommitAutomaticTargetMode}
      role="switch"
      type="button"
      {...touchTapHandlers}
    >
      <TargetStatusMark mode="auto" />
      <span class="touch-target-control-automatic-copy">
        <span class="touch-target-control-automatic-name">Automatic</span>
        <span class="touch-target-control-automatic-target">
          {automaticTargetBody.name}
        </span>
      </span>
      <span aria-hidden="true" class="touch-target-control-switch">
        <span />
      </span>
    </button>
  )
}

const TargetRow = ({
  onCommitManualTarget,
  row,
  targetState,
  touchTapSessions,
}: {
  onCommitManualTarget(index: number): void
  row: TargetControlRenderRow
  targetState: AssistTargetUiState
  touchTapSessions: TouchTapSessions
}) => {
  const active = row.body.id === targetState.activeTarget.id
  const recommended = row.body.id === targetState.recommendedTarget?.id
  const rowMode = active ? targetState.mode : recommended ? 'auto' : null
  const commitManualTarget = () => {
    onCommitManualTarget(row.index)
  }
  const touchTapHandlers = createTouchTapHandlers(
    touchTapSessions,
    `target:${row.body.id}`,
    commitManualTarget,
  )

  return (
    <button
      aria-label={`${row.body.name}, ${row.distanceLabel}${
        rowMode ? `, ${getTargetStatusLabel(rowMode)}` : ''
      }`}
      class={[
        'touch-target-control-row',
        active ? 'touch-target-control-row-active' : '',
        recommended ? 'touch-target-control-row-recommended' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={targetState.mode === 'forced'}
      onClick={commitManualTarget}
      type="button"
      {...touchTapHandlers}
    >
      <TargetBodySphere body={row.body} />
      <span class="touch-target-control-body">
        <span class="touch-target-control-name">{row.body.name}</span>
        <span class="touch-target-control-distance">{row.distanceLabel}</span>
      </span>
      {rowMode ? <TargetStatusMark mode={rowMode} /> : null}
    </button>
  )
}

const TargetControlSurface = ({
  onCommitAutomaticTargetMode,
  onCommitManualTarget,
  renderState,
  touchTapSessions,
}: {
  onCommitAutomaticTargetMode(): void
  onCommitManualTarget(index: number): void
  renderState: TargetControlRenderState
  touchTapSessions: TouchTapSessions
}) => (
  <>
    <AutomaticTargetingRow
      automaticTargetingAvailable={renderState.automaticTargetingAvailable}
      onCommitAutomaticTargetMode={onCommitAutomaticTargetMode}
      targetState={renderState.targetState}
      touchTapSessions={touchTapSessions}
    />
    <div class="touch-target-control-list">
      {renderState.rows.map((row) => (
        <TargetRow
          key={row.body.id}
          onCommitManualTarget={onCommitManualTarget}
          row={row}
          targetState={renderState.targetState}
          touchTapSessions={touchTapSessions}
        />
      ))}
    </div>
  </>
)

export const createTargetControlView = (options: {
  element: HTMLElement
  onCommitAutomaticTargetMode(): void
  onCommitManualTarget(index: number): void
}): TargetControlView => {
  const touchTapSessions: TouchTapSessions = new Map()

  return {
    render(renderState) {
      render(
        <TargetControlSurface
          onCommitAutomaticTargetMode={options.onCommitAutomaticTargetMode}
          onCommitManualTarget={options.onCommitManualTarget}
          renderState={renderState}
          touchTapSessions={touchTapSessions}
        />,
        options.element,
      )
    },
  }
}
