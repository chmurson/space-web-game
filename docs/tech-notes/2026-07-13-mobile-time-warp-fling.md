# Mobile Time Warp Fling

## Summary

The temporary horizontal `Time Warp control 2` now carries a fast recent drag into one through six additional Time Warp steps, based on release velocity. The post-release roll lasts roughly 280–630ms based on distance, so gentle releases move a short way while strong swipes travel farther without racing through the ladder. The active Time Warp value advances one constrained step at a time as the strip crosses each midpoint, making the fling behave like a rapid swipe that gradually fades instead of committing its full destination at release. Slow drags, tiny motion, a pause before release, constraints, cancellation, and reduced-motion mode keep the existing settle behavior. Rapid follow-up touches now replace an interrupted touch-control session, so the newer gesture remains responsive even when its `touchstart` arrives before the older finger's `touchend`.

## Ownership and decisions

- `src/ui/touchControls/stepSelectorControl/createStepSelectorControl.ts` owns the short recent-motion sample, fling gate, velocity-to-distance mapping, frame-driven ease-out, constrained midpoint commits, and distance-aware settle duration.
- `src/ui/touchControls/stepSelectorControl/stepSelectorControl.css` keeps the existing horizontal strip presentation and the ordinary 180ms settle. The fling reuses the dragging presentation while animation frames move and rebase the strip around each newly active value.
- `src/ui/touchControls/createTimeWarpControl.ts` opts in only the temporary horizontal prototype. The original vertical selector and trajectory selector do not use momentum.
- `src/ui/touchControls/createTouchControls.ts` owns touch-session handoff across Time Warp, trajectory, and thrust controls. A single new touch inside a revealed control cancels an interrupted step-selector or thrust session before starting the replacement; unrelated camera, pinch, and target-heading sessions retain their existing single-session behavior.
- The issue's one/two-step values were initial tuning. After human testing found that effect hard to distinguish, the maintainer first [requested up to four/six-step momentum](https://github.com/chmurson/space-web-game/pull/252#issuecomment-4956344819), then [asked for a slower, velocity-scaled fling](https://github.com/chmurson/space-web-game/pull/252#issuecomment-4980190452). The final mapping starts at one extra step at 450px/s, adds a step for each additional 150px/s, and caps at six steps from 1,200px/s upward.
- Existing preview and commit callbacks remain the authority for min/max and scenario caps. Each animation frame commits only the newly crossed midpoint, rechecks the next preview, and stops at the first blocked step. A new gesture or hidden control cancels the remaining frames at the latest committed value.

## Validation

- Focused unit tests cover all six velocity bands plus the travel, pause, and maximum-step gates.
- The Time Warp prototype GUI test covers gentle, medium, strong, paused, tiny, and constrained releases, including immediate, early, rolling, and settled active values across the 280–630ms window. The full GUI suite covers mouse/touch routing, cancellation, constraints, and the resting, dragging, rolling, and settled screenshots.
- The interrupted-touch GUI regression overlaps touch identifiers before the prior `touchend` and verifies Time Warp-to-Time Warp, Time Warp-to-thrust, and thrust-to-Time Warp handoffs through the shared event router.
- TypeScript build validates the shipped bundle.
- The progressive-value follow-up passed 536 Vitest tests, 16 task-claim tests, 3 automation-workflow tests, the release build, and all 59 mobile GUI tests. The resting, dragging, rolling, and settled Time Warp PNGs were inspected under `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/`; the rolling frame showed `x1m` active in the selector and HUD before settling coherently on `x4m`.

## Follow-up

Remove this behavior with the temporary control if the mobile Time Warp prototype is retired.
