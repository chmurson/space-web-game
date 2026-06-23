# Rich Prompt Emphasis

Issue: https://github.com/chmurson/space-web-game/issues/38
Branch: `codex/issue-38-rich-text-prompts`
Shipit state: `.codex/shipit-workflows/codex/issue-38-rich-text-prompts.md`

## What Changed

- Added constrained prompt description fragments so prompt copy can mix normal text with emphasized spans.
- Added semantic fragment tones for concept, number, and constraint emphasis.
- Updated scenario prompt rendering to create DOM text/span nodes instead of accepting raw HTML.
- Styled prompt emphasis inside the existing scenario prompt surface.
- Updated existing tutorial, onboarding, and Reach the Moon prompt descriptions with targeted concept, number, and constraint emphasis.

## Why

Prompt copy previously rendered as one uniform block, making important mission terms and constraints easy to miss. The new fragment path improves scanability while keeping prompt authoring typed and avoiding a general rich-text system.

## Key Files

- `src/scenario/scenarioPromptTypes.ts` owns the prompt text fragment types.
- `src/scenario/scenarioPrompts.ts` owns plain-text and identity helpers for prompt fragments.
- `src/ui/scenario-prompts/scenario-prompts.ts` owns safe DOM rendering for prompt descriptions.
- `src/ui/scenario-prompts/scenario-prompts.css` owns the emphasis visual treatment.
- `src/scenario/specific-scenarios/reachMoonScenario.ts` owns emphasized Reach the Moon mission prompts.
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts` owns emphasized tutorial phase prompts.
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts` owns emphasized onboarding coach prompts.

## Decisions

- Kept titles and button labels as plain strings; this issue only needed inline emphasis in prompt copy.
- Used structured fragments instead of raw HTML or markup parsing.
- Included fragment tone in prompt identity so visual emphasis changes trigger DOM updates even when plain text is unchanged.
- Kept existing string prompt descriptions valid and rendered through the old text-only path.
- Converted remaining existing scenario prompt descriptions after the initial representative prompt pass, using the same constrained fragment structure.

## Validation

- `npm test -- --run tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts`
- `npm test -- --run tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- `npm test -- --run`
- `git diff --check`
- `npm run build`
- `coderabbit --base main --agent`
- Browser/playtest fallback through Chrome DevTools because the Browser plugin `iab` handle was unavailable:
  - Desktop mission-start prompt screenshot: `.codex/shipit-workflows/codex/issue-38-rich-text-prompts-desktop.png`
  - 390px mobile mission-start prompt screenshot: `.codex/shipit-workflows/codex/issue-38-rich-text-prompts-mobile-390.png`
  - Computed checks confirmed expected fragment tones, 700 font weight, and no desktop or mobile fragment overflow.
- Expanded-copy browser checks used isolated headless Chrome with software GL after the in-app browser handle was unavailable and the shared Chrome DevTools profile was locked:
  - Desktop Reach the Moon prompt screenshot: `.codex/shipit-workflows/codex/issue-38-rich-text-prompts-reach-moon-desktop-expanded.png`
  - 390px mobile tutorial prompt screenshot: `.codex/shipit-workflows/codex/issue-38-rich-text-prompts-tutorial-mobile-expanded.png`
  - Computed checks confirmed expected fragment tones, 700 font weight, no fragment overflow, and no browser console errors beyond expected favicon/WebGL performance noise.
- `npm run deploy:netlify`
- Build completed with the existing Vite chunk-size warning.
- CodeRabbit found one minor tone consistency issue; `Earth objective zone` was changed from constraint tone to concept tone.
- Staging deployed to https://space-web-game-woven-moth.netlify.app with latest unique deploy https://6a3a38d3fd885529f4cd9acd--space-web-game-woven-moth.netlify.app.

## Follow-Ups

- Future prompt copy can use the same fragment shape when emphasis improves scanability.
