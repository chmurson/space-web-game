# Repository Notes

## Communication

- After each substantial implementation or refactor step, include a short plain-language summary in the response.
- Keep that summary focused on what changed and why it matters, without assuming the reader followed all internal details.
- Keep the technical summary too; the plain-language summary is an addition, not a replacement.

## Code Quality

- Do not widen module APIs only to make tests easier to write.
- Prefer testing behavior through existing public functions instead of exporting internal helpers just for tests.
