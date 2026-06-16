# Shipit State

Task: New looks of turning animations
Branch: new-looks-of-turning-animations
Current Mode: brainstorm
Status: active

## Checklist

- [ ] Brainstorm handoff complete
- [ ] Design handoff complete
- [ ] Implementation task slices created or explicitly waived
- [ ] Implementation complete
- [ ] Cleanup complete
- [ ] Review complete
- [ ] Validation passed
- [ ] Artifacts/docs updated
- [ ] PR opened/updated

## Artifacts

- Brainstorm: inline
- Design: pending
- Task slices: pending
- Implementation: pending
- Cleanup: pending
- Review: pending

## Decisions

- Use git-safe branch slug `new-looks-of-turning-animations` for the requested branch focus "new looks of turning animations".
- Branch from `origin/main` at `b6feb43`.
- Follow AGENTS.md deployment rules: this is a non-`main` branch, so executable/user-visible changes should be deployed to the configured staging target before handoff.
- Follow AGENTS.md verification rules for gameplay, camera, rendering, HUD, input, or responsive-layout changes.
- Likely relevant skills for later phases: `game-studio:three-webgl-game` for runtime turning animation behavior, `game-studio:web-game-foundations` if the change touches simulation/render boundaries, and `game-studio:game-playtest` for browser verification.

## Open Questions

- Which turning animations should change: spacecraft attitude turns, camera turns, maneuver/burn visuals, trajectory turns, UI controls, or another surface?
- What visual direction should the new look use: snappier mechanical easing, smoother inertial drift, thruster-based turning cues, motion trails, banking/tilt, particles, or another style?
- Should the change affect only presentation, or should it change timing/control feel too?
- Which viewport/device should be prioritized for judging the animation: desktop, mobile, or both equally?

## Validation

- [ ] npm run build
- [ ] Browser playtest screenshot/video-style check for the turning animation on desktop and mobile
- [ ] npm run deploy:netlify

## Next Step

Clarify the target turning animation and desired visual direction before design.

## Brainstorm Handoff

Problem statement: The branch will explore and implement a new visual treatment for turning animations, but the exact surface and art/interaction direction are not defined yet.

Goals: Improve the look of turning animations while preserving gameplay clarity and keeping changes scoped to the intended surface once clarified.

Non-goals: Do not change unrelated UI, physics, controls, or scenario behavior unless the chosen animation direction requires it and the decision is recorded.

Current understanding: This is a visual/product direction task, not a bug fix. It likely touches runtime animation, rendering presentation, or both.

Unresolved questions: see Open Questions.

User-facing behavior: pending clarification.

Edge cases and failure states: The animation must not hide important HUD or gameplay cues, must remain readable on mobile, and must not introduce performance stutter.
