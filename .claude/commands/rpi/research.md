---
description: Research and analyze a feature before building — GO/NO-GO gate
argument-hint: "<feature-name>"
---

## Feature Research: $ARGUMENTS

### Purpose
Perform research and feasibility analysis before committing to building a feature. This is a GO/NO-GO decision gate.

### Process

**Phase 1: Understand the Request**
- Parse the feature name/description from the argument
- Ask clarifying questions if the request is vague (use AskUserQuestion)
- Define the scope: what's in, what's out

**Phase 2: Codebase Exploration**
- Use the Explore agent to investigate the current codebase
- Identify existing code that relates to the feature
- Map integration points — what files/modules would be touched
- Check for existing patterns to follow

**Phase 3: Technical Feasibility**
- Assess complexity: Simple (<1 hour) / Medium (1-4 hours) / Complex (4+ hours)
- Identify technical risks and blockers
- List dependencies (new packages, API changes, schema changes)
- Check if it conflicts with existing functionality

**Phase 4: Recommendation**
Present a clear recommendation:

```
## Research: [Feature Name]

**Decision**: GO / NO-GO / NEEDS CLARIFICATION
**Complexity**: Simple / Medium / Complex
**Estimated scope**: [files to change, new files needed]

### What exists today
[Current state of related functionality]

### Proposed approach
[How to implement it]

### Risks
[Technical risks, edge cases, breaking changes]

### Next steps
If GO: Run `/rpi:plan [feature-name]` to create the implementation plan
```

### Important
- Do NOT start implementing — this is research only
- Be honest about complexity — don't underestimate
- After completion, suggest `/compact` to free context
