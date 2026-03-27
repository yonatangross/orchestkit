# Scope-Aware Test Depth Strategy

Adjust test plan depth based on the change target scope.

## Strategy Matrix

| Target | Depth | Flow Count | Strategy | Edge Cases |
|--------|-------|------------|----------|------------|
| `commit` | Narrow | 2-4 | Prove the commit works + 2-3 adjacent flows | Minimal |
| `unstaged` | Exact | 2-3 | Test exact changed flow, watch for partial features | None |
| `changes` | Combined | 3-5 | Treat committed+uncommitted as one body | Light |
| `branch` | Thorough | 5-8 | Full coverage including negative/edge-case flows | Full |

## Strategy Definitions

### commit — Narrow Focus
```
Test depth: NARROW
Focus: Prove this specific commit works correctly.
Flow count: 2-4 flows max.
Strategy: Test the primary flow the commit modifies, then 2-3 adjacent
flows that could be affected. Don't test unrelated pages.
Edge cases: Only test edge cases if the commit explicitly handles them.
Style: Quick validation — this is a single logical change.
```

### unstaged — Exact Match
```
Test depth: EXACT
Focus: Test exactly what's been modified in the working tree.
Flow count: 2-3 flows max.
Strategy: The developer is mid-work. Test the exact flow being changed.
Watch for partial implementations (half-finished features).
Edge cases: Skip — the code may be incomplete.
Style: Development feedback loop — fast, targeted, forgiving of WIP.
```

### changes — Combined (Default)
```
Test depth: COMBINED
Focus: Treat committed branch changes + uncommitted edits as one body.
Flow count: 3-5 flows.
Strategy: Test the overall feature being developed. Include the primary
flow and its dependencies. Check that committed work still integrates
with uncommitted changes.
Edge cases: Light — test obvious boundary conditions.
Style: Pre-push validation — comprehensive but not exhaustive.
```

### branch — Thorough Coverage
```
Test depth: THOROUGH
Focus: Full coverage of all changes on this branch vs main.
Flow count: 5-8 flows.
Strategy: This is the final check before merge. Test all affected pages
thoroughly. Include negative flows (invalid input, error states).
Cover accessibility on key pages. Verify no regressions.
Edge cases: Full — test boundary conditions, empty states, error handling.
Style: PR readiness — the branch should be merge-ready after this passes.
```

## Integration with Test Plan

The scope strategy is injected into the AI test plan generation prompt:

```python
def get_scope_strategy(target: str) -> str:
    strategies = {
        "commit": COMMIT_STRATEGY,
        "unstaged": UNSTAGED_STRATEGY,
        "changes": CHANGES_STRATEGY,
        "branch": BRANCH_STRATEGY,
    }
    return strategies.get(target, CHANGES_STRATEGY)

# In test-plan generation:
prompt = f"""
{scope_strategy}

Based on the above testing strategy, generate a test plan for:
{diff_summary}
"""
```

## Flow Count Enforcement

The test plan generator should respect the flow count range:
- If the plan exceeds the max, trim to highest-magnitude pages
- If the plan is under the min, expand to include imported (Level 2) pages
- Log which flows were trimmed/added and why
