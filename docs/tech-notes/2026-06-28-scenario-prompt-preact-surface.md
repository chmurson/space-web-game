# Scenario Prompt Preact Surface

## What Changed

- Added a typed `ScenarioPromptSurface` for the scenario prompt and a typed replay pill surface.
- Changed the scenario prompt updater to render prompt and replay pill state through Preact when the prompt identity changes.
- Kept the existing updater as the adapter for prompt identity throttling, action serialization, Floating UI positioning, trajectory guide refs, focus highlighting, and cleanup.
- Moved the live overlay prompt creation onto `createScenarioPromptUI`, removing duplicate scenario prompt and replay pill markup from `createOverlayUi`.
- Added focused Playwright coverage for the Reach the Moon replay pill reopening and closing through the existing adapter hooks.

## Why

Issue #76 tracks the next slice of the DOM UI migration after the menu surfaces moved to Preact. The scenario prompt and replay pill were still user-visible imperative markup even though their updates are already identity-driven, making them a contained migration target that does not require a broader HUD or state-store rewrite.

## Key Files

- `src/ui/components/ScenarioPromptSurface.tsx`: owns typed Preact markup for the prompt, action buttons, trajectory guide SVG, and replay pill.
- `src/ui/scenario-prompts/scenario-prompts.ts`: keeps prompt identity, action serialization, positioning, focus, and cleanup as the adapter boundary.
- `src/ui/overlayUI/createOverlayUi.ts`: creates the live prompt UI through the Preact-backed scenario prompt factory.
- `src/presentation/hudPresentation.ts`: passes the Preact render callback into the prompt updater.
- `tests/gui/mobileHudScreenshot.spec.ts`: covers the replay pill adapter path and keeps existing mobile screenshot states.

## Decisions

- Did not add an app-wide Preact root, prompt framework, modal framework, or generic store.
- Preserved existing class names, data attributes, button roles, prompt modes, Floating UI arrow hooks, trajectory guide refs, and replay pill label/action behavior.
- Kept replay pill and prompt roots separate because the pill lives in the bottom HUD area while the prompt backdrop lives under the app root.
- Left tutorial copy, speed guidance, and trajectory tooltip placement unchanged because those are owned by separate issues.

## Validation

- `npx biome check --write src/ui/components/ScenarioPromptSurface.tsx src/ui/scenario-prompts/scenario-prompts.ts src/ui/overlayUI/createOverlayUi.ts src/presentation/hudPresentation.ts tests/gui/mobileHudScreenshot.spec.ts tests/presentation/hudPresentation.test.ts docs/tech-notes/2026-06-28-scenario-prompt-preact-surface.md`: passed.
- `npm run build`: passed; Vite reported the existing large chunk warning.
- `npm test`: passed, 47 Vitest files with 319 tests plus 16 automation claim tests.
- `npm run test:gui`: passed, 16 Playwright GUI tests.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-5be36-ial-coach-prompt-transition-mobile-chromium/mobile-tutorial-coach-prompt.png`; it matched the expected mobile tutorial coach prompt state with the Burn edge control highlighted and no text overlap.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-8c0aa-Moon-replay-pill-transition-mobile-chromium/mobile-reach-moon-replay-pill.png`; it matched the expected Reach the Moon replay pill state with the Mission Brief pill visible and gameplay HUD unobstructed.
- `git diff --check`: passed.

## Follow-Ups

- None currently.
