# Resume Decision Tree

Use this decision tree when `/checkpoint-resume` is invoked to determine the correct action.

## On Invocation

```
Does .claude/pipeline-state.json exist?
│
├── NO → Ask user to describe the multi-phase task
│         → Build execution plan
│         → Write initial state file
│         → Begin Phase 1
│
└── YES → Read the state file
          → Show resume summary (see format below)
          → Ask: "Resume from [current_phase.name]? (y/n/restart)"
          │
          ├── y → Continue from current_phase
          │        (respect progress_description for partial phases)
          │
          ├── n → Ask: "Abandon pipeline or pick a different phase?"
          │        ├── abandon → Delete state file, start fresh
          │        └── pick    → List remaining_phases, let user choose
          │
          └── restart → Confirm with user → Delete state file → restart
```

## Resume Summary Format

Show this before asking the user to confirm:

```
Pipeline: <task description from context_summary or phases>
Branch: <context_summary.branch>

Completed (N phases):
  ✓ Phase 1: Create GitHub Issues  (10:05)
  ✓ Phase 2: Commit Scaffold       (10:20, sha: a1b2c3d)

In progress:
  → Phase 3: Write Source Files
    Progress: auth module done, starting billing

Remaining (M phases):
  · Phase 4: Write Tests
  · Phase 5: Final Commit

Resume from "Write Source Files"? (y/n/restart)
```

## When State File is Corrupted

If `.claude/pipeline-state.json` fails JSON parse or schema validation:

1. Warn the user: "State file is malformed"
2. Show raw content so user can assess what was completed
3. Ask: "Attempt manual recovery or start fresh?"
4. Do NOT silently overwrite — the file may contain the only record of completed work

## Parallel Phase Execution

Phases with empty `dependencies` arrays can run concurrently via Task sub-agents:

```
Phase A (dependencies: [])  ─┐
Phase B (dependencies: [])  ─┤─ Run in parallel via Task
Phase C (dependencies: [A]) ─┘─ Wait for A, then run
```

Only parallelize when:
- Both phases have empty or satisfied `dependencies`
- Phases do NOT write to the same files
- Phases do NOT both run `git commit` (would cause conflicts)
