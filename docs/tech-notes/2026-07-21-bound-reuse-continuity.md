# Bound Reuse Continuity

## What Changed

- Every passive-coast trim-and-extend attempt now validates from the previous accepted cache state to the current live state. Reuse no longer skips three validations and catches up on the fourth.
- Every reuse candidate that passes state validation computes the short live-state-to-first-retained-point seam, even when the first retained sample still has valid closest-approach metadata. A failed validation or seam check still falls back to a full prediction.
- Bound validation position checks use target-relative spacecraft speed multiplied by 20 seconds, clamped between 5 km and 50 km. Bound seam checks use 25 seconds, clamped between 5 km and 60 km.
- Unbound spacecraft position checks and all body-position checks remain at 5 km. Spacecraft/body velocity, scalar, elapsed, semantic, control, impact, elapsed-window, loop-policy, and retained-path gates remain unchanged.
- The worker still forces a full calculation after sixteen accepted reuses to rebase the retained middle, terminal simulation state, and future metadata from the live state.

## Why It Changed

Hands-on testing of a roughly 135 Mm Earth orbit showed repeated full fallbacks before the reuse limit. The failures were position-only: validation reported 5.3-18.4 km spacecraft differences and seam checks reported 6.2-7.4 km, while velocity, body, scalar, and elapsed measurements remained inside their limits.

The live simulation advances with a one-second physics cap. Medium bound predictions outside the close-orbit precision band use the production far predictor's eight-second integration cap. Their small numerical phase difference can therefore exceed a fixed 5 km position threshold without representing a control change or materially different orbit. Expressing the bound allowance as a limited number of seconds of target-relative travel accepts the expected phase error without granting unbound paths or body motion a broader gate.

Deferred validation also made every fourth validation cover several refresh intervals. Validating every reuse performs approximately the same aggregate elapsed-prefix integration across steady rolls, but distributes it evenly and catches real divergence immediately.

Later hands-on history showed two pairs of consecutive full calculations. In each pair, an aged retained seam first exceeded the 30 km shared cap; the fresh eight-second prediction then accumulated 26.4-34.2 km of position phase error over the next 17,000-23,400 seconds and exceeded its ten-second allowance. The validation duration exactly matched the time since the preceding full calculation, confirming that the cache anchor had reset correctly.

Validation and seam therefore use separate bounded policies. Twenty seconds with a 50 km cap accepts the observed fresh-cache validation differences while the existing velocity and scalar gates still reject materially different state. Twenty-five seconds with a 60 km cap accepts the observed 14.1 km low-speed seam, but the 62.2 km and 82 km aged-tail seams still mandate a full rebase.

## Key Files and Ownership

- `src/prediction/farTrajectoryPrediction.ts` owns cache compatibility, per-reuse validation, the bound position-tolerance policy, mandatory seam checking, trim/extend composition, diagnostics, and the sixteen-reuse full rebase.
- `tests/prediction/farTrajectoryPrediction.test.ts` covers every-reuse validation, immediate divergence rejection, medium-orbit phase tolerance, mandatory seam behavior, and the retained full-rebase limit.
- The existing runtime and DevTools diagnostics continue carrying each measurement's actual delta and active tolerance without a contract expansion.

## Important Decisions

- The speed input is spacecraft velocity relative to the selected target, not world-space spacecraft speed or the velocity difference between predicted and live states.
- The 5 km floor preserves the prior low-speed behavior. Separate 50 km validation and 60 km seam caps prevent high-speed but technically bound paths from receiving unbounded allowances.
- Validation remains slightly tighter because it compares the freshly predicted current state with the live state. Seam receives five more seconds of phase allowance because it compares a live-state reconstruction with an older retained future point.
- Body positions retain their fixed 5 km gate because the observed body drift was already comfortably inside it and does not represent spacecraft orbital phase.
- A full calculation has no seam because it does not splice cached samples. “Mandatory seam” means every trim-and-extend acceptance requires the check; an attempt already rejected by state validation exits without spending additional work on the seam.
- The sixteen-reuse rebase remains because validation checks the state at now and the seam checks only the first retained future point. Neither independently verifies the retained middle or cached terminal state against a fresh full prediction.
- The current eight-, four-, two-, and one-second precision discussion concerns physics integration steps, not rendered sample spacing. Future progressive refinement may replace elapsed-prefix validation and the fixed reuse cap with displayed high-precision prefix work, boundary-state checkpoints, and explicit precision/age guarantees; that larger mechanism is not part of this change.

## Validation

- Focused prediction/runtime/DevTools/UI/presentation Vitest coverage passed: 6 files, 112 tests.
- TypeScript (`tsc --noEmit`) and targeted Biome checks passed.
- The full repository suite passed: 63 Vitest files with 597 tests, plus 16 automation-claim tests and 3 automation-workflow tests.
- The release build passed, including configuration validation.
- All 79 Playwright GUI tests passed. The regenerated tutorial trajectory replay screenshot was inspected and remained continuous and coherent through the Earth/Moon scene.
- `git diff --check` passed.

## Follow-Ups and Known Gaps

- The fixed sixteen-reuse cap remains a conservative proxy for unmeasured future-path age. Revisit it when progressive refinement provides explicit cache precision and age metadata.
- Validation and seam work remain worker-local, so they do not block the render loop, but hands-on device profiling should confirm far-result freshness under sustained high time warp.
- Bound/unbound policy transitions still calculate the full path.
