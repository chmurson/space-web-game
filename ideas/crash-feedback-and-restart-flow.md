# Crash feedback and restart flow

## Context

Tutorial restart now works, including phase checkpoint restart. However the current crash experience is abrupt:

- the spacecraft crashes
- the game immediately restarts
- the player gets very little feedback about what happened

There is also room to make crash outcomes feel body-specific. A high-speed Earth impact can read more like atmospheric burn-up or terminal reentry, while a Moon impact can read more like a surface crash.

## Proposal

Improve crash presentation and restart flow in two layers.

### Immediate player feedback

After a crash, show explicit feedback before restarting or retrying:

- tell the player what body they crashed into
- explain that the phase or scenario is restarting
- require click/tap confirmation to continue

Possible wording:

- "You crashed into the Moon. Click to try again."
- "You burned up in Earth's atmosphere. Click to restart this phase."

This should be scenario-aware, so tutorials and future missions can override the wording or restart behavior.

### Crash presentation

Add body-aware crash presentation:

- Moon: hard impact / debris / surface collision feedback
- Earth: atmospheric burn-up / disappearance / reentry failure feedback
- later: allow crash outcome to depend on speed, angle, altitude, and body properties

This should stay separate from the generic collision detection. The simulation can still decide that a collision happened; a presentation layer or scenario layer can decide how that collision is described and shown.

## Open questions

- Should restart happen only after explicit confirmation, or after a short delay with optional skip?
- Should tutorials always block on confirmation while sandbox scenarios restart immediately?
- Do we need a generic "crash outcome" model, or can scenario/presentation logic derive it from current body and velocity?
- Should Earth atmosphere be modeled explicitly later, or only presented visually at first?

## Status

Promising
