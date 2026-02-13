# Implementation Review Checklist

Use this checklist before marking implementation as complete.

## Scope Verification

- [ ] All acceptance criteria from micro-plan are met
- [ ] No unplanned files were modified
- [ ] No features were added beyond original scope
- [ ] If scope changed, it was documented and justified

## Code Quality

- [ ] All tests pass
- [ ] Type checking passes (mypy/tsc)
- [ ] Linting passes (no warnings)
- [ ] No TODO/FIXME left behind (or tracked in issues)

## Testing Coverage

- [ ] Unit tests for new functions/methods
- [ ] Integration tests for API endpoints
- [ ] Edge cases covered
- [ ] Error paths tested

## Documentation

- [ ] Code comments for complex logic
- [ ] API documentation updated (if endpoints added)
- [ ] README updated (if setup changed)

## Scope Creep Score

- [ ] Score 0-2: Proceed
- [ ] Score 3-5: Document additions in PR
- [ ] Score 6+: Split into separate PR

## Final Checks

- [ ] PR description matches implementation
- [ ] Commit messages are clear
- [ ] No sensitive data committed
- [ ] Works in development environment

## Sign-off

```
Reviewer: _______________
Date: _______________
Scope Creep Score: ___/10
Ready to merge: [ ] Yes [ ] No - needs: _______________
```
