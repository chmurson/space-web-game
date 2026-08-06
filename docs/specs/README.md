# Design Specifications

This directory contains proposals for substantial changes that have not shipped
yet. A specification explains the problem, desired outcome, design decisions,
alternatives, rollout, and acceptance criteria before implementation begins.

Specifications differ from [`docs/tech-notes/`](../tech-notes/):

- a specification describes a proposed change and may still contain open
  questions;
- a tech note records what was actually shipped, why, and how it was validated.

## Automation

- [Engineer workflow v2](automation/engineer-workflow-v2.md): simplify the
  scheduled GitHub engineering workflow while preserving the low-cost Luna
  orchestrator and strong Sol implementation worker split.
