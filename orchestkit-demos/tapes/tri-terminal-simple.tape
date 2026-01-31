# VHS Tape: Simple Level Demo
# For TriTerminalRace template - Level 1 (Simple)
# Usage: vhs < tapes/tri-terminal-simple.tape

# Terminal configuration
Output tri-terminal-simple.mp4
Set Shell "bash"
Set FontFamily "Menlo"
Set FontSize 16
Set Width 600
Set Height 400
Set Theme "Dracula"
Set Padding 16
Set Framerate 30
Set TypingSpeed 40ms

# Start recording
Hide
Type "clear"
Enter
Sleep 500ms
Show

# Simulate /ork:implement "add JWT auth"
Type "/ork:implement \"add JWT auth\""
Sleep 500ms
Enter
Sleep 1s

# Claude response simulation
Type "# Claude is analyzing your request..."
Enter
Sleep 500ms

Type "Loading skill references..."
Enter
Sleep 300ms
Type "  ├─ auth-patterns ✓"
Enter
Sleep 200ms
Type "  └─ jwt-validation ✓"
Enter
Sleep 500ms

Type ""
Enter
Type "Creating simple JWT middleware..."
Enter
Sleep 300ms

# Simulated code output
Type "📝 Writing src/auth/middleware.ts..."
Enter
Sleep 1s

Type "✓ Created middleware.ts (45 lines)"
Enter
Sleep 200ms
Type "✓ Created auth.test.ts (32 lines)"
Enter
Sleep 500ms

Type ""
Enter
Type "Running tests..."
Enter
Sleep 800ms

Type "✅ All 4 tests passed"
Enter
Type "✅ Coverage: 100%"
Enter
Sleep 500ms

Type ""
Enter
Type "🎉 Implementation complete in 8s"
Enter

Sleep 2s
