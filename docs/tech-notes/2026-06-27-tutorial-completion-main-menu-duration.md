# Tutorial Completion Main Menu Duration

Issue: https://github.com/chmurson/space-web-game/issues/66
Related work: https://github.com/chmurson/space-web-game/issues/65
Branch: `codex/issue-66-tutorial-main-menu-only`

## What Changed

- The tutorial completion prompt now offers only a `Main menu` action.
- The direct `Free roam` action was removed from tutorial completion.
- The prompt still shows the tutorial completion duration in compact game time, such as `12m 34s`.
- The existing stored `completedElapsedGameSeconds` completion state remains the source for the displayed duration, so the shown duration does not drift after completion.

## Why

Issue #66 requires tutorial completion to return through the main-menu flow instead of jumping directly to free roam. This branch was rebased over issue #65, which added stable tutorial completion duration display. This note records the combined behavior so the duration stays visible while the direct free-roam action is removed.

## Key Files

- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts` owns the completion prompt copy and single main-menu action.
- `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts` owns storing the completion elapsed game seconds when the final Earth orbit phase completes.
- `src/scenario/specific-scenarios/tutorial/tutorialScenarioTypes.ts` owns the completed-state field.
- `tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts` verifies stored completion time, prompt copy, and absence of free-roam actions.

## Decisions

- Reused the existing prompt and `exit_to_menu` action instead of adding new navigation behavior.
- Kept the compact local duration formatter scoped to tutorial completion; no shared formatting API is needed yet.
- Kept the older/debug-state fallback to current simulation elapsed from issue #65, while real completions store `completedElapsedGameSeconds` so the prompt remains stable.

## Validation

- `npm test -- tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`
- `npx biome check src/scenario/specific-scenarios/tutorial/tutorialScenario.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts docs/tech-notes/2026-06-27-tutorial-completion-main-menu-duration.md`
- `npm test`
- `npm run build`
- `npm run test:gui`
- Mobile GUI screenshot inspected: `tmp/playwright-results/mobileHudScreenshot-captur-5be36-ial-coach-prompt-transition-mobile-chromium/mobile-tutorial-coach-prompt.png`

## Follow-Ups

- None.
