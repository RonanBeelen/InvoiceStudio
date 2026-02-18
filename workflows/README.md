# Workflows Directory

This directory contains markdown SOPs that define how to accomplish specific tasks.

## What is a Workflow?

A workflow is a set of instructions written in plain language that tells the agent:
1. **Objective**: What we're trying to accomplish
2. **Inputs**: What information/resources are needed
3. **Tools**: Which scripts to use and in what order
4. **Outputs**: What the final deliverable should be
5. **Edge Cases**: How to handle errors and unexpected situations

## Template

```markdown
# Workflow: [Name]

## Objective
[Clear statement of what this workflow accomplishes]

## Required Inputs
- [ ] Input 1: [Description]
- [ ] Input 2: [Description]

## Tools Required
- `tools/script_name.py` - [What it does]

## Steps
1. [First step]
2. [Second step]
3. [Third step]

## Expected Output
[Description of deliverable and where it goes]

## Edge Cases
- **Case 1**: [How to handle]
- **Case 2**: [How to handle]

## Notes
[Any learnings, rate limits, timing considerations, etc.]
```

## Evolution

Workflows should improve over time. When you discover:
- Better methods
- API constraints
- Common failure patterns
- Optimization opportunities

Update the workflow so the system gets smarter with each iteration.
