# Interactive tutorial control hints

## Context

The tutorial already gives the player goals, but it still expects too much inference around controls and around what the trajectory UI actually means.

Desktop and mobile inputs differ, yet they drive the same underlying actions:

- thrust
- turning
- turn-to-heading by click / double tap
- time warp changes
- reading the projected trajectory

This creates a good opportunity for guided onboarding that stays scenario-specific and hardcoded if needed, without prematurely turning the system into a generic tutorial framework.

## Proposal

Upgrade the tutorial scenario with interactive control hints.

Each hint should:

1. explain a single control or concept
2. wait until the player performs the requested action
3. move to the next hint only after success

The hints should branch only by input presentation:

- desktop wording references keyboard + click
- mobile wording references touch gestures

But they should validate shared gameplay intent rather than device-specific raw input where possible:

- "apply thrust"
- "change heading"
- "set a target heading by click / double tap"
- "increase time warp"
- "apply thrust while time warp is high"
- "observe how the trajectory changes"

For trajectory explanation steps, the relevant UI should be highlighted while the rest of the UI is dimmed.

This should stay attached to the tutorial scenario first, even if some pieces are reusable later.

## Detailed flow

### Where the hint sequence lives

The hint sequence should run only inside tutorial phase 1 (`escape-earth`).

Reason:

- this is where player confusion is highest
- the controls taught here carry into later tutorial phases naturally
- it keeps the first implementation narrow and avoids polluting later phases with too much guidance

### Order of hints

The hint order should be:

1. `intro-thrust`
2. `intro-turn`
3. `intro-point-and-turn`
4. `intro-timewarp`
5. `intro-timewarp-thrust`
6. `intro-trajectory`
7. `intro-complete`

This sequence should begin only after the player confirms the existing phase-1 intro prompt.

### When each hint appears

#### `intro-thrust`

Appears:

- immediately after the player dismisses the phase-1 intro prompt
- before phase-1 progression is allowed

Purpose:

- teach forward motion first
- establish that the ship is controllable and fuel/thrust exists

#### `intro-turn`

Appears:

- immediately after `intro-thrust` is completed

Purpose:

- teach that orientation matters
- teach that thrust direction depends on heading

#### `intro-point-and-turn`

Appears:

- immediately after `intro-turn`

Purpose:

- teach the "set heading directly" interaction
- this is one of the least discoverable but highest-value controls

#### `intro-timewarp`

Appears:

- only after the player has already thrust and changed direction at least once

Purpose:

- teach faster progression without overwhelming the player before they understand motion

#### `intro-timewarp-thrust`

Appears:

- immediately after `intro-timewarp`
- only once the player has explicitly increased time warp to the required level

Purpose:

- teach that thrust still matters at high time warp
- teach that time warp and ship control are meant to be combined
- make the player feel that control inputs can reshape the future path faster when time is accelerated
- avoid a bad first outcome where the player follows the instruction correctly but immediately dives into the nearest body

#### `intro-trajectory`

Appears:

- after `intro-timewarp-thrust`
- once the player has already caused visible trajectory changes through thrust, turn, time warp, and high-warp thrust

Purpose:

- explain what the projected path is showing
- explain that control changes alter the future path, not only the present position

This is the best moment to use spotlight / dimming because the player already has some context.

#### `intro-complete`

Appears:

- immediately after `intro-trajectory`

Purpose:

- tell the player that free-form phase-1 play is now unlocked
- remove onboarding gates and let the real escape objective take over

### Gating rules

#### What is gated

While the hint sequence is active:

- tutorial phase-1 success should not advance to phase 2
- the player should still be able to fly freely
- simulation should continue normally
- hint order should be strictly linear

This means the hints do **not** freeze gameplay; they only gate scenario progression.

#### What is not gated

- player movement
- camera movement / zoom
- mistakes / crashes
- trajectory changes

If the player accidentally completes a later hint action early, that action should not skip ahead. Only the currently active hint can complete.

#### Crash behavior during gated hints

If the player crashes during phase-1 hints:

- restart phase 1 as usual
- restore the current hint step, not reset the whole hint chain unless the scenario itself resets to the start

The exact persistence policy can be tuned later, but the first implementation should prefer not forcing players to redo already completed hint steps after every mistake.

### Completion rules per hint

#### `intro-thrust`

Completion condition:

- player applies positive forward thrust for a short minimum duration

Suggested rule:

- `main thrust > 0` for at least `300ms` accumulated time while this hint is active

This avoids completing the step on an accidental tap.

#### `intro-turn`

Completion condition:

- player changes spacecraft heading by at least a minimum angle after the hint starts

Suggested rule:

- absolute heading delta from hint start >= `0.35 rad` (about `20 degrees`)

This should be satisfied by either desktop turn keys or mobile turn gesture.

#### `intro-point-and-turn`

Completion condition:

- player uses the direct heading-set interaction

Suggested rule:

- detect the runtime event that sets target heading from pointer / double tap
- require exactly `1` successful direct heading-set event while this hint is active

This hint is intentionally input-specific, so completion should require the actual interaction, not merely a heading change.

#### `intro-timewarp`

Completion condition:

- player increases time warp at least once while this hint is active

Suggested rule:

- current time warp index becomes greater than the value at hint start
- the resulting multiplier must be at least `x100`
- if the scenario is already above `x100` when the hint starts, first require a drop below `x100`, then an increase back to `x100` or above

This should work for keyboard or touch warp controls.

#### `intro-timewarp-thrust`

Completion condition:

- player reaches `x100` time warp and then applies forward thrust while staying at or above that warp level

Suggested rule:

- current time warp multiplier must be `>= x100`
- before evaluating thrust, the tutorial should ensure the spacecraft heading points outward from the nearest major body
- "outward" should mean the ship forward vector is within `30 degrees` of the radial vector pointing away from the nearest body's center
- while in that state, `main thrust > 0` must be held for at least `2000ms`
- the thrust sample must happen after this hint becomes active; earlier high-warp thrust does not count

This step is intentionally stricter than `intro-thrust`, because the goal is to prove deliberate use of both systems together.

#### `intro-trajectory`

Completion condition:

- player explicitly acknowledges a short explanation card

Reason:

- "understanding trajectory" is too fuzzy to infer reliably from gameplay
- this step is better treated as guided explanation with focused UI highlighting

Suggested UI behavior:

- dim most UI
- spotlight the trajectory line / time pill / relevant area
- use exactly `2` short explanation beats
- end with `Got it` / `Continue`

#### `intro-complete`

Completion condition:

- player closes the final onboarding card

Effect:

- remove phase-1 hint gate
- allow normal phase objective completion to advance to phase 2

### Focus / dimming rules

Use focus overlays only when they add clarity.

Recommended mapping:

- `intro-thrust`: highlight thrust control region
- `intro-turn`: highlight turn control region
- `intro-point-and-turn`: highlight playfield area where click / double tap happens
- `intro-timewarp`: highlight time warp / time pill area
- `intro-timewarp-thrust`: highlight both thrust controls and the time warp pill
- `intro-trajectory`: highlight projected trajectory + relevant telemetry

## Concrete implementation shape

### Boundary goals

This should stay tutorial-specific for now.

That means:

- no new generic "interactive tutorial framework"
- no global onboarding state shared across unrelated scenarios
- no input-layer branching based on tutorial hint step
- no DOM-level tutorial logic inside scenario files

The first implementation should be deliberately narrow but internally clean.

### State ownership

The onboarding state should live inside tutorial scenario progress/state.

Store:

- active onboarding step id
- completed onboarding steps
- per-step baselines captured at step start
- whether onboarding gate is still active

Suggested per-step baselines:

- `intro-thrust`: accumulated thrust time since step start
- `intro-turn`: heading at step start
- `intro-timewarp`: warp index / multiplier at step start
- `intro-timewarp-thrust`: whether outward-heading precondition has been satisfied, and accumulated high-warp thrust time

This keeps the feature attached to tutorial progression rather than turning into app-global state.

### New modules

#### `src/scenario/tutorialOnboarding/tutorialOnboardingTypes.ts`

Purpose:

- define onboarding step ids
- define focus target ids
- define the tutorial onboarding state shape

Keep it small and tutorial-specific.

#### `src/scenario/tutorialOnboarding/tutorialOnboardingFlow.ts`

Purpose:

- define step order
- define static per-step metadata
- define desktop/mobile copy
- define which focus target each step uses

This file should contain the sequence, words, and step configuration, but not raw runtime mutation.

#### `src/scenario/tutorialOnboarding/tutorialOnboardingProgress.ts`

Purpose:

- evaluate whether the active step is complete
- capture/reset per-step baselines
- advance to the next step
- expose whether the onboarding gate is still active

This should be the main rules module.

It should accept existing gameplay state and derived inputs, then return updated onboarding state.

#### `src/scenario/tutorialOnboarding/tutorialOnboardingActions.ts`

Purpose:

- apply explicit tutorial-only helper effects that are not mere checks
- example: align heading outward from the nearest body before `intro-timewarp-thrust`

This is important because the "make the ship safe before high-warp thrust" behavior is not just validation; it is a guided intervention.

### Existing files that should change

#### `src/scenario/tutorialScenario.ts`

Change:

- own the onboarding sub-state as part of tutorial progress
- start onboarding after the existing phase-1 intro prompt is dismissed
- gate phase-1 completion until onboarding is finished
- call into onboarding progress/actions rather than embedding per-step logic inline

This should remain the orchestrator, not the rules dump.

#### `src/scenario/scenarioDirectiveTypes.ts`

Change:

- possibly add a small scenario prompt / focus descriptor only if the existing directive model cannot already carry what the onboarding overlay needs

Constraint:

- do not widen directives more than needed
- if the onboarding presentation can stay tutorial-only, prefer that

#### `src/presentation/hudPresentation.ts`

Change:

- render the active onboarding prompt/card when tutorial onboarding is active
- map tutorial focus target ids to presentation data
- suppress conflicting transient HUD effects if they fight the onboarding card

This file should render tutorial onboarding, not decide completion.

#### `src/ui/overlayUI/*`

Change:

- add minimal DOM/styling support for:
  - onboarding card
  - focus spotlight / dimming layer
  - optional highlighted UI anchors

Constraint:

- the UI layer should consume simple focus target ids like `timewarp-pill`, not scenario-specific conditionals

### Files that should stay mostly untouched

#### Input modules

- `src/input/keyboardInput.ts`
- `src/input/pointerCameraInput.ts`
- `src/input/bindKeyboardShortcuts.ts`

Rule:

- do not thread tutorial-step conditionals through input handlers
- onboarding should observe already-existing gameplay actions/results

The one exception is if a missing runtime signal makes `intro-point-and-turn` impossible to detect cleanly. In that case, add one narrow signal at the action/runtime layer, not UI-branching logic in inputs.

#### Core simulation

- `src/runtime/simulationStep.ts`
- physics/integration modules

Rule:

- do not put tutorial completion logic into core simulation

### Runtime signals needed

To keep the onboarding checks clean, the rules module will likely need a few already-derived signals from runtime state:

- current heading
- current target-heading-set event or equivalent signal
- current warp multiplier/index
- current thrust level
- nearest major body
- radial direction from nearest body to spacecraft

If one or two of these are not currently exposed in a convenient place, add narrow game-query helpers rather than leaking presentation details into scenario code.

### Presentation contract

The onboarding system should expose a small presentation payload, for example:

- `stepId`
- `title`
- `body`
- `confirmLabel` when relevant
- `focusTarget`
- `tone` or visual variant if needed

The HUD/UI layer should only render this payload.

It should not know:

- how completion is evaluated
- why a given focus target is active
- what tutorial phase logic is gating progression

### Testing shape

Tests should stay behavioral.

Add:

- onboarding flow tests: step transitions and gating
- onboarding rule tests: each step completes only under the intended condition
- tutorial scenario tests: phase 1 does not advance early, and does advance after onboarding completes

Avoid:

- exporting internal helper functions only for tests
- DOM-heavy tests for all onboarding rules

### Recommended implementation order

1. Add onboarding types + flow config.
2. Add onboarding progress/rules module with tests.
3. Integrate onboarding state into `tutorialScenario`.
4. Add onboarding card rendering in HUD/UI.
5. Add focus/dimming presentation.
6. Add the explicit outward-heading helper action for `intro-timewarp-thrust`.
7. Finish with scenario-level tests that prove phase-1 gating works end to end.

The rest of the UI should be dimmed, not hidden, so the player still understands overall context.

## Implementation plan

### Phase 1: add tutorial hint states

Extend tutorial state with a lightweight hardcoded onboarding checklist, for example:

- `intro-thrust`
- `intro-turn`
- `intro-point-and-turn`
- `intro-timewarp`
- `intro-trajectory`
- `intro-complete`

These should live inside tutorial-specific scenario state, not a global tutorial engine.

### Phase 2: define hint triggers and completion checks

Implement the exact hint gating and completion rules described above.

### Phase 3: add tutorial-specific hint presentation

Introduce a presentation layer for tutorial hints that can:

- show one active instruction card
- visually mark the current control or UI area of interest
- dim or gray out non-relevant HUD regions when needed

This should initially be a tutorial-specific overlay, not a reusable UI tutorial system.

### Phase 4: connect hints to actual UI focus regions

Define a small set of focus targets for dimming / highlighting:

- thrust control area
- turn control area
- trajectory line / prediction area
- time warp pill / time UI

The likely implementation is a spotlight-style overlay with "focus regions" rather than ad hoc per-element CSS hacks.

### Phase 5: lock progression until hint completion

For phase 1, keep progression blocked until `intro-complete` is done.

That means the scenario can still simulate normally, but the goal prompt should not advance until the hint gate is satisfied.

### Phase 6: test the desktop/mobile copy split

Validate that the instruction text differs by device while the scenario logic remains shared.

The device split should happen at the presentation/copy layer, not by duplicating tutorial rules.

## Open questions

- Should the hint sequence always run, or only on a first-time tutorial playthrough?
- Should a player be able to skip hints individually or skip the whole hint block?
- Do we want highlight cutouts / spotlight masks immediately, or start with simpler dimmed overlays?
- Should completed hint steps persist across crash restarts inside phase 1?

## Status

Promising
