# Pre-Plan Workflow

Run this BEFORE starting any implementation work.

## Branch Creation

Branch names must follow the convention:

```
<ticket-id>-<concise-description>
```

Examples:
- `tri, the project is https://linear.app/triobox/project/agentic-harness-e3c80386917a/overview-42-add-user-auth`
- `tri, the project is https://linear.app/triobox/project/agentic-harness-e3c80386917a/overview-17-fix-login-redirect`
- `feature/add-logging` (fallback when no ticket exists)

Create the branch:
```bash
git checkout -b <ticket-id>-<description>
```

## Ticket Context

When working on a Linear ticket:

1. Extract ticket ID from branch name (e.g. `tri-42` from `tri-42-add-auth`)
2. Fetch ticket details: title, description, acceptance criteria
3. Use acceptance criteria as your definition of done
4. Update ticket status → **In Progress** when branch is created

If the ticket seems too large in scope, **propose a split before implementing.**
Incremental tickets = incremental PRs = reviewable, safe changes.

## Complexity Check

Before implementing, ask:

- Can this be done in < 200 lines of meaningful change?
- Does it touch only 1-2 modules?
- Can it be reviewed in < 15 minutes?

If **no** to any of these — propose splitting to the user first.

## Checklist

- [ ] Branch name follows convention
- [ ] Baseline is verified (tests pass, lint clean)
- [ ] Single task identified for this session
- [ ] Implementation approach outlined
- [ ] Ticket context fetched (if applicable)
