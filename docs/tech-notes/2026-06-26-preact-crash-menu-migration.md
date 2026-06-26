# Preact Crash Menu Migration

Issue: https://github.com/chmurson/space-web-game/issues/24

## What Changed

- Moved crash menu markup from `innerHTML` in `src/ui/createCrashMenu.ts` into the typed Preact component `src/ui/components/CrashMenuSurface.tsx`.
- Kept the existing `createCrashMenu` factory API so app/runtime crash synchronization, crash-camera panel measurement, and caller ownership did not change.
- Extracted the shared Preact host/root-ref/render adapter into `src/ui/createPreactUiSurface.ts` and moved both migrated menu factories onto it.
- Extracted shared Preact menu primitives into `src/ui/components/MenuSurfacePrimitives.tsx` for panels, copy, kickers, descriptions, action stacks, and action buttons.
- Extracted shared load-game availability/guard logic into `src/ui/loadGameAvailability.ts`.
- Added a shared debug snapshot clear helper and refreshed menu load-state when the guarded load action no-ops because a saved snapshot disappeared after the menu last synced.
- Preserved crash menu ARIA attributes, button order, `data-crash-menu-action` selectors, primary-action class behavior, load/checkpoint visibility, focus restoration, `Escape`, `R`, and focus-trap keyboard handling.
- Added a Playwright browser-component regression for the public crash menu factory.

## Why

The first issue #24 slice moved the main menu to Preact. The crash menu is the next small, low-frequency surface: it is user-visible, complete enough to validate independently, and does not require migrating high-frequency HUD telemetry or world-space labels.

## Key Files

- `src/ui/components/CrashMenuSurface.tsx` owns crash menu render markup and derived title/description text.
- `src/ui/components/MainMenuSurface.tsx` and `src/ui/components/CrashMenuSurface.tsx` now use the shared menu primitives while keeping surface-specific view and action flow local.
- `src/ui/components/MenuSurfacePrimitives.tsx` owns the reusable visual grammar for menu panels, copy, labels, descriptions, action stacks, and action buttons.
- `src/ui/createCrashMenu.ts` remains the adapter boundary for runtime actions, visibility, state sync, focus restoration, and keyboard shortcuts.
- `src/ui/createPreactUiSurface.ts` owns the reusable Preact host element, root ref capture, render call, and missing-root guard for Preact-backed UI factories.
- `src/ui/loadGameAvailability.ts` owns the repeated debug-snapshot load availability check and guarded load-game callback.
- `src/debugScenarioSnapshot.ts` owns read, write, and best-effort clear access for the debug snapshot storage key.
- `src/ui/createMainMenu.ts` also uses `createPreactUiSurface` so the next migrated surface can follow one adapter pattern.
- `src/app/createAppComponents.ts` still owns crash-state synchronization and queries `.crash-menu-panel` through the existing `CrashMenu.element`.
- `src/style.css` owns the shared `.menu-panel`, `.menu-copy`, `.menu-kicker`, `.menu-description`, and menu action variant classes, plus the surface-specific menu layout hooks.

## Decisions

- Did not add a generic Preact UI root, store, signal layer, route/view DSL, generic modal, or focus manager. The shared pieces are visual primitives and small load-game helpers only.
- Did not add a DOM implementation dependency for Vitest. The focused regression runs in Playwright against a real browser DOM and the public factory.
- Left top menu, in-game controls, HUD telemetry, prompts, labels, and indicators for later slices.

## Reuse Boundary

- Shared now: `createPreactUiSurface` handles the DOM host, Preact render call, root-ref capture, and missing-root guard for Preact-backed UI factories.
- Shared now: `MenuSurfacePrimitives` defines the stable menu design language for panels, copy, kickers, descriptions, action stacks, action buttons, and action tone/variant classes.
- Shared now: `loadGameAvailability` centralizes debug-snapshot load availability and guarded load action execution.
- Local by design: menu state machines, action IDs, view IDs, ARIA dialog semantics, focus traps, keyboard shortcuts, crash-specific recovery rules, and scenario navigation.
- Deferred: generic modal/focus helpers and a route/view DSL should wait until another migrated surface repeats those details.

## Validation

- `npm run build` passed with the existing Vite chunk-size warning.
- `npm test -- --run` passed: 46 files, 305 tests.
- `npm run test:gui` passed: 9 mobile Chromium tests after merging `main`, including the crash menu browser-component regression, stale main-menu load-state regression, and touch-control screenshot states.
- Generated GUI screenshot artifacts were visually inspected and matched the expected mobile UI states:
  - `tmp/playwright-results/mobileHudScreenshot-captur-92051-th-world-visuals-suppressed-mobile-chromium/mobile-main-menu.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-d9652-ch-the-Moon-menu-transition-mobile-chromium/mobile-reach-moon-menu.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-5be36-ial-coach-prompt-transition-mobile-chromium/mobile-tutorial-coach-prompt.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-8c0aa-Moon-replay-pill-transition-mobile-chromium/mobile-reach-moon-replay-pill.png`
- `npx biome check src/ui/createCrashMenu.ts src/ui/components/CrashMenuSurface.tsx tests/gui/mobileHudScreenshot.spec.ts` passed.
- `npx biome check src/ui/components/MenuSurfacePrimitives.tsx src/ui/components/MainMenuSurface.tsx src/ui/components/CrashMenuSurface.tsx src/ui/createPreactUiSurface.ts src/ui/createMainMenu.ts src/ui/createCrashMenu.ts src/ui/loadGameAvailability.ts tests/gui/mobileHudScreenshot.spec.ts` passed.
- `npx biome lint src/style.css` passed with the existing `!important` warnings in unrelated app-state visibility rules.
- `git diff --check` passed.
- `npm audit --omit=dev` passed with 0 production vulnerabilities.
- `coderabbit --base main --agent` completed with one finding that was inspected and skipped as invalid: it assumed the dialog root needed to be focusable, but `rootRef` is used for containment/query access and focus still moves to the primary recovery button.
- After the reusable Preact adapter extraction, `coderabbit --base main --agent` completed with 0 findings.
- After the shared menu primitive extraction, `coderabbit --base main --agent` found that the load action guard used a captured availability value. `runLoadGameAction` now re-checks live availability before invoking the callback.
- Final `coderabbit --base main --agent` completed with 0 findings after the load guard fix.
- PR review follow-up fixed CodeRabbit comments by refreshing main and crash menu load-state when a guarded load no-ops, replacing the hardcoded test storage key with debug snapshot helpers, and making snapshot clearing best-effort when storage is unavailable.
- Final post-review `coderabbit --base main --agent` completed with 0 findings.
- Staging deploy completed:
  - https://fanciful-bunny-d77b4b.netlify.app
  - https://6a3ec88f8f89ab8acf93b325--fanciful-bunny-d77b4b.netlify.app
- Updated staging deploy after reuse extraction:
  - https://fanciful-bunny-d77b4b.netlify.app
  - https://6a3eef446190220c5374d086--fanciful-bunny-d77b4b.netlify.app
- Final staging deploy after shared menu primitive extraction and load guard fix:
  - https://fanciful-bunny-d77b4b.netlify.app
  - https://6a3ef4584c04e82519fd2be1--fanciful-bunny-d77b4b.netlify.app

## Follow-Ups

- Continue issue #24 with another low-frequency surface after review, likely the top menu or in-game controls menu.
