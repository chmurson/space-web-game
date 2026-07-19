# NPM dependency vulnerability remediation

GitHub issue: https://github.com/chmurson/space-web-game/issues/262

Shipit state: `.codex/shipit-workflows/agent/issue-262-fix-npm-vulnerabilities.md`

## What changed

- Raised the direct Vite range from `^7.2.4` to `^7.3.4`; the lockfile resolves Vite 7.3.6.
- Refreshed vulnerable transitive packages in `package-lock.json`, including esbuild, fast-uri, js-yaml, and PostCSS.
- Kept `@netlify/blobs` on 10.7.9 and added narrow npm overrides for `@opentelemetry/core`, `@opentelemetry/resources`, and `@opentelemetry/sdk-trace-node` at 2.9.0.

## Why

The previous lockfile reported 11 vulnerabilities: 2 high, 8 moderate, and 1 low. Most findings were resolved by compatible transitive updates. The remaining Netlify telemetry path came from `@netlify/otel` 6.0.3 pinning OpenTelemetry 2.7.1, while the patched OpenTelemetry releases are compatible 2.x updates.

## Ownership and decisions

- `package.json` owns the minimum patched Vite range and the temporary OpenTelemetry compatibility override.
- `package-lock.json` owns the exact audited dependency graph.
- Netlify function and runtime source code was intentionally left unchanged.
- `npm audit fix --force` was not used because npm proposed downgrading `@netlify/blobs` from 10.7.9 to 10.1.0. The targeted OpenTelemetry override preserves the current Netlify Blobs API while removing the vulnerable packages.

## Validation

- `npm ci`
- `npm audit` — 0 vulnerabilities
- `npm run build`
- `npm test` — 62 Vitest files / 552 tests, 16 automation-claim tests, and 3 automation-workflow tests passed
- Targeted Netlify/runtime Vitest run — 4 files / 30 tests passed

## Follow-up

Remove the OpenTelemetry overrides after a future `@netlify/otel` release pins patched OpenTelemetry versions and the clean audit result can be retained without them.
