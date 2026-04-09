# Automated scenario testing

## Context
As physics, assist logic, prediction rendering, and HUD guidance become more complex, manual testing becomes slow and unreliable.

Short automated scenarios could help verify behavior, visuals, and state transitions.

## Proposal
Create small test scenarios that validate:

- simulation behavior
- assist behavior
- trajectory rendering state
- HUD guidance text/state
- crash detection
- target switching
- prediction line visibility

## Examples

### Moon capture debug
Start near Moon capture range and verify:

- target is Moon
- guidance reaches `Ready: press C`
- capture assist burns retrograde
- state becomes bound or impact is predicted

### Circularize debug
Start in an ugly captured Moon orbit and verify:

- circularize assist activates
- target circular orbit ring is visible
- assisted prediction differs from coast prediction
- guidance eventually reaches `Orbit stable-ish`

### Crash prediction
Start on an impact trajectory and verify:

- guidance shows predicted impact
- endpoint marker is red
- crash state triggers on collision

### Trajectory render regression
Use an almost straight-line trajectory and verify:

- trajectory line reaches endpoint marker
- endpoint marker is visible
- loop trimming does not cut the path

## Possible implementation
Add a lightweight test harness that can:

- load a scenario
- run simulation for N seconds
- inspect `SimulationState`
- inspect derived guidance state
- optionally snapshot visual state for manual review

## Open questions
- Should tests run in Node for pure simulation only?
- Should visual tests run in browser via Playwright?
- How much rendering state should be asserted automatically?
- Should debug scenarios double as test fixtures?

## Status
Rough / promising
