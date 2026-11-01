# OrchestKit CLI Demo Production Guide

15-second ScrapbookDemo video for YouTube & Twitter (16:9, 1920x1080)

## Quick Start

All commands run from `orchestkit-demos/`. The config at `orchestkit-demos/scripts/demo-cli.ts` is used in place, so there is nothing to copy.

```bash
cd orchestkit-demos

# 1. Register the composition in src/Root.tsx, next to the ScrapbookShowcase
#    composition: import { orchestkitCliDemoConfig } from "../scripts/demo-cli";
#    <Composition id="OrchestKitCliDemo" component={ScrapbookDemo}
#      durationInFrames={FPS * 15} fps={FPS} width={WIDTH} height={HEIGHT}
#      schema={scrapbookDemoSchema} defaultProps={orchestkitCliDemoConfig} />

# 2. Render 16:9 horizontal (YouTube/Twitter); src/index.ts is the Remotion entry
npx remotion render src/index.ts OrchestKitCliDemo out/OrchestKitCliDemo.mp4 \
  --width=1920 --height=1080 --fps=30

# 3. (Optional) Add audio
ffmpeg -i out/OrchestKitCliDemo.mp4 \
  -i audio/upbeat-tech-music.mp3 \
  -c:v copy -filter_complex "[1:a]volume=0.3[a]" -map 0:v -map "[a]" -c:a aac -shortest \
  out/OrchestKitCliDemo-with-audio.mp4

# 4. Optimize for platform constraints
ffmpeg -i out/OrchestKitCliDemo-with-audio.mp4 \
  -c:v libx264 -preset fast -crf 23 \
  -b:a 128k \
  out/OrchestKitCliDemo-final.mp4
```

## Output Specs

| Platform | Resolution | Codec | Audio | Max Size | Duration |
|----------|------------|-------|-------|----------|----------|
| YouTube | 1920×1080 | H.264 | AAC 128k | 50MB | ≤15s |
| Twitter/X | 1920×1080 | H.264 | AAC 128k | 10MB | ≤15s |
| LinkedIn | 1920×1080 | H.264 | AAC 128k | 15MB | ≤30s |

## Template Breakdown

### 0-3 seconds: Title Stamp
- "OrchestKit" (serif Georgia, bold)
- "92 skills. 33 agents. 1 plugin." (sans serif subtitle)
- Warm cream background (#F0F0E8)
- Spring animation with slight overshoot

### 3-5.5 seconds: Social Proof Cards
- 3 testimonial cards appear with stagger animation
- Each shows name, handle, quote
- Tweet-style card design with accent color highlight

### 5.5-9.5 seconds: Terminal Capture
- Terminal output showing 3 CLI commands in sequence:
  1. `/ork:implement` — creates files, adds tests, updates docs
  2. `/ork:review-pr` — finds issues, scans security, checks performance
  3. `/ork:verify` — runs tests, shows coverage, verifies regressions
- Tilted frame with drop shadow for visual interest
- Code font (monospace), fast scroll animation

### 9.5-11.5 seconds: Stats Reveal
- Counter animation: 92 → 33 → 101
- Underlines animate in accent color (#8b5cf6)
- Labels: "skills" "agents" "hooks"

### 11.5-15 seconds: Call-to-Action
- Command box: `/plugin install ork`
- "Get started" copy
- Purple accent button/frame
- Final frame holds with subtle pulse animation

## Audio Suggestions

**No Audio** (silent, lets captions shine):
- Best for Twitter/LinkedIn where videos autoplay muted
- Optimizes file size

**Music + SFX** (Recommended):
- Background: Upbeat tech music (30% volume, 15s loop)
- SFX: Subtle UI sounds for card reveals, counter ticks
- Audio credits in video description

**Music Only**:
- Ambient background track
- No attention-grabbing SFX

## Post-Production Checklist

- [ ] Render test frame (frame 0) to verify colors/text
- [ ] Spot-check terminal text readability at 1080p
- [ ] Verify 15s duration exactly
- [ ] Test on YouTube player (preview, not upload)
- [ ] Test on Twitter in-app player
- [ ] Check file size (target: <8MB for Twitter)
- [ ] Confirm no text outside safe areas (80% of width/height)
- [ ] Verify audio levels (peak -3dB, loud sections -6dB)

## File Organization

```
orchestkit/
├── docs/DEMO_PRODUCTION.md                    ← You are here
└── orchestkit-demos/
    ├── scripts/demo-cli.ts                    ← Config, used in place
    ├── src/index.ts                           ← Remotion entry
    ├── src/Root.tsx                           ← Register the composition here
    └── out/
        └── OrchestKitCliDemo-final.mp4        ← Upload this
```

## Editing After Render

If you need to tweak the demo post-render:

```bash
# Change social card text
# → Edit scripts/demo-cli.ts socialCards[] → re-render

# Adjust terminal output timing
# → Edit terminalContent → re-render

# Change accent color
# → Edit accentColor: "#8b5cf6" → re-render

# Modify stats numbers
# → Edit stats object → re-render
```

## Uploading to YouTube

1. **Title**: "OrchestKit CLI Demo — 92 Skills, 33 Agents, 1 Plugin"
2. **Description**:
   ```
   Get started with OrchestKit:
   /plugin install ork

   Features:
   • /ork:implement — Generate code from specs
   • /ork:review-pr — AI-powered code review
   • /ork:verify — Comprehensive testing & verification

   Learn more: https://orchestkit.dev
   GitHub: https://github.com/anthropics/orchestkit
   ```
3. **Tags**: orchestkit, claude, cli, developer-tools, ai-coding
4. **Thumbnail**: Use the stats frame (92/33/101) with high contrast

## Uploading to Twitter/X

**Tweet text**:
```
Just dropped: 15-second OrchestKit demo 🎬

92 skills • 33 agents • 1 plugin

Automate code review, implementation, verification with Claude Code

Get started: /plugin install ork

[link to YouTube or video upload]
```

**Tip**: Attach video directly to tweet (drag/drop), don't post a link. Twitter's algorithm favors native video.

## Troubleshooting

**Video is too slow**: Check `durationInFrames` — should be `450` (15s × 30fps)

**Text is blurry**: Ensure `width={1920}` and `height={1080}` in Remotion

**Audio sync off**: Re-encode with `ffmpeg -fflags +genpts`

**File too large**: Reduce bitrate: `-crf 28` (default 23) or `-b:v 3M`

**Colors look different on platform**: YouTube/Twitter compress differently — render test frames and check in-platform preview

---

For more on ScrapbookDemo template, see: `plugins/ork/skills/demo-producer/references/template-system.md`
