# Claude Code CLI Simulation

## Status Bar Format (CC 2.1.16+)

```bash
[Opus 4.5] ████████░░ 42% | ~/project git:(main) | ● 3m
✓ Bash ×3 | ✓ Read ×5 | ✓ Grep ×2 | ✓ Task ×∞
>> bypass permissions on (shift+Tab to cycle)
```

### Components

1. **Model indicator**: `[Opus 4.5]`
2. **Context bar**: `████████░░ 42%`
3. **Working directory**: `~/project`
4. **Git branch**: `git:(main)`
5. **Session time**: `● 3m`
6. **Tool counts**: `✓ Bash ×3`
7. **Permission mode**: `>> bypass permissions on`

## Task Management (CC 2.1.16)

### TaskCreate
```bash
◆ TaskCreate: Created task #1 "Task description"
```

### TaskUpdate
```bash
◆ TaskUpdate: Task #1 → in_progress
◆ TaskUpdate: Task #1 → completed
```

### TaskList
```bash
◆ TaskList: 3/5 completed
```

## Skill Activation

```bash
◆ Activating skill: {skill_name}
  → Reading skills/{skill_name}/SKILL.md
  → Auto-injecting: {related_skills}
✓ {description}
```

## Spinner Animation

```bash
spinners=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
```

## Color Codes

```bash
GREEN="\033[32m"   # Success, prompts
YELLOW="\033[33m"  # Warnings, in_progress
CYAN="\033[36m"    # Info, tasks
MAGENTA="\033[35m" # Agents, special
DIM="\033[2m"      # Secondary text
RESET="\033[0m"    # Reset formatting
```

## Agent Spawning

```bash
⚡ Spawning 3 parallel agents via Task tool...

◆ TaskUpdate: Task #1 → in_progress
◆ TaskUpdate: Task #2 → in_progress
◆ TaskUpdate: Task #3 → in_progress

✓ [Task #1] ork:code-reviewer analyzing... completed
✓ [Task #2] ork:security-auditor scanning... completed
✓ [Task #3] ork:test-generator creating... completed
```
