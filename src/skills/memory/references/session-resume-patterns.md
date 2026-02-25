# CC 2.1.31 Session Resume Hints

At session end, Claude shows resume hints. To maximize resume effectiveness:

## Capture Context Before Ending

```bash
# Store key decisions and context
/ork:remember Key decisions for next session:
  - Decision 1: [brief]
  - Decision 2: [brief]
  - Next steps: [what remains]
```

## Resume Patterns

```bash
# For PR work: Use --from-pr (CC 2.1.27)
/ork:create-pr
# Later: claude --from-pr 123

# For issue fixing: Use memory load
/ork:fix-issue 456
# Later: /ork:memory load   # Reloads investigation context

# For implementation: Use memory search
/ork:implement user-auth
# Later: /ork:memory search "user-auth implementation"
```

## Best Practice

Always store investigation findings before session end:

```bash
/ork:remember Session summary for {task}:
  Completed: [what was done]
  Findings: [key discoveries]
  Next steps: [what remains]
  Blockers: [if any]
```
