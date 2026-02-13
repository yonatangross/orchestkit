---
title: Terminal Demo Recording
impact: HIGH
impactDescription: "Terminal recordings are the core visual asset for tech demos — poor recording quality or format issues undermine the entire video"
tags: terminal, VHS, asciinema, recording, CLI, demo
---

## Terminal Demo Recording

Two approaches for terminal demo recordings:

| Method | Best For | Authenticity |
|--------|----------|--------------|
| **asciinema** | Real CC sessions, actual output | High |
| **VHS scripts** | Controlled demos, reproducible | Medium |

### Real Session (Recommended)

```bash
# Record actual Claude Code session
asciinema rec --cols 120 --rows 35 -i 2 demo.cast

# Convert to MP4 via VHS
vhs << 'EOF'
Output demo.mp4
Set Width 1400
Set Height 800
Source demo.cast
EOF
```

### VHS Tape Format

```tape
Output demo.mp4
Set Shell "bash"
Set FontFamily "Menlo"
Set FontSize 16
Set Width 1400
Set Height 800
Set Theme "Dracula"
Set Framerate 30

Type "./demo-script.sh"
Enter
Sleep 15s
```

### Claude Code CLI Patterns

**Status Bar (CC 2.1.16+):**
```
[Opus 4.6] ████████░░ 42% | ~/project git:(main) | ● 3m
✓ Bash ×3 | ✓ Read ×5 | ✓ Grep ×2 | ✓ Task ×∞
```

**Task Management:**
```
◆ TaskCreate #1 "Analyze codebase"
◆ TaskCreate #2 "Security scan"
◆ TaskCreate #3 "Generate report" blockedBy: #1, #2
◆ TaskUpdate: #1, #2 → in_progress (PARALLEL)
✓ Task #1 completed
✓ Task #2 completed
◆ Task #3 unblocked (2/2 resolved)
```

### Color Codes

```bash
P="\033[35m"  # Purple - skills, agents
C="\033[36m"  # Cyan - info, tasks
G="\033[32m"  # Green - success
Y="\033[33m"  # Yellow - warnings, progress
R="\033[31m"  # Red - errors
D="\033[90m"  # Gray - dim/secondary
```

### Pipeline Integration

```
terminal-demo-generator → demo-producer → remotion-composer
(asciinema/VHS)           (orchestration)  (final composition)
```

**References:** `references/asciinema-recording.md`, `references/vhs-tape-format.md`, `references/cc-simulation.md`
