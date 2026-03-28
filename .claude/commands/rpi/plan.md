---
description: Create an implementation plan for a researched feature
argument-hint: "<feature-name>"
---

## Implementation Plan: $ARGUMENTS

### Prerequisites
Research should be completed first (`/rpi:research`). If not, run research first.

### Process

**Phase 1: Load Context**
- Read any prior research notes in the conversation
- Explore the codebase areas that will be affected
- Understand the current architecture and patterns

**Phase 2: Design**
- Define the data model changes (if any schema changes needed)
- Define the API endpoints (new routes, modified routes)
- Define the frontend components and routes
- Identify shared utilities needed

**Phase 3: Task Breakdown**
Break the implementation into phases. Each phase should be independently testable.

```
## Plan: [Feature Name]

### Phase 1: [Foundation]
- [ ] Task 1 — description
- [ ] Task 2 — description
Validation: [How to verify this phase works]

### Phase 2: [Core Feature]
- [ ] Task 1 — description
- [ ] Task 2 — description
Validation: [How to verify]

### Phase 3: [Polish]
- [ ] Task 1 — description
- [ ] Task 2 — description
Validation: [How to verify]
```

**Phase 4: Present Plan**
- Present the full plan to the user
- Wait for approval before proceeding
- Note any decisions that need user input

### Rules
- Keep phases small enough to complete in under 50% context
- Each phase must be independently verifiable
- Frontend and backend tasks can be parallelized
- Schema changes always come first
- After completion, suggest `/compact` to free context

### Next Steps
After approval: Run `/rpi:implement [feature-name]` to execute the plan
