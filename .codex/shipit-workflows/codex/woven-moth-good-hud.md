# Shipit State

Task: Review and merge woven moth HUD baseline
Branch: codex/woven-moth-good-hud
Current Mode: yeet
Status: completed

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [x] PR opened/updated not requested

## Artifacts

- Brainstorm: waived, user requested preserving already-tested woven-moth HUD baseline.
- Design: inline
- Task slices: waived, implementation already committed.
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Treat `/Users/chmurson/Dev/priv/worktrees/space-web-game/woven-moth/space-web-game` as the source-of-truth worktree for this HUD state.
- Preserve the user-verified woven-moth HUD behavior from staging deploy `https://6a36eaf4442f7d25a96426df--space-web-game-woven-moth.netlify.app`.
- Do not carry forward the stale issue-22 worktree's separate `--mobile-bottom-controls-edge-gap` experiment.
- Leave `.agent-reserved-bottom.patch` untracked and out of review/merge unless explicitly requested.

## Open Questions

- None for local review/merge. Pushing or PR creation was not requested.

## Validation

- [x] git diff --check
- [x] npm test
- [x] npm run build
- [x] coderabbit --base main --agent

## Design Handoff

Scope is to review and merge the already-tested HUD baseline branch, not to introduce new HUD layout changes.

Target branch: `codex/woven-moth-good-hud`.
Merge target: local `main`.

Risk: branch was cut before current `main`, so merge conflicts or accidentally replacing newer main behavior must be checked.

## Implementation Handoff

Current branch commit: `66c6097 fix(ui): preserve woven moth HUD baseline`.

Behavior preserved:

- Bottom HUD and in-game controls menu share the same bottom safe-area model from the woven-moth branch.
- Touch controls stay below HUD layers after the z-index adjustment.
- Offscreen indicators reserve bottom space using visible bottom HUD content.

Changed files in the committed branch work:

- `src/ui/overlayUI/overlayUIStyles.css`
- `src/style.css`
- `src/presentation/bodyPresentation.ts`
- `docs/tech-notes/2026-06-20-ios-wrapper-bottom-hud-safe-area.md`

## Cleanup Notes

- No broad cleanup requested.
- `.agent-reserved-bottom.patch` remains untracked and excluded.

## Review Notes

CodeRabbit:

- Ran `coderabbit --base main --agent`.
- Finding 1: `--left-safe-area-inset` uses half the bottom safe area. Skipped as intentional because `docs/tech-notes/2026-06-20-ios-wrapper-bottom-hud-safe-area.md` documents this exact iOS wrapper behavior and the user manually verified the woven-moth deploy.
- Finding 2: offscreen indicator bottom reservation could reserve too much space if bottom HUD content appeared in the upper viewport. Accepted. Added a lower-half guard before using the bottom HUD top as reserved bottom space.

Ponytail review:

- No new dependency, runtime layout manager, or broad HUD abstraction.
- The accepted fix is a one-condition guard in existing offscreen-indicator logic.
- The skipped CodeRabbit safe-area suggestion would remove a deliberate iOS-wrapper calibration knob, so keeping it is simpler and preserves verified behavior.

Self-review:

- Compared `codex/woven-moth-good-hud` against `main`; branch adds the iOS wrapper HUD tech note, bottom HUD safe-area alignment, touch controls z-index correction, and offscreen indicator bottom-HUD reservation updates.
- Confirmed `.agent-reserved-bottom.patch` is untracked and excluded from review/merge.
- Confirmed the stale issue-22 worktree changes, especially `--mobile-bottom-controls-edge-gap`, are not part of this branch.

Solution retrospect:

- Better baseline is the user-verified woven-moth branch, not the stale issue-22 branch.
- No further HUD collision fix is needed now; manual staging check already looked good.
- Residual risk: iOS wrapper behavior is manually verified, but Safari/PWA/Android can report different safe-area values. The tech note records that follow-up.

Validation results:

- `git diff --check`: passed.
- `npm test`: 37 files passed, 228 tests passed.
- `npm run build`: passed; existing Rollup large-chunk warning remains.

Merge/deploy results:

- Merged `codex/woven-moth-good-hud` into local `main`.
- Merge commit: `9b389c370468d94cee65bf9d67dbc5a6a6a9266b`.
- Production deploy: `https://space-web-game.netlify.app`.
- Unique production deploy: `https://6a36f74c3dfc263a9e9c3ca3--space-web-game.netlify.app`.

## Next Step

Completed. Push `main` if remote publication is desired.
