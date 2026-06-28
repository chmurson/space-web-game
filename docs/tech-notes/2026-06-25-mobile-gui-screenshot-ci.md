# Mobile GUI Screenshot Workflow

## What Changed

- Added a manual `GUI Screenshots` GitHub Actions workflow.
- The workflow runs `npm run test:gui` only when started with
  `workflow_dispatch`.
- The manual workflow installs Playwright Chromium with Linux dependencies and
  uploads `tmp/playwright-results/` as the `mobile-gui-screenshots` artifact.
- Updated the GUI screenshot harness docs with the manual artifact behavior.

## Why

Issue #42 adds an on-demand GitHub Actions path for the existing mobile GUI
screenshot harness so the Preact refactor path can generate browser-rendered
HUD/menu screenshots for human review before committed visual baselines exist.

## Key Files

- `.github/workflows/gui-screenshots.yml` owns the manual workflow wrapper
  around the existing Playwright command.
- `playwright.config.ts` continues to own the mobile Chromium project, Vite
  dev server startup, and `tmp/playwright-results/` output path.
- `tests/gui/mobileHudScreenshot.spec.ts` continues to own the screenshot
  paths and attachments.
- `docs/gui-screenshot-tests.md` documents local and manual workflow usage.

## Decisions

- Reused `npm run test:gui` instead of adding a separate workflow-only script.
- Used Node 22 because the repo has no Node version file and Vite requires
  Node `^20.19.0 || >=22.12.0`.
- Kept the workflow artifact-only: no `toHaveScreenshot()` baselines, no
  committed PNGs, and no pixel-difference failure gate.
- Uploaded artifacts with `if: always()` so screenshots and Playwright traces
  are available when the GUI harness fails. Missing artifact files fail the
  upload step because screenshots are the workflow's contract.

## Validation

- Parsed `.github/workflows/gui-screenshots.yml` with the repo's `yaml`
  package and verified the manual trigger, job, and missing-artifact upload
  policy.
- `npm run test:gui` passed: 4 mobile Chromium screenshot tests.
- Visually inspected generated PNGs under `tmp/playwright-results/`; the main
  menu, Reach the Moon submenu, tutorial coach prompt, and replay pill states
  matched the expected mobile UI with world/canvas visuals suppressed.
- `git diff --check` passed.
- CodeRabbit initially found that missing artifacts should fail the upload step;
  that was fixed, and the recorded rerun completed with 0 findings. A later
  verification rerun hit CodeRabbit's rate limit.

## Follow-Ups

- Add screenshot baselines later only after the project intentionally locks down
  a stable browser and operating-system rendering environment.
