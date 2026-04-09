# Line to a target plance/moon

## Context

The problem is when spacecraft is traveling between two bodies and due to auto target change, it's trajectory changes quite heavily due to target chage. This currently is weird, because there is no indicator of what the target is other than hud. Relation between target and how trajectory is visualised is hugely important and totally not intuitive for someone who is not familar with that kind of challanges.

The problem is a poor feedback to the user about relation of trajectory and target, that hurts a lot when spacecraft changes its target due to auto target change.

## Proposal

Add another line that leads stright to the tragets surface. The line is less important then the trajectory line therefore it should be less significantly higlighted however consitent enough to tell the user both lines are heavily related.

## Open questions

What stylign technique we should use. Trajectory is already dashed with cyan main color. My first thought would be to use dotted line wiht less vibrant version of the main color (probably same color but some extra transparency)

## Relations

Touches the way trajectory line is renderd: ideas/expermient-with-other-ways-of-preseting-trajectory-line.md

## Status

Promising
