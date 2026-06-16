# Shipit State

Task: New looks of turning animations
Branch: new-looks-of-turning-animations
Current Mode: implement
Status: active

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [ ] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [ ] PR opened/updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: pending

## Decisions

- Use git-safe branch slug `new-looks-of-turning-animations` for the requested branch focus "new looks of turning animations".
- Branch from `origin/main` at `b6feb43`.
- Follow AGENTS.md deployment rules: this is a non-`main` branch, so executable/user-visible changes should be deployed to the configured staging target before handoff.
- Follow AGENTS.md verification rules for gameplay, camera, rendering, HUD, input, or responsive-layout changes.
- Likely relevant skills for later phases: `game-studio:three-webgl-game` for runtime turning animation behavior, `game-studio:web-game-foundations` if the change touches simulation/render boundaries, and `game-studio:game-playtest` for browser verification.
- Scope the first implementation to the double-click map ripple marker and the heading-turn indicator that follows the ship.
- Keep the target-heading behavior transient and avoid changing simulation, controls, or autopilot timing.

## Open Questions

- None for the current implementation pass.

## Validation

- [x] npm run build
- [x] Browser playtest screenshot/video-style check for the turning animation on desktop and mobile
- [x] npm run deploy:netlify

## Next Step

Enter Shipit review when requested.

## Brainstorm Handoff

Problem statement: The double-click target ripple and heading-turn line feel too strong for the current tactical-map presentation.

Goals: Make the double-click ripple more delicate and tactical-map-like while keeping its transient behavior. Replace the strong circular heading line that follows the ship with a softer 2D slice/wedge shape that communicates the same turn arc.

Non-goals: Do not change unrelated UI, physics, controls, autopilot timing, target-heading lifetime, or scenario behavior.

Current understanding: This is a visual presentation task in DOM/SVG overlay code, not a Three.js scene or simulation task.

Unresolved questions: none for the current pass.

User-facing behavior: Double-clicking still creates a temporary map marker at the target position. While the ship turns toward a selected heading, the overlay shows a translucent tactical wedge/slice instead of a heavy circular stroke.

Edge cases and failure states: The animation must not hide important HUD or gameplay cues, must remain readable on mobile, and must not introduce performance stutter.

## Design Handoff

Implementation scope: Update `src/ui/overlayUpdates.ts`, `src/ui/overlayUI/createOverlayUi.ts`, `src/presentation/spacecraftPresentation.ts`, and `src/style.css`.

UI/render flow: Keep the ripple as a transient DOM element anchored to either screen or projected world position. Keep the heading-turn overlay as an SVG anchored to the ship's projected screen position.

Visual direction: Use thinner, softer cyan tactical-map strokes for the double-click marker. Replace the circular heading arc stroke with a translucent sector/wedge path between the current heading and target heading. Soften the straight target-heading line so it supports the wedge without dominating it.

Risks: The wedge path must handle left/right turns and large angles correctly. The ripple must still be removed after its existing short lifetime. SVG path updates must not throw when target positions are null.

Validation commands: `npm run build`; browser screenshot checks on desktop and mobile with a selected heading target.

Cleanup expectations: Rename only where it improves clarity. Avoid a reusable component unless a second consumer appears.

Completion criteria: Ripple is visibly more delicate and transient. Heading-turn indicator is a subtle slice-like shape following the ship. Build and browser checks pass.

## Task Slices

- [x] Change ripple markup/update logic to support tactical rings and center mark.
- [x] Update ripple CSS to softer tactical-map styling.
- [x] Replace heading arc SVG path with a turn-slice path.
- [x] Soften target-heading line styling.
- [x] Run build and browser checks.

## Implementation Handoff

Changed files:

- `src/ui/overlayUpdates.ts`
- `src/ui/overlayUI/createOverlayUi.ts`
- `src/presentation/spacecraftPresentation.ts`
- `src/style.css`
- `.codex/shipit-workflows/new-looks-of-turning-animations.md`

Completed task slices: all implementation task slices completed.

Behavior implemented: Double-click target markers still appear transiently and follow the selected world position, but now use two thin tactical rings, crosshair ticks, and a small center diamond instead of three bright expanding circles. The target-heading circular arc is replaced with a translucent annular slice between the ship's current heading and target heading. The straight target-heading line remains but is softened to a low-alpha dashed support line.

Deviations from design: none.

Blockers: none.

Known gaps: Formal Shipit review and CodeRabbit have not run yet.

## Cleanup Notes

Cleanup performed: Renamed the SVG path ref from arc to turn slice so the overlay API matches the new visual role. Kept the effect in existing DOM/SVG overlay code rather than adding a Three.js shader or new animation subsystem.

Cleanup intentionally skipped: No reusable tactical marker abstraction was added because there is only one marker consumer.

Stale artifacts/docs: Shipit state updated inline.

## Validation Results

- `npm run build` passed.
- `git diff --check` passed.
- `npm run deploy:netlify` passed. Staging URL: https://fanciful-bunny-d77b4b.netlify.app. Unique deploy URL: https://6a31aa9c8a46745482cb241b--fanciful-bunny-d77b4b.netlify.app.
- Desktop browser check passed: real canvas `dblclick` creates the new marker DOM, keeps the target-heading overlay active, and renders a turn-slice SVG path with softened line styling.
- Mobile browser check passed at mobile-sized viewport: real canvas `dblclick` creates one marker inside viewport bounds, keeps the target-heading overlay active, and renders the turn-slice SVG path without blocking HUD controls.
- Screenshots captured for visual QA:
  - `/tmp/turn-animation-desktop-4.png`
  - `/tmp/turn-animation-mobile.png`
