# First real game like scenario

## Context

We've build some solid logic that lies physics fundation and now I would like to write some basic business logic filled game scenario.

Current "game" lacks purpose - it's motivitating and enganging when games gives even simplies goal or objective. Especially at start when there is a first interaction with the game.

The mechanics is not obvious, there only two bodies moon and earth, I think it's hard to infer for people what and how it is possible to navigate or do anything in the game.

I like open like games. Space game like this gives opportunity to provide seamingless exeprience for the user. Instead of building separate scenarios that live in isolated environments I would focus on having more or less open world, that scenarios hooks into.

## Proposal

### Scenario

The first game scenario I would like to be a tutorial.

### Scenario overview

The tutorial would consist of 3 phases, connected together into a complete experience.

Some of the phases could have locked max zoom out level, locking the player in certain space that is revelant for the phase. Some other functionalities might be disabled or enabled.

Each phase starts and/or ends, and is interrupted (or not) by text. I don't think we need a prompt from the user while game is on. Simple test + confrimation is enough.

If user crashes the spacecraft the phase restart at a point where it started.

Because phases progress seamingless for the world, each time player starts a succesive phase, it can have different starting state.

### Phase 1

Getting out of earth gravity zone.

User starts at stable Earth orbit at close distance, let's say ~300 km for the surface. The goal is to escape gravity and fly away from the planet. Let's say at least 3x times of Earth radius, having trajectory that does goes back to earth within reasonable aomunt of time, e.g. 1d ?

Before user starts there is a screen with text explaining current situation, and his current goal. Clicks confirm to start. It explain basics controls needed for the player to progress -> thrust, turn, double click to turn, trajectory estimation... that's all I think. If need more than 1 sceen with text may appear and user clicks them througt next, next and done at the end.

Trajectory target is of course Earth. Trajectory estimation duration is set to 2h.

The moon is not visble, nor it's label or anything.

User starts at zoom 5x and that is his max zoom out. He can zoom in but not zoom out beyond 5x.

Max time wrap is 500x

When goal is met move to phase 2.

### Phase 2

Getting to the Moon.

Moon appears in the aprox. direction of the spacecraft, at orbit and distance as usual, but now it is visible.

Max zoom out 0.5x. Max time wrap is 2000x. User can now extend trajectory estimation duration. (or if not possbile increase it to 1d)

Moon becames trajectory target.

User sees a message that next goal is to reach the moon orbit it at least 3 times, and go back to Earth. Communicate user about cap changes in zoom and time wrap.

When goal is met user is moved to phase 3.

### Phase 3

Getting back to Earth.

Say to user he should go back to earth.

When user leaves spehere of influence of Moon, let's say 10x set radius of moon set target to Earth. Jus before that stop saying what is going to happen -> that trajectory target will be set to Earth and because of that its visualisation will change try to explain why. When user click ok, targets changes and he can see trajectory visualization changes as well despite velocity hasn't.

When user is ~1/3 way through, high speed asteroid of mass ~1/6 of moons mass (very big) appears, the message it's asteroid that comes from out side of solar system, and we just found it. It's on collision course to users ship.

Asteroid should popup at some distance, and "correct" its course to the user ship so its aim for a collion until they are very close -> then asteroid should not do anything so user dont get feelign that asteroid chases him;

User needs to evede the asteroid.

When user get's closer to earth show the message to get a stable orbit around it.

Games finishes when user reaches gravity of earth and gets a stable orbit.

## Open questions

For scenario 3 to be a challange we should make:

- cap spacecraft max speed so its easier to get into asteroid gravity
- what distance asteroid pops up at, what speed and how close it needs to be with ship so its trajectory stops chasing user
- at what distance we should display final goal update -> orbit around earth.

## Status

Promising
