# Pull request owner assignment

Date: 2026-07-28

Issue: https://github.com/chmurson/space-web-game/issues/335

Shipit state:
`.codex/shipit-workflows/automation/issue-335-pr-owner-assignment.md`

## What changed

- Added a repository-wide CODEOWNERS rule that requests `@chmurson` for every
  pull request path.
- Added a GitHub Actions workflow that assigns `@chmurson` when a pull request
  is opened or reopened and the owner is not already assigned.

## Why

CODEOWNERS creates a review request but does not assign the reviewer to the pull
request. The separate API-only workflow provides the assignment behavior while
leaving CODEOWNERS responsible for review ownership.

## Ownership and decisions

- `.github/CODEOWNERS` owns repository-wide review requests.
- `.github/workflows/assign-pr-owner.yml` owns pull request assignment.
- The workflow uses `pull_request_target` so the trusted default-branch
  workflow can assign fork pull requests with the base repository token.
- The elevated event never checks out, fetches, downloads, or runs pull request
  code. It uses only GitHub-provided repository and pull request number values
  in an authenticated REST API call.
- Token permissions are limited to write access for issues, which is the
  GitHub REST permission used for pull request assignees. Every unspecified
  permission is disabled.
- A job-level assignee check skips the API call when `@chmurson` is already
  assigned. GitHub's add-assignees endpoint also preserves existing assignees.
- The existing GitHub CLI on `ubuntu-latest` is used instead of adding a
  third-party assignment action.

## Validation

- Full product Vitest passed: 759/759 tests across 72 files.
- Automation claim tests passed: 16/16.
- Engineer workflow tests passed: 4/4.
- `git diff --check` passed.
- GitHub confirmed that `@chmurson` is an assignable repository user with a
  `204` response from the assignee eligibility endpoint.
- The authenticated collaborator cannot read the repository-wide Actions
  permission policy through the API (`403`), so effective write-token policy
  remains a manual administrator check.
- A release build and GUI tests were not run because the game runtime, shipped
  assets, and playable UI are unchanged.

## Follow-ups and known gaps

- The workflow and CODEOWNERS rule become active only after this change reaches
  the default branch.
- Repository or organization Actions policy can restrict `pull_request_target`
  or write-capable `GITHUB_TOKEN` permissions. In that case GitHub will not
  perform the assignment until an administrator permits the workflow.
- Manual post-merge verification should open a pull request with no assignees,
  confirm both the `@chmurson` review request and assignment, then reopen that
  pull request or a disposable test pull request to confirm the duplicate guard
  reports a skipped job when the owner is already assigned.
