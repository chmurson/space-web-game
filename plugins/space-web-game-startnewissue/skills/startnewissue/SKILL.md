---
name: startnewissue
description: Repo-local Space Web Game workflow to find and start a new GitHub issue. Use when the user asks to run /issue, pick a new open issue, start new issue work, choose the next GitHub task, or invoke startnewissue in this repository; rank open issues using optional user preferences plus model judgment, confirm the selected issue with the user before branching, then start a task-scoped branch and continue through Shipit until the issue is complete or unfinished tails are extracted into follow-up GitHub issues.
---

# Start New Issue

## Overview

Use this skill in the Space Web Game repository to choose a GitHub issue worth starting, create the branch only after user confirmation, and hand the work to Shipit for durable execution. The goal is to finish the issue; when only part can be finished cleanly, extract the remaining work into explicit follow-up issues before treating the task as ready to hand back.

Before doing GitHub or branch work, verify the current workspace is Space Web Game by checking for `package.json` with `"name": "space-web-game"` or a Git remote matching `chmurson/space-web-game`. If the current workspace is not this repo, stop and explain that this is a repo-local command.

## Workflow

### 1. Establish Selection Preferences

Use any preferences the user provides, including command arguments, labels, priority, component, size, risk tolerance, milestone, assignee state, or "pick something small." If the user gives no preference, proceed with judgment instead of stopping to ask.

Prefer issues that are:

- Clear enough to start without broad product invention
- Valuable to players, maintainers, or the repo's current direction
- Scoped enough for the current repo and session
- Testable with available local or CI-style checks
- Not blocked, stale for a reason, already assigned to someone else, or dependent on unresolved decisions

### 2. Inspect Open Issues

Use the best available GitHub interface for the environment, usually `gh issue list`, `gh issue view`, and `gh issue view --comments`. If `gh` is unavailable, use any available GitHub MCP or API tool. If no GitHub access exists, report the blocker and do not invent issue details.

Collect a small candidate set before recommending one. Read enough title, labels, body, and recent comments to avoid choosing an obviously blocked or already-in-progress task.

Rank candidates with a brief judgment call. Useful signals:

- Problem clarity
- Expected implementation size
- Product value
- Local validation confidence
- Risk of hidden scope
- Fit with user preferences
- Repo guidance, milestones, labels, or priority markers

### 3. Confirm Before Branching

Before creating or switching branches, present the recommended issue and one or two alternates when useful. Include:

- Issue number and title
- Why it is the best pick
- Main expected scope
- Known uncertainty or likely follow-up risk
- Proposed branch name

Ask the user to confirm the issue before starting the branch. Do not modify product code until the user confirms.

### 4. Start The Branch

After confirmation:

1. Re-check the current branch and worktree status.
2. Preserve unrelated user changes.
3. Create a branch whose name matches the issue scope, usually `issue-<number>-<short-title-slug>`.
4. If the repo has an issue tracking convention for "in progress," apply it before editing product code.

Keep the slug short, lowercase, and descriptive. Remove filler words and avoid branch names that only say "fix" or "update."

### 5. Hand Off To Shipit

Once the branch exists, use the `shipit` skill for the rest of the task. Let Shipit own the durable state, mode transitions, implementation plan, cleanup, review, validation, and PR handoff.

Before implementation, make Shipit record:

- Issue URL, issue number, and title
- Relevant issue body and comments
- Selection rationale and user confirmation
- Non-goals, uncertainty, and any follow-up risk
- Current branch name
- The repo's scoped guidance that affects the task

Continue according to Shipit. Do not call the issue complete just because code was written; run the repo-appropriate cleanup, review, validation, and documentation steps.

## Completion Contract

Aim to complete the issue end to end. If the original issue cannot be fully completed in the current branch, separate the result into:

- Finished work: the behavior actually implemented, tested, and documented
- Tails: remaining work that is real, scoped, and still valuable

For each tail, create or draft a follow-up GitHub issue with:

- A concrete title
- Context linking back to the original issue or branch
- Acceptance criteria
- Known constraints or decisions already made
- Suggested labels or priority when obvious

Update the original issue or Shipit state with the follow-up links. Only close or mark the original issue complete when the accepted scope is actually done or when the user explicitly agrees that the follow-up issues have split the unfinished scope out of the original.
