# Asciinema Recording Patterns

Record **real** Claude Code sessions for authentic demos.

## Installation

```bash
# macOS
brew install asciinema

# Also install agg for GIF/video conversion
brew install agg
```

## Recording a Session

### Basic Recording
```bash
# Start recording (saves to local file)
asciinema rec demo-session.cast

# Run Claude Code
claude
> /verify
# ... real execution ...
> /exit

# Recording auto-stops when shell exits
```

### Recording with Options
```bash
# Set terminal size (important for consistency)
asciinema rec \
  --cols 120 \
  --rows 35 \
  --title "OrchestKit /verify Demo" \
  --idle-time-limit 2 \
  demo-session.cast
```

### Key Options
| Option | Description |
|--------|-------------|
| `--cols N` | Terminal width (default: current) |
| `--rows N` | Terminal height (default: current) |
| `--idle-time-limit N` | Cap idle time to N seconds |
| `--title "..."` | Recording title |
| `-i N` | Max idle time (alias) |
| `--overwrite` | Overwrite existing file |

## Converting to Video

### Using agg (asciinema gif generator)
```bash
# Convert to GIF
agg demo-session.cast demo.gif

# With theme and font
agg --theme dracula \
    --font-family "JetBrains Mono" \
    --font-size 14 \
    demo-session.cast demo.gif

# With custom size
agg --cols 120 --rows 35 demo-session.cast demo.gif
```

### Using VHS (play .cast files)
```tape
# VHS can play .cast files directly!
Output demo.mp4
Set FontFamily "Menlo"
Set FontSize 16
Set Width 1400
Set Height 800
Set Theme "Dracula"

# Play the recording
Source demo-session.cast
```

### Using ffmpeg (GIF to MP4)
```bash
# Convert GIF to MP4 for Remotion
ffmpeg -i demo.gif -movflags faststart \
  -pix_fmt yuv420p -vf "scale=1400:-2" \
  demo.mp4
```

## Editing .cast Files

The `.cast` file is JSON - you can edit it!

### Cast Format (v2)
```json
{"version": 2, "width": 120, "height": 35, "timestamp": 1234567890, "title": "Demo"}
[0.0, "o", "$ "]
[0.5, "o", "claude"]
[1.0, "o", "\r\n"]
[1.2, "o", "> "]
```

### Common Edits
```python
import json

# Load cast file
with open('demo.cast', 'r') as f:
    lines = f.readlines()
    header = json.loads(lines[0])
    events = [json.loads(l) for l in lines[1:]]

# Speed up by 2x
for event in events:
    event[0] = event[0] / 2  # Halve timestamps

# Remove long pauses (cap at 1 second)
prev_time = 0
for event in events:
    if event[0] - prev_time > 1:
        event[0] = prev_time + 1
    prev_time = event[0]

# Save
with open('demo-edited.cast', 'w') as f:
    f.write(json.dumps(header) + '\n')
    for event in events:
        f.write(json.dumps(event) + '\n')
```

## Best Practices for CC Demos

### Pre-Recording Checklist
- [ ] Clean terminal (no sensitive info in history)
- [ ] Set consistent terminal size: `stty cols 120 rows 35`
- [ ] Plan the commands you'll run
- [ ] Have the repo/codebase ready
- [ ] Close notifications/distractions

### During Recording
- [ ] Type naturally but avoid long pauses
- [ ] Let Claude's output stream (it's the star)
- [ ] Don't rush - viewers need to read
- [ ] If you make a mistake, keep going (can edit later)

### Post-Recording
- [ ] Trim start/end dead time
- [ ] Cap idle times to 2 seconds
- [ ] Review for sensitive data (API keys, paths)
- [ ] Test playback before converting

## Integration with Demo Pipeline

```bash
# Full pipeline using asciinema + Remotion

# 1. Record real session
asciinema rec --cols 120 --rows 35 -i 2 session.cast

# 2. Edit if needed (trim, speed up)
python edit-cast.py session.cast session-edited.cast

# 3. Convert to MP4 via VHS
cat > convert.tape << 'EOF'
Output public/real-demo.mp4
Set Width 1400
Set Height 800
Source session-edited.cast
EOF
vhs convert.tape

# 4. Use in Remotion
# Reference public/real-demo.mp4 in CinematicDemo terminalVideo prop
```

## Why Asciinema > VHS Scripts

| Aspect | VHS Scripts | Asciinema |
|--------|-------------|-----------|
| Authenticity | Fake/simulated | 100% real |
| Claude output | Pre-written | Actual AI response |
| Timing | Artificial | Natural |
| Errors | Can't show real ones | Captures everything |
| Credibility | Low | High |

**Use asciinema when:** Showing real Claude Code capabilities, authentic workflows, actual output.

**Use VHS scripts when:** Need pixel-perfect control, reproducible demos, no variance allowed.
