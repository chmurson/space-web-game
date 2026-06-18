# Target Notification

## What Changed

- Added a dismissible bottom HUD notice for changed automatic target recommendations while the player is in manual target mode.
- Added a transient bottom HUD notice when automatic targeting changes the current trajectory target while the player remains in automatic mode.
- The manual recommendation notice opens the existing Target selector and has a separate dismiss button.
- Added a small target-notice model so initial target/recommendation state becomes the baseline, while later meaningful target changes can notify the player.

## Why It Changed

Manual targeting can intentionally diverge from the automatic trajectory recommendation. The new notice surfaces changed recommendations without switching the player's pinned target.

Automatic targeting can also change the active body as the trajectory evolves. The notice now surfaces that target change briefly so the player can understand why the HUD target shifted without needing to dismiss a status update.

## Key Files

- `src/ui/createTargetRecommendationNotice.ts` owns the notice model and DOM presenter.
- `src/ui/overlayUI/createOverlayUi.ts` owns the notice DOM refs.
- `src/ui/overlayUI/overlayUIStyles.css` owns the compact desktop/mobile notice layout.
- `src/ui/touchControls/createTouchControls.ts` exposes the existing Target selector opener and committed target-state callback.
- `src/presentation/hudPresentation.ts` syncs the notice from the existing `AssistTargetUiState`.
- `tests/ui/targetRecommendationNotice.test.ts` covers manual recommendation changes, automatic target changes, dismissal, commit-clear, and return-to-auto baselines.

## Implementation Decisions

- Kept target selection and recommendation rules in existing runtime queries/actions.
- Did not add a generic toast framework or target-tab styling.
- The notice waits for a recommendation change after manual targeting starts instead of announcing the current recommendation immediately.
- Manual recommendation notices are durable and dismissible because they offer an action: review or change the pinned target.
- Automatic target-change notices are transient and non-dismissible because automatic mode already accepted target changes.
- The notice bottom-aligns with the rest of the bottom HUD on mobile so it reads as part of the same control row.

## Validation

- `npm test -- targetRecommendationNotice`: passed, 7 tests.
- `npm test`: passed, 37 files and 223 tests after rebasing onto `origin/main`.
- `npm run build`: passed; Vite reported the existing large-chunk warning.
- `npx biome lint src tests scripts`: passed.
- Browser verification: Chrome DevTools fallback used because the in-app Browser was unavailable. Checked Free Roam desktop and mobile/touch emulation, notice layout, accessible labels, click-to-open behavior for durable manual recommendations, disabled/non-dismissible controls for transient automatic target notices, transient timeout behavior, and bottom-aligned mobile placement. Unit tests cover the state rules that are hard to trigger deterministically through natural orbital simulation.

## Follow-Ups

- None.
