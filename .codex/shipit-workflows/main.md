# Shipit State

Task: GC and frame-time diagnostics in FPS/debug HUD
Branch: main
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
- [x] PR opened/updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: waived; task was already implemented before Shipit state was created.
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Browser JavaScript cannot reliably expose exact GC events in all browsers, so the HUD reports native GC when exposed and otherwise labels detections as probable GC.
- GC/frame diagnostics run only while the debug panel or FPS meter is enabled.
- FPS meter shows a compact 5-second frame-time graph with GC/probable-GC markers as bottom dots.
- Keep unrelated `.codex/shipit-workflows/visual-improvement-for-space-plane/` screenshots out of this commit.

## Open Questions

- none

## Validation

- [x] `npx biome lint src/presentation/hudPresentation.ts src/style.css`
- [x] `npm test -- tests/ui/hudText.test.ts tests/runtime/browserGcProbe.test.ts`
- [x] `npm test`
- [x] `npm run build:dev`
- [x] `npm run build`
- [x] Production deploy smoke check with `curl -I https://space-web-game.netlify.app`
- [x] `coderabbit --base main --agent` attempted; stopped after producing no output for about 90 seconds.

## Next Step

Complete.

## Brainstorm Handoff

Goal: make GC-related frame hitches easier to inspect in the browser game without adding normal-play overhead or cluttering the HUD.

User-facing behavior:
- Debug performance panel reports GC/probable-GC count, last/max estimated pause, and reclaimed heap where available.
- FPS meter popup includes compact GC status plus a small frame-time graph.
- GC events are marked as unobtrusive dots at the bottom of the graph.

Non-goals:
- Do not claim exact browser GC timing where the browser does not expose native GC events.
- Do not add a new always-visible UI panel.

## Design Handoff

Scope:
- `src/runtime/browserGcProbe.ts`: isolated browser GC/probable-GC probe.
- `src/runtime/frameLoop.ts`: sample frame intervals and gate diagnostics by debug/FPS toggles.
- `src/ui/hudText.ts`: format debug/FPS text and graph model.
- `src/presentation/hudPresentation.ts`: render FPS meter text and SVG graph.
- `src/style.css`: compact FPS graph styling.
- Tests for probe behavior and graph model math.

Risks:
- Browser GC data is heuristic when native entries are unavailable.
- FPS graph must stay compact and not obscure playfield.
- Diagnostics should not sample heap or maintain frame history while disabled.

## Implementation Handoff

Implemented:
- Added `createBrowserGcProbe` with lazy enable/disable, native observer support, heap-drop/frame-gap fallback, recent event retention, and copied stats.
- Wired frame loop to enable GC probe only when debug panel or FPS indicator is visible.
- Added 5-second FPS frame sample history only while FPS meter is enabled.
- Rendered FPS text plus inline SVG sparkline with 60Hz budget line and bottom GC marker dots.
- Added tests for probe behavior, copied recent events, FPS text, graph path mapping, and marker positioning.

Known gaps:
- Screenshot/browser visual QA was not available in this session; HTTP boot smoke checks were used.

## Cleanup Notes

Cleanup performed:
- Scoped CSS diff back to FPS meter rules after formatter churn.
- Replaced graph GC vertical lines with bottom dots after visual readability feedback.

Cleanup intentionally skipped:
- No extraction of SVG graph renderer into a shared helper; it is currently specific to one HUD surface.

## Review Notes

Automated review:
- CodeRabbit command `coderabbit --base main --agent` was run as required by repo guidance but produced no output for roughly 90 seconds. It was interrupted and treated as an automated-review gap.

Self-review findings:
- No correctness issues found in the current diff.
- GC probe starts/stops with debug/FPS visibility and does not sample while disabled.
- Native GC entries and probable-GC heuristic events are copied out in stats, avoiding mutable internal event exposure.
- FPS graph filters both samples and GC markers to the last 5 seconds, so old markers do not reappear after toggling the FPS meter.
- GC markers are bottom dots instead of full-height lines, reducing visual interference with frame-time reading.

Ponytail review lens:
- Kept the SVG graph renderer local to `hudPresentation`; no new shared abstraction is justified yet.
- Used plain DOM/SVG APIs and existing HUD styling rather than adding a chart dependency.
- Frame sample history is a simple bounded in-memory array; no extra state system or renderer layer added.

Requirement coverage:
- Debug panel reports GC/probable-GC count and pause/reclaimed-heap stats.
- FPS meter reports compact GC status and shows a 5-second frame-time graph.
- GC/probable-GC events are represented as bottom dots on that graph.
- Diagnostics run only while debug or FPS surfaces are enabled.

Residual risk:
- Browser fallback is still heuristic by design; exact GC execution is only available when the runtime exposes native GC performance entries.
- Screenshot/browser visual QA was unavailable in this session, so validation relies on tests, builds, local HTTP boot checks, and production HTTP checks.

Validation results:
- `npx biome lint src/presentation/hudPresentation.ts src/style.css`: passed.
- `npm test -- tests/ui/hudText.test.ts tests/runtime/browserGcProbe.test.ts`: passed.
- `npm test`: passed, 34 files / 199 tests.
- `npm run build:dev`: passed.
- `npm run build`: passed after review.
- Production deploys completed successfully, with `curl -I https://space-web-game.netlify.app` returning `HTTP 200`.

Follow-up issues:
- None proposed.

## Yeet Notes

- Code commit: `9197e24178c3b304da365213d5ce97cce682bb3a`
- Shipit state commits: `8a300e4` and the final docs-only commit containing this completed state.
- Branch: `main`
- Push: `origin/main` updated with the code commit and completed Shipit state.
- PR: not applicable; user requested direct commit to `main`.
- Production deploy after code commit:
  - Production URL: https://space-web-game.netlify.app
  - Unique deploy URL: https://6a3272d2e97bd4583b19237a--space-web-game.netlify.app
  - Build logs: https://app.netlify.com/projects/space-web-game/deploys/6a3272d2e97bd4583b19237a
