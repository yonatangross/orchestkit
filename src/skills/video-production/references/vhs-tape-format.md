# VHS Tape Format

## Basic Structure

```tape
# Comment
Output path/to/output.mp4
Set FontFamily "Menlo"
Set FontSize 18
Set Width 1400
Set Height 650
Set Theme "Dracula"
Set Padding 30
Set Framerate 30

Type "command"
Enter
Sleep 5s
```

## Settings

| Setting | Horizontal | Vertical | Description |
|---------|------------|----------|-------------|
| Width | 1400 | 900 | Terminal width in pixels |
| Height | 650 | 1400 | Terminal height in pixels |
| FontSize | 18 | 22 | Font size (larger for mobile) |
| Padding | 30 | 40 | Edge padding |
| Framerate | 30 | 30 | Video FPS |

## Commands

```tape
Type "text"     # Types text character by character
Enter           # Presses Enter key
Sleep 5s        # Waits for duration
Ctrl+C          # Sends Ctrl+C
Backspace 5     # Backspace N times
```

## Themes

- `Dracula` (recommended - dark)
- `Monokai`
- `Nord`
- `Solarized Dark`
- `Tokyo Night`

## Font Recommendations

| Font | Platform | Notes |
|------|----------|-------|
| Menlo | macOS | Best compatibility |
| JetBrains Mono | Cross | May have spacing issues |
| SF Mono | macOS | Apple system font |
| Fira Code | Cross | Good ligatures |

## Recording Tips

1. Use `Sleep` at end to capture final output
2. Keep total duration under 60s for performance
3. Test font rendering before full recording
4. Use `--preview` flag for testing
