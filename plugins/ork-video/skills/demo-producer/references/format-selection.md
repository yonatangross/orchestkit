# Format Selection Guide

## Video Formats

| Format | Resolution | Aspect Ratio | Use Cases |
|--------|------------|--------------|-----------|
| Horizontal | 1920x1080 | 16:9 | YouTube, Twitter, Website embeds |
| Vertical | 1080x1920 | 9:16 | TikTok, Instagram Reels, YouTube Shorts |
| Square | 1080x1080 | 1:1 | Instagram Feed, LinkedIn |

## Terminal Dimensions by Format

### Horizontal (16:9)
```tape
Set Width 1400
Set Height 650
Set FontSize 18
Set Padding 30
```
- Good for: detailed output, wide terminal commands
- Lines visible: ~25-30
- Characters per line: ~140

### Vertical (9:16)
```tape
Set Width 900
Set Height 1400
Set FontSize 22
Set Padding 40
```
- Good for: scrolling content, mobile viewing
- Lines visible: ~50-55
- Characters per line: ~80

### Square (1:1)
```tape
Set Width 1080
Set Height 1080
Set FontSize 20
Set Padding 35
```
- Good for: balanced content, social media
- Lines visible: ~40-45
- Characters per line: ~100

## Style Guidelines

### Quick Demo (6-10s)
- Single feature highlight
- Minimal text
- Fast cuts
- Hook: 1.5s, CTA: 2s
- Best for: Social media teasers

### Standard Demo (15-25s)
- Full workflow
- Multiple steps
- Clear progression
- Hook: 1.5s, CTA: 2.5s
- Best for: Product demos, feature showcases

### Tutorial (30-60s)
- Detailed explanation
- Code examples
- Pauses for reading
- Hook: 2s, CTA: 3s
- Best for: Educational content

### Cinematic (60s+)
- Story-driven narrative
- Multiple scenes
- High production value
- Hook: 3s, CTA: 5s
- Best for: Product launches, keynotes

## Duration Calculation

```
Total = Hook + Content + CTA + Buffer

where:
- Hook: 1.5-3s depending on style
- Content: varies by type
- CTA: 2-5s depending on style
- Buffer: 0.5s for fade in/out
```

### Content Duration by Type

| Type | Quick | Standard | Tutorial |
|------|-------|----------|----------|
| Skill | 5s | 12s | 25s |
| Agent | 6s | 15s | 30s |
| Plugin | 8s | 18s | 35s |
| Tutorial | N/A | N/A | 30-60s |
| CLI | 4s | 10s | 20s |
| Code | 6s | 15s | 40s |

## Remotion Composition Settings

### Horizontal
```tsx
width={1920}
height={1080}
```

### Vertical
```tsx
width={1080}
height={1920}
```

### Square
```tsx
width={1080}
height={1080}
```

## Color Palette by Content Type

| Type | Primary | Secondary |
|------|---------|-----------|
| Skill | #8b5cf6 (purple) | #a78bfa |
| Agent | #06b6d4 (cyan) | #22d3ee |
| Plugin | #22c55e (green) | #4ade80 |
| Tutorial | #f59e0b (amber) | #fbbf24 |
| CLI | #6366f1 (indigo) | #818cf8 |
| Code | #ec4899 (pink) | #f472b6 |

## Platform-Specific Requirements

### YouTube
- Minimum: 1280x720
- Recommended: 1920x1080
- Max length: 12 hours
- Best practice: 15-60s for Shorts

### TikTok
- Resolution: 1080x1920
- Max length: 10 minutes
- Best practice: 15-60s

### Instagram Reels
- Resolution: 1080x1920
- Max length: 90 seconds
- Best practice: 15-30s

### Twitter/X
- Max resolution: 1920x1200
- Max length: 2:20
- Best practice: 15-45s

### LinkedIn
- Recommended: 1920x1080 or 1080x1080
- Max length: 10 minutes
- Best practice: 30-90s
