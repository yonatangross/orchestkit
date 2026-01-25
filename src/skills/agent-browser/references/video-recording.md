# Video Recording (v0.6.0)

Record browser sessions as WebM videos for debugging, documentation, and auditing.

## Basic Recording

```bash
# Start recording
agent-browser record start /path/to/recording.webm

# Perform actions
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser fill @e2 "test value"

# Stop recording
agent-browser record stop
```

## Recording Commands

```bash
# Start new recording
agent-browser record start <output-path>

# Stop current recording
agent-browser record stop

# Restart recording (stop + start new file)
agent-browser record restart <new-output-path>
```

## Output Format

- **Format**: WebM (VP8/VP9 codec)
- **Audio**: No audio recorded (browser automation only)
- **Resolution**: Matches viewport size

## Common Patterns

### Record Entire Workflow

```bash
#!/bin/bash
# Record complete user journey

OUTPUT="/tmp/user-journey-$(date +%Y%m%d-%H%M%S).webm"

agent-browser record start "$OUTPUT"

# Workflow steps
agent-browser open https://app.example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser wait navigation
agent-browser snapshot -i
agent-browser fill @e2 "search query"
agent-browser click @e3
agent-browser wait 2000
agent-browser screenshot /tmp/result.png

agent-browser record stop

echo "Recording saved to: $OUTPUT"
```

### Record Only Specific Sections

```bash
#!/bin/bash
# Record just the critical path

# Setup (not recorded)
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "$USERNAME"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3
agent-browser wait navigation

# Start recording for the important part
agent-browser record start /tmp/checkout-flow.webm

agent-browser open https://app.example.com/checkout
agent-browser snapshot -i
agent-browser fill @e1 "4242424242424242"
agent-browser fill @e2 "12/28"
agent-browser fill @e3 "123"
agent-browser click @e4  # Purchase
agent-browser wait navigation

agent-browser record stop
```

### Segment Recording

```bash
#!/bin/bash
# Create multiple recordings for different sections

agent-browser open https://app.example.com

# Record section 1
agent-browser record start /tmp/section1.webm
agent-browser snapshot -i
agent-browser click @e1
agent-browser wait navigation
agent-browser record stop

# Record section 2
agent-browser record start /tmp/section2.webm
agent-browser snapshot -i
agent-browser click @e2
agent-browser wait navigation
agent-browser record stop
```

## Use Cases

### 1. Bug Documentation

```bash
#!/bin/bash
# Capture bug reproduction steps

BUG_ID="ISSUE-123"
OUTPUT="/tmp/bug-$BUG_ID-$(date +%Y%m%d).webm"

agent-browser record start "$OUTPUT"

# Reproduce the bug
agent-browser open https://app.example.com/buggy-page
agent-browser snapshot -i
agent-browser click @e1
# ... bug occurs ...
agent-browser screenshot "/tmp/bug-$BUG_ID.png"

agent-browser record stop

echo "Bug recording: $OUTPUT"
echo "Bug screenshot: /tmp/bug-$BUG_ID.png"
```

### 2. Test Evidence

```bash
#!/bin/bash
# Record test execution for compliance

TEST_NAME="checkout-flow"
EVIDENCE_DIR="/tmp/test-evidence/$(date +%Y%m%d)"
mkdir -p "$EVIDENCE_DIR"

agent-browser record start "$EVIDENCE_DIR/$TEST_NAME.webm"

# Test steps
agent-browser open https://app.example.com/checkout
# ... test execution ...

agent-browser record stop

# Generate report
echo "Test: $TEST_NAME" > "$EVIDENCE_DIR/$TEST_NAME.txt"
echo "Recording: $TEST_NAME.webm" >> "$EVIDENCE_DIR/$TEST_NAME.txt"
echo "Result: PASS" >> "$EVIDENCE_DIR/$TEST_NAME.txt"
```

### 3. User Flow Documentation

```bash
#!/bin/bash
# Create documentation videos

FLOWS=("signup" "login" "checkout" "profile-update")

for flow in "${FLOWS[@]}"; do
    agent-browser record start "/docs/videos/$flow.webm"

    case $flow in
        signup)
            # Signup flow
            ;;
        login)
            # Login flow
            ;;
        # ... other flows
    esac

    agent-browser record stop
done
```

## Best Practices

### 1. Name Recordings Descriptively

```bash
# GOOD: Includes context
agent-browser record start "/tmp/checkout-$(date +%Y%m%d-%H%M%S).webm"

# AVOID: Generic names
agent-browser record start "/tmp/recording.webm"
```

### 2. Clean Up Old Recordings

```bash
# Delete recordings older than 7 days
find /tmp -name "*.webm" -mtime +7 -delete
```

### 3. Check Recording Status

```bash
# Recording is active until explicitly stopped
# If script crashes, recording may be lost

# Use trap to ensure cleanup
trap 'agent-browser record stop 2>/dev/null' EXIT
agent-browser record start /tmp/safe-recording.webm
# ... workflow ...
```

### 4. Viewport for Optimal Recording

```bash
# Set consistent viewport before recording
agent-browser viewport 1920 1080
agent-browser record start /tmp/hd-recording.webm
```

## Limitations

- **Format**: WebM only (no MP4, GIF, etc.)
- **Audio**: No audio capture
- **Size**: Large files for long recordings (optimize with viewport size)
- **Real-time**: Cannot stream; file written on stop
