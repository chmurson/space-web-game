# Backoffice Runbooks

## Scope

These instructions apply to agent-assisted operational review tasks under
`docs/backoffice/`, including Reach the Moon highscore abuse review. They are
runbook guidance only; do not treat them as permission to change production
data.

## Reach the Moon Suspicious Highscore Review

- Use Netlify CLI tooling from a clean, disposable checkout or worktree.
- Confirm the intended Netlify site before reading data. Production is
  `space-web-game` / `0ed821be-c897-4f15-ad17-859ae866ca1d`; the shared
  staging site is `fanciful-bunny-d77b4b` /
  `e0d8dda6-9340-4d3c-9e78-941ccbb63d5f`.
- Run `npx netlify status` first. If the CLI is linked to the wrong site, stop
  and relink only in a disposable checkout. Do not commit `.netlify/` state.
- List highscore records with:

```sh
npx netlify blobs:list reach-moon-highscores --prefix records/by-run/ --json
```

- Fetch candidate records with:

```sh
npx netlify blobs:get reach-moon-highscores records/by-run/<run-id>.json
```

- Review records that contain `audit.flags`. Summarize each candidate with
  `id`, `submittedAt`, `playerName`, `score.totalScore`,
  `score.missionElapsedSeconds`, `score.fuelRemainingKg`, `audit.flags`, and a
  short estimate of why the record looks suspicious.
- Compare suspicious candidates against nearby public records from the same
  daily/weekly/all-time windows before recommending action.
- Present findings for human decision. Do not run `netlify blobs:set`,
  `netlify blobs:delete`, or any other write command unless a human explicitly
  asks for a specific data change and the target site has been reconfirmed.
- If the review finds a repeatable abuse pattern that current flags miss,
  propose a follow-up issue with the observed signals and false-positive risk.
