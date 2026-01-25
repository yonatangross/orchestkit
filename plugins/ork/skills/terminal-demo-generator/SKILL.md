---
name: terminal-demo-generator
description: Terminal recording patterns using VHS (scripted) and asciinema (real). Documents tape format, cast editing, Claude Code CLI simulation, and conversion to video.
context: inherit
version: 2.0.0
author: OrchestKit
tags: [demo, video, vhs, asciinema, terminal, recording, cli]
---

# Terminal Demo Generator

Two approaches for terminal demo recordings:

| Method | Best For | Authenticity |
|--------|----------|--------------|
| **asciinema** | Real CC sessions, actual output | ⭐⭐⭐⭐⭐ |
| **VHS scripts** | Controlled demos, reproducible | ⭐⭐⭐ |

## Quick Start

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

### Scripted Demo
```bash
# Generate script via demo-producer
./skills/demo-producer/scripts/generate.sh skill verify

# Record with VHS
vhs orchestkit-demos/tapes/sim-verify.tape
```

## Recording Methods

### 1. Asciinema (Real Sessions)

Record actual Claude Code usage:

```bash
# Start recording
asciinema rec \
  --cols 120 \
  --rows 35 \
  --idle-time-limit 2 \
  session.cast

# Inside recording:
claude
> /verify
# ... real Claude output ...
> exit
```

See `references/asciinema-recording.md` for editing and conversion.

### 2. VHS Scripts (Controlled)

Pre-scripted terminal simulations:

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

## Claude Code CLI Patterns

### Status Bar (CC 2.1.16+)
```
[Opus 4.5] ████████░░ 42% | ~/project git:(main) | ● 3m
✓ Bash ×3 | ✓ Read ×5 | ✓ Grep ×2 | ✓ Task ×∞
>> bypass permissions on (shift+Tab to cycle)
```

### Task Management
```
◆ TaskCreate #1 "Analyze codebase"
◆ TaskCreate #2 "Security scan"
◆ TaskCreate #3 "Generate report" blockedBy: #1, #2
◆ TaskUpdate: #1, #2 → in_progress (PARALLEL)
✓ Task #1 completed
✓ Task #2 completed
◆ Task #3 unblocked (2/2 resolved)
```

### Agent Spawning
```
⚡ Spawning 6 parallel agents via Task tool
  ▸ code-reviewer spawned
  ▸ security-auditor spawned
  ▸ test-generator spawned
```

## Color Codes

```bash
P="\033[35m"  # Purple - skills, agents
C="\033[36m"  # Cyan - info, tasks
G="\033[32m"  # Green - success
Y="\033[33m"  # Yellow - warnings, progress
R="\033[31m"  # Red - errors
D="\033[90m"  # Gray - dim/secondary
B="\033[1m"   # Bold
N="\033[0m"   # Reset
```

## Pipeline Integration

Terminal recordings feed into the full demo pipeline:

```
terminal-demo-generator     →  demo-producer  →  remotion-composer
(asciinema/VHS recording)      (orchestration)    (final composition)
                                    ↓
                            manim-visualizer
                            (animations)
```

## References

- `references/asciinema-recording.md` - Real session recording
- See `demo-producer` for full pipeline
- See `remotion-composer` for video composition
