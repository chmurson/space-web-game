import type { AppRuntimeState } from '../runtime/appRuntimeState'

export type ScenarioPromptAnchor =
  | 'time-warp-pill'
  | 'time-warp-control'
  | 'speed-pill'
  | 'thrust-pill'
  | 'thrust-control'
  | 'trajectory'
  | 'trajectory-control'

export type ScenarioHudFocusTarget =
  | 'time-warp-pill'
  | 'speed-pill'
  | 'thrust-pill'
export type ScenarioTouchHintTarget = 'thrust-zone'
export type ScenarioTouchControlFocusTarget =
  | 'burn'
  | 'rcs'
  | 'trajectory'
  | 'warp'
export type ScenarioCoachPromptLayout =
  | 'anchored'
  | 'bottom'
  | 'floating'
  | 'playfield'

export type PromptAction =
  | {
      kind: 'builtin'
      id:
        | 'dismiss'
        | 'dismiss_to_replay'
        | 'start_free_roam'
        | 'exit_to_menu'
        | 'show_reach_moon_highscores'
    }
  | {
      kind: 'scenario'
      id: string
    }

export type PromptActionEffect =
  | 'start-free-roam'
  | 'exit-to-menu'
  | 'show-reach-moon-highscores'

export type PromptButtonTone = 'primary' | 'secondary' | 'tertiary'
export type PromptTextTone = 'concept' | 'constraint' | 'number'

export type PromptTextFragment = {
  text: string
  tone: PromptTextTone
}

export type PromptText = string | ReadonlyArray<string | PromptTextFragment>

export type PromptResolverContext = {
  inputMode: 'desktop' | 'mobile'
  runtime: AppRuntimeState
}

export type PromptValue<T> = T | ((context: PromptResolverContext) => T)

export type PromptButtonDefinition = {
  action: PromptAction
  label: PromptValue<string>
  tone: PromptButtonTone
}

export type PromptPresentationDefinition =
  | { kind: 'blocking' }
  | {
      anchor?: PromptValue<ScenarioPromptAnchor | undefined>
      focusedTouchControl?: PromptValue<
        ScenarioTouchControlFocusTarget | undefined
      >
      focusedHudElement?: PromptValue<ScenarioHudFocusTarget | undefined>
      kind: 'coach'
      layout?: PromptValue<ScenarioCoachPromptLayout | undefined>
      touchHintTarget?: PromptValue<ScenarioTouchHintTarget | undefined>
    }

export type PromptDefinition = {
  buttons: PromptButtonDefinition[]
  description: PromptValue<PromptText>
  id: string
  pausesGameplay?: boolean
  presentation: PromptPresentationDefinition
  shortLabel?: PromptValue<string>
  title: PromptValue<string>
}

export type ResolvedPromptButton = {
  action: PromptAction
  label: string
  tone: PromptButtonTone
}

export type ResolvedPrompt = {
  buttons: ResolvedPromptButton[]
  description: PromptText
  id: string
  pausesGameplay: boolean
  title: string
} & (
  | { kind: 'blocking' }
  | {
      anchor?: ScenarioPromptAnchor
      focusedTouchControl?: ScenarioTouchControlFocusTarget
      focusedHudElement?: ScenarioHudFocusTarget
      kind: 'coach'
      layout: ScenarioCoachPromptLayout
      touchHintTarget?: ScenarioTouchHintTarget
    }
)

export type ResolvedPromptState = {
  active: ResolvedPrompt | null
  replay: null | {
    id: string
    label: string
  }
}
