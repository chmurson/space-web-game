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
