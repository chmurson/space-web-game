# Main-menu secondary action styling

## What changed

- Every action rendered through `MenuActionButton` in the main-menu flows now explicitly uses either the primary or secondary variant.
- Secondary actions inherit the existing neutral dark-glass button treatment instead of applying muted text that resembled a disabled control.
- Disabled menu actions dim the complete button after variant styling is applied, keeping unavailable Load controls visibly distinct from active secondary actions.
- Mobile GUI coverage now checks the variant contract and captures the top-level menu plus both disabled Load states.

## Why

The previous secondary rule reduced text contrast while default actions used the stronger neutral treatment. That made available secondary actions look closer to disabled controls and left the main-menu flows with three active styling paths. Making secondary the semantic name for the neutral treatment leaves primary for emphasis and disabled for unavailability.

## Ownership and decisions

- `src/ui/components/MainMenuSurface.tsx` owns the main-menu action hierarchy and explicitly assigns primary or secondary variants.
- `src/style.css` owns the shared menu action appearance. The base rule remains the neutral secondary treatment, primary and danger remain opt-in accents, and the disabled rule follows variant rules so it consistently dims any variant.
- `DESIGN.md` records the neutral secondary treatment and full-control disabled state as the shipped visual rule.
- `tests/gui/mobileHudScreenshot.spec.ts` verifies that no unclassified/default `MenuActionButton` remains in the main menu and checks the disabled opacity for both Load controls.
- The shared primitive's default variant remains available for non-main-menu surfaces such as the crash menu; widening this issue into a cross-menu API migration was intentionally avoided.

## Validation

- `npx biome check src/ui/components/MainMenuSurface.tsx src/style.css tests/gui/mobileHudScreenshot.spec.ts` completed with only the three pre-existing `noImportantStyles` warnings in `src/style.css` after the test file was formatted.
- `npm test` passed 60 test files / 523 tests plus 16 automation-claim tests.
- `npm run build` passed; Vite reported its existing large-chunk advisory.
- `npm run test:gui` passed 57/57 tests.
- Inspected the final full-suite screenshots under `tmp/playwright-results/mobileHudScreenshot-captur-92051-th-world-visuals-suppressed-mobile-chromium/`: `mobile-main-menu.png`, `mobile-main-menu-load-disabled.png`, and `mobile-main-menu-snapshot-load-disabled.png`. Primary actions remained prominent, active secondary actions used the neutral treatment at full contrast, and both unavailable Load controls were visibly dimmed.
- `git diff --check` passed.

## Follow-ups and known gaps

No follow-up is required for issue #253. Screenshot artifacts remain ignored test output and are not committed.
