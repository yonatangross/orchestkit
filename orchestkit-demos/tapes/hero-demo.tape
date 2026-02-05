# VHS Tape: OrchestKit Hero Demo
# Simulated terminal demo showing /ork:implement workflow
# Uses echo to display pre-rendered output (no actual command execution)

Output hero-demo.gif
Set Shell "bash"
Set FontFamily "JetBrains Mono"
Set FontSize 14
Set Width 800
Set Height 480
Set Theme "Dracula"
Set Padding 20
Set Framerate 30

# Clear screen
Hide
Type "clear"
Enter
Sleep 200ms
Show

# Simulate typing the command
Type@80ms "> /ork:implement"
Sleep 300ms
Type@80ms ' "add user authentication"'
Sleep 400ms
Enter
Sleep 800ms

# Task created box
Type@0 ""
Enter
Type@0 "Task Created: Implement user authentication"
Enter
Type@0 "----------------------------------------"
Enter
Sleep 400ms

# Loading skills
Type@0 ""
Enter
Type@0 "Loading skills..."
Enter
Sleep 200ms
Type@0 "  auth-patterns"
Enter
Sleep 100ms
Type@0 "  jwt-validation"
Enter
Sleep 100ms
Type@0 "  security-patterns"
Enter
Sleep 400ms

# Spawning agents
Type@0 ""
Enter
Type@0 "Spawning agents..."
Enter
Sleep 300ms
Type@0 "  [1/3] backend-system-architect"
Enter
Sleep 200ms
Type@0 "  [2/3] security-auditor"
Enter
Sleep 200ms
Type@0 "  [3/3] test-generator"
Enter
Sleep 600ms

# Agent completions
Type@0 ""
Enter
Type@0 "Agent results:"
Enter
Sleep 200ms
Type@0 "  backend-system-architect  Done (3 files)"
Enter
Sleep 250ms
Type@0 "  security-auditor          Done (0 issues)"
Enter
Sleep 250ms
Type@0 "  test-generator            Done (12 tests)"
Enter
Sleep 400ms

# File creation
Type@0 ""
Enter
Type@0 "Writing files..."
Enter
Sleep 150ms
Type@0 "  src/auth/jwt.service.ts      67 lines"
Enter
Sleep 100ms
Type@0 "  src/auth/auth.guard.ts       45 lines"
Enter
Sleep 100ms
Type@0 "  src/auth/auth.controller.ts  89 lines"
Enter
Sleep 100ms
Type@0 "  tests/auth.test.ts          156 lines"
Enter
Sleep 400ms

# Tests
Type@0 ""
Enter
Type@0 "Running tests..."
Enter
Sleep 600ms
Type@0 "  12/12 passed | Coverage: 94%"
Enter
Sleep 400ms

# Success
Type@0 ""
Enter
Type@0 "=========================================="
Enter
Type@0 "  Implementation complete in 12s"
Enter
Type@0 "  3 agents | 4 files | 357 lines | 12 tests"
Enter
Type@0 "=========================================="
Enter

Sleep 2s
