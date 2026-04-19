# Performance and bundle pass

## Context
The game already ships a fairly large JavaScript bundle, and mobile smoothness matters more as touch UI becomes a first-class experience. Performance work could improve first load, responsiveness, and confidence in future feature growth.

## Proposal
Run a focused performance pass on bundle size, runtime update cost, and rendering overhead. The work could include code-splitting, targeted hot-path cleanup, and measurement of the most expensive interactions on mobile devices.

## Open questions
- What is the biggest current issue: startup time, frame pacing, memory use, or bundle size?
- Are there obvious candidates for code-splitting without harming the single-screen experience?
- Which performance checks should become part of regular release validation?

## Status
Rough
