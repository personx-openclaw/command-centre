---
description: Execute a planned feature implementation phase by phase
argument-hint: "<feature-name> [--phase N]"
---

## Implementation: $ARGUMENTS

### Prerequisites
A plan should exist from `/rpi:plan`. If not, create one first.

### Workflow Per Phase

For each phase in the plan:

```
1. Code Discovery    — Read existing code before changing it
2. Implement         — Write the code changes
3. Self-Validate     — Check: builds? types? no regressions?
4. Verify            — curl https://cc.regulex.io returns 200
5. User Gate         — STOP and show what was done, ask to proceed
```

### Implementation Rules

**Before writing code:**
- Read every file you plan to modify
- Understand existing patterns before introducing new ones
- Check the schema if touching database code

**While implementing:**
- Follow existing code patterns in the file
- Use the design system colors and components
- Add loading/empty states for data-driven UI
- Validate inputs on API endpoints
- Use TanStack Query for fetching, Zustand for UI state

**After each phase:**
- Verify the site is still up: `curl -s -o /dev/null -w "%{http_code}" https://cc.regulex.io`
- Check for TypeScript errors if applicable
- Present a summary of changes to the user

### Validation Gate Format

```
## Phase N Complete

### Changes
- [file]: [what changed]

### Verification
- Site status: [200/error]
- Tests: [pass/fail/none]

### Next
- PROCEED to Phase N+1?
- Or STOP and fix issues?
```

### Important
- STOP between phases — do not auto-proceed
- If something breaks, fix it before moving on
- If stuck after 2 attempts, ask the user for help
- After all phases, suggest `/compact` and offer to `/deploy`
