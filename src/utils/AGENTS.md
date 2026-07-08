# Utils Notes

`src/utils/` is for small, shared helper code used across modules.

Use this directory for reusable utilities that are not concrete UI surfaces, Preact components, gameplay simulation, or core runtime orchestration.

Keep helpers dependency-light. Prefer passing behavior in through small options or callbacks instead of importing feature-specific state from `src/ui`, `src/presentation`, `src/simulation`, or `src/runtime`.
