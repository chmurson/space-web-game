import type { AssistMode } from '../assist/orbitalAssist'
import type { KeyboardInput } from '../input/keyboardInput'
import type { SimulationState } from '../simulation/types'
import {
  resolveSimulationTimeWarp,
  type TimeWarpConstraintReason,
} from './simulationStep'
import { getConstrainedTimeWarpIndex } from '../scenario/scenarioDirectives'
import type { GameQueries } from './gameQueries'

type TimeWarpFeedbackQueries = Pick<
  GameQueries,
  | 'getAssistTarget'
  | 'getAutopilotTurn'
  | 'getCaptureMetrics'
  | 'getCircularizePlan'
  | 'shouldCaptureBurn'
>

export type TimeWarpAction = 'increaseTimeWarp' | 'decreaseTimeWarp'

export type TimeWarpFeedbackReason =
  | 'control-limit'
  | 'global-max'
  | 'global-min'
  | 'scenario-limit'
  | 'thrust-active'
  | 'turning'

export type TimeWarpFeedbackPreview = {
  action: TimeWarpAction
  canCommit: boolean
  reason: TimeWarpFeedbackReason | null
  value: number
}

export type TimeWarpFeedbackPolicyOptions = TimeWarpFeedbackQueries & {
  action: TimeWarpAction
  assistMode: AssistMode
  crashedBodyName: string | null
  currentTimeWarpIndex: number
  keyboardInput: KeyboardInput
  maxControlWarp: number
  maxTimeWarp: number | null
  state: SimulationState
  targetHeading: number | null
  timeWarps: number[]
}

type ResolvedTimeWarpFeedbackPreview = TimeWarpFeedbackPreview & {
  nextTimeWarpIndex: number
}

const normalizeConstraintReason = (params: {
  action: TimeWarpAction
  currentTimeWarpIndex: number
  requestedIndex: number
  resolvedReason: TimeWarpConstraintReason | null
  resolvedControls: SimulationState['controls']
}): TimeWarpFeedbackReason | null => {
  if (params.requestedIndex === params.currentTimeWarpIndex) {
    return params.action === 'increaseTimeWarp' ? 'global-max' : 'global-min'
  }

  if (params.resolvedReason === 'scenario-limit') {
    return 'scenario-limit'
  }

  if (params.resolvedReason !== 'active-controls') {
    return null
  }

  if (params.resolvedControls.main !== 0) {
    return 'thrust-active'
  }

  if (
    params.resolvedControls.turn !== 0 &&
    params.resolvedControls.reverse === 0 &&
    params.resolvedControls.strafe === 0
  ) {
    return 'turning'
  }

  return 'control-limit'
}

const resolveTimeWarpFeedbackPreview = (
  options: TimeWarpFeedbackPolicyOptions,
): ResolvedTimeWarpFeedbackPreview => {
  const direction = options.action === 'increaseTimeWarp' ? 1 : -1
  const requestedIndex = getConstrainedTimeWarpIndex(
    options.currentTimeWarpIndex + direction,
    options.timeWarps,
    null,
  )
  const resolvedTimeWarp = resolveSimulationTimeWarp({
    assistMode: options.assistMode,
    crashedBodyName: options.crashedBodyName,
    getAssistTarget: options.getAssistTarget,
    getAutopilotTurn: options.getAutopilotTurn,
    getCaptureMetrics: options.getCaptureMetrics,
    getCircularizePlan: options.getCircularizePlan,
    keyboardInput: options.keyboardInput,
    maxControlWarp: options.maxControlWarp,
    maxTimeWarp: options.maxTimeWarp,
    shouldCaptureBurn: options.shouldCaptureBurn,
    state: options.state,
    targetHeading: options.targetHeading,
    timeWarpIndex: requestedIndex,
    timeWarps: options.timeWarps,
  })

  return {
    action: options.action,
    canCommit: resolvedTimeWarp.timeWarpIndex !== options.currentTimeWarpIndex,
    nextTimeWarpIndex: resolvedTimeWarp.timeWarpIndex,
    reason: normalizeConstraintReason({
      action: options.action,
      currentTimeWarpIndex: options.currentTimeWarpIndex,
      requestedIndex,
      resolvedControls: resolvedTimeWarp.simulationControls.controls,
      resolvedReason: resolvedTimeWarp.reason,
    }),
    value: options.timeWarps[resolvedTimeWarp.timeWarpIndex] ?? 1,
  }
}

export const getTimeWarpFeedbackPreview = (
  options: TimeWarpFeedbackPolicyOptions,
): TimeWarpFeedbackPreview => {
  const { nextTimeWarpIndex: _nextTimeWarpIndex, ...preview } =
    resolveTimeWarpFeedbackPreview(options)
  return preview
}

export const getTimeWarpFeedbackPreviews = (
  options: TimeWarpFeedbackPolicyOptions & { count: number },
): TimeWarpFeedbackPreview[] => {
  if (options.count <= 0) {
    return []
  }

  const previews: TimeWarpFeedbackPreview[] = []
  let currentTimeWarpIndex = options.currentTimeWarpIndex

  for (let step = 0; step < options.count; step += 1) {
    const preview = resolveTimeWarpFeedbackPreview({
      ...options,
      currentTimeWarpIndex,
    })

    if (step > 0 && preview.nextTimeWarpIndex === currentTimeWarpIndex) {
      break
    }

    previews.push({
      action: preview.action,
      canCommit: preview.canCommit,
      reason: preview.reason,
      value: preview.value,
    })

    if (!preview.canCommit) {
      break
    }

    currentTimeWarpIndex = preview.nextTimeWarpIndex
  }

  return previews
}
