# Improve guided onboarding

## Context
The tutorial currently starts with a guided onboarding gate inside phase 1, before the player is allowed to complete the escape-Earth objective. This is useful because it teaches the core controls in sequence, but the current flow is mostly a linear checklist. It may still feel mechanical or unclear about how each action helps the player solve the actual mission.

## Current Behavior
Guided onboarding starts after the player confirms the initial `Leave Earth Orbit` prompt. Simulation continues normally, but phase 1 progression is blocked until onboarding finishes.

## Current Sequence

1. `Use Thrust`
   - Player action: hold thrust briefly.
   - Completion: automatic after `400ms` of active main thrust.
   - Purpose: teach the basic engine input.
   - Prompt: coach anchored to `trajectory`.
   - Hidden UI: scenario info button, time warp pill, trajectory line.
   - Mobile touch hint: `thrust-zone`, shown as a green pulsing lower-right touch area labeled `Press and hold here`.

2. `Keep Thrusting`
   - Player action: keep thrusting for longer.
   - Completion: automatic after `5s` of accumulated main thrust.
   - If the player stops long enough, progress decays and can send them back to the previous thrust step.
   - Purpose: teach that sustained burns matter.
   - Prompt: coach anchored to `speed-pill`.
   - Hidden UI: scenario info button, time warp pill, trajectory line.
   - Mobile touch hint: `thrust-zone`.

3. `Thrusting Complete`
   - Player action: read the card and press Continue.
   - Completion: manual Continue button.
   - Purpose: explain thrust feedback and speed display.
   - Prompt: coach anchored to `trajectory`.
   - Hidden UI: scenario info button, time warp pill, trajectory line.
   - Mobile touch hint: none.

4. `Turn The Ship`
   - Player action: rotate the ship.
   - Completion: automatic after `90deg` of accumulated heading change.
   - Purpose: teach directional control.
   - Prompt: coach anchored to `speed-pill`.
   - Hidden UI: scenario info button, time warp pill, trajectory line.
   - Mobile touch hint: none.

5. `Point By Double-Tapping`
   - Player action: double-click or double-tap the playfield to set a direct heading.
   - Completion: automatic after a heading selection happens and the ship finishes turning.
   - Purpose: teach direct heading selection.
   - Prompt: coach anchored to `trajectory`.
   - Hidden UI: scenario info button, time warp pill, trajectory line.
   - Mobile touch hint: none.

6. `Raise Time Warp`
   - Player action: increase time warp.
   - Completion: automatic when time warp reaches at least `x1m`, internally multiplier `60`.
   - Purpose: teach time compression.
   - Prompt: coach anchored to `trajectory`.
   - Hidden UI: scenario info button, trajectory line.
   - Visible UI: time warp pill is now visible.
   - Mobile touch hint: none.

7. `Burn At x1m`
   - Tutorial points the ship outward from the nearest body and disables assist.
   - Player action: keep time warp at `x1m` or higher and thrust for `2s`.
   - Completion: automatic after `2s` of outward-aligned high-warp thrust.
   - Purpose: teach combining heading, thrust, and time warp.
   - Prompt: coach anchored to `trajectory`.
   - Hidden UI: scenario info button, trajectory line.
   - Visible UI: time warp pill stays visible.
   - Mobile touch hint: `thrust-zone`.

8. `Read The Trajectory`
   - Player action: read the card and press Continue.
   - Completion: manual Continue button.
   - Purpose: explain that the projected path shows where current motion is taking the ship.
   - Prompt: coach anchored to `trajectory`.
   - Hidden UI: scenario info button.
   - Visible UI: trajectory line and time warp pill are visible.
   - Mobile touch hint: none.

9. `Free Flight Unlocked`
   - Player action: read the card and press Continue.
   - Completion: manual Continue button.
   - Purpose: tell the player to keep flying until they get `5 Earth radii` away from Earth.
   - Ends the onboarding gate and lets the real phase-1 objective take over.
   - Hidden UI: none from onboarding.
   - Visible UI: normal phase-1 UI is restored.
   - Mobile touch hint: none.

Current guided touch-control UI:

- Only one guided touch target exists: `thrust-zone`.
- It renders a fixed green pulsing frame in the lower-right touch-control area.
- It is labeled `Press and hold here`.
- It appears only on mobile input mode.
- It is currently used by `Use Thrust`, `Keep Thrusting`, and `Burn At x1m`.

## Suggested Change: Split Initial Thrust Onboarding

The first thrust lesson should teach the actual mobile interaction in two parts: first reveal the thrust control, then swipe the revealed control upward to turn thrust on. The current copy says to press and hold, but the implemented control is closer to a reveal-then-swipe interaction.

High-level behavior:

- Rename the current first step from `Use Thrust` to `Show Thrust Control`.
- `Show Thrust Control` should ask the player to press/hold in the lower-right control area until the thrust control appears.
- On mobile, `Show Thrust Control` should keep using the existing `thrust-zone` touch hint.
- Once the thrust control is visible and interactive, advance to a new `Use Thrust` step.
- The new `Use Thrust` step should ask the player to swipe the visible thrust button upward to turn on thrust.
- The new `Use Thrust` step should not show the broad `thrust-zone` hint, because the control itself is now visible.
- The new `Use Thrust` coach prompt should anchor to the thrust control, not to the trajectory or speed pill.
- After roughly `400ms` of active main thrust, advance from `Use Thrust` to `Keep Thrusting`.
- If the player releases before turning thrust on and the thrust control disappears, move back from `Use Thrust` to `Show Thrust Control`.
- `Keep Thrusting` should fall back to `Use Thrust` when thrust turns off or accumulated thrust progress decays to zero.
- If `Keep Thrusting` falls back while the thrust control is no longer visible, fall back to `Show Thrust Control` instead.

Suggested revised initial sequence:

1. `Show Thrust Control`
   - Player action: press/hold in the lower-right touch-control area until the thrust control appears.
   - Completion: automatic when the thrust control becomes visible and interactive.
   - Purpose: teach where the mobile thrust control lives.
   - Prompt: coach anchored to `trajectory` or another stable UI target until the control exists.
   - Hidden UI: scenario info button, time warp pill, trajectory line.
   - Mobile touch hint: `thrust-zone`.

2. `Use Thrust`
   - Player action: swipe the visible thrust button upward to turn thrust on.
   - Completion: automatic after about `400ms` of active main thrust.
   - Backtracking: return to `Show Thrust Control` if the thrust control disappears before thrust turns on.
   - Purpose: teach the actual thrust-on gesture.
   - Prompt: coach anchored to the thrust control.
   - Hidden UI: scenario info button, time warp pill, trajectory line.
   - Mobile touch hint: none.

3. `Keep Thrusting`
   - Player action: keep thrusting for longer.
   - Completion: automatic after `5s` of accumulated main thrust.
   - Backtracking: return to `Use Thrust` if thrust turns off or progress decays to zero. If the thrust control is no longer visible, return to `Show Thrust Control`.
   - Purpose: teach that sustained burns matter.
   - Prompt: coach anchored to `speed-pill`.
   - Hidden UI: scenario info button, time warp pill, trajectory line.
   - Mobile touch hint: none unless the implementation decides the broad zone hint is still needed after the control disappears.

Low-level implementation notes:

- Add a new onboarding step id for the reveal step, for example `intro-show-thrust-control`.
- Keep or rename the existing `intro-thrust` step as the actual `Use Thrust` step, depending on how much migration churn is acceptable.
- Update `tutorialOnboardingStepOrder` so the initial order is `intro-show-thrust-control`, `intro-thrust`, `intro-keep-thrusting`.
- Update prompt definitions in `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`.
- Add a new scenario prompt anchor such as `thrust-control` in `src/scenario/scenarioPromptTypes.ts`.
- Teach the prompt UI how to resolve `thrust-control` to the `.touch-thrust-control` element in `src/ui/scenario-prompts/scenario-prompts.ts`.
- The onboarding progress module currently only observes `runtime.simulation.state.controls.main > 0`. That is not enough to distinguish "control visible" from "thrust engaged".
- Expose a small runtime/UI signal from the touch controls, likely under `runtime.ui`, for thrust control state such as `visible`, `interactive`, and `engaged`.
- Prefer `interactive` over raw `visible` for advancing out of `Show Thrust Control`, because the thrust control has a pending/fade-in phase before it can accept the swipe.
- Wire the touch-control state from `src/ui/touchControls/thrustControl.ts` through `src/ui/touchControls/createTouchControls.ts` into runtime UI state.
- Keep `controls.main > 0` as the source of truth for actual thrust engagement and thrust-duration thresholds.
- Update tests in `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts` for the new step order, backtracking behavior, and mobile touch hint expectations.
- Update scenario prompt tests that assert mobile onboarding prompt content, especially expected title and `touchHintTarget`.
- Verify with the relevant scenario/onboarding tests and a build check.

## Improvement Direction
Make the guided onboarding feel less like isolated control drills and more like preparation for the immediate mission: escaping Earth.

Possible improvements:

- Connect every step to the escape objective, not just to the input being demonstrated.
- Reduce repeated passive cards where the player has already demonstrated the behavior.
- Add clearer success feedback after each action so players know what changed in the flight state.
- Make the trajectory explanation more interactive by asking the player to alter the projected path, not just read a card.
- Reconsider whether `Burn At x1m` should happen before or after trajectory explanation, since high-warp thrust may be easier to understand once the player has been taught what the projected path means.
- Tune timing thresholds so early steps feel responsive but still intentional.
- Make failure/backtracking behavior explicit if the tutorial sends the player back or decays progress.

## Open Questions
- Should onboarding teach trajectory earlier, before time warp and high-warp thrust?
- Should `Thrusting Complete`, `Read The Trajectory`, and `Free Flight Unlocked` all remain manual Continue cards?
- Should the player be asked to make the projected path visibly widen or lift away from Earth before free flight unlocks?
- Should onboarding recover gracefully if the player crashes during the gate, preserving completed steps?
- Should desktop and mobile have different step ordering, or only different copy and touch hints?

## Status
Rough
