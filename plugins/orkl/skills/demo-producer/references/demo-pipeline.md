---
title: Demo Pipeline Architecture
description: End-to-end pipeline flow from content detection through final video output.
---

# Demo Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Demo Producer Pipeline                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐  │
│  │   Content   │───▶│   Content    │───▶│   Script Generator  │  │
│  │   Detector  │    │   Analyzer   │    │   (per type)        │  │
│  └─────────────┘    └──────────────┘    └──────────┬──────────┘  │
│                                                     │             │
│                                                     ▼             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐  │
│  │  Remotion   │◀───│    VHS       │◀───│   Terminal Script   │  │
│  │  Composer   │    │   Recorder   │    │   (.sh + .tape)     │  │
│  └──────┬──────┘    └──────────────┘    └─────────────────────┘  │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Final Outputs                             │ │
│  │  • horizontal/{Name}Demo.mp4                                 │ │
│  │  • vertical/{Name}Demo-Vertical.mp4                          │ │
│  │  • square/{Name}Demo-Square.mp4 (optional)                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Stage Details

### 1. Content Detection
Identifies the content type from arguments or interactive selection. Maps to one of: skill, agent, plugin, marketplace, tutorial, cli, code.

### 2. Content Analysis
Parses source files for the detected type. Extracts metadata, key features, phases, examples, and talking points. See `rules/analyzer-patterns.md`.

### 3. Script Generation
Generates terminal scripts (.sh) and VHS tape files (.tape) from analyzed content. Each content type has its own script template. See `references/script-generation.md`.

### 4. VHS Recording
Records terminal sessions from tape files into GIF/MP4 segments. These become the raw footage for Remotion compositions.

### 5. Remotion Composition
Assembles recorded segments with transitions, overlays, text, and audio into final compositions. See `rules/production-composition.md`.

### 6. Final Output
Renders to multiple formats: horizontal (1920x1080), vertical (1080x1920), square (1080x1080 optional).

## Generation Commands

```bash
# After interactive selection, generates:

# 1. Terminal script
./skills/demo-producer/scripts/generate-script.sh \
  --type=skill \
  --name=explore \
  --style=standard \
  --output=orchestkit-demos/scripts/

# 2. VHS tape files
./skills/demo-producer/scripts/generate-tape.sh \
  --script=demo-explore.sh \
  --format=horizontal,vertical \
  --output=orchestkit-demos/tapes/

# 3. Record VHS
cd orchestkit-demos/tapes && vhs sim-explore.tape

# 4. Add Remotion composition
./skills/demo-producer/scripts/add-composition.sh \
  --name=explore \
  --type=skill \
  --formats=horizontal,vertical

# 5. Render final videos
cd orchestkit-demos && npx remotion render ExploreDemo --output=out/horizontal/ExploreDemo.mp4
npx remotion render ExploreDemo-Vertical --output=out/vertical/ExploreDemo-Vertical.mp4
```

## Output Structure

```
orchestkit-demos/out/
├── horizontal/
│   └── {Name}Demo.mp4          # 1920x1080 16:9
├── vertical/
│   └── {Name}Demo-Vertical.mp4  # 1080x1920 9:16
└── square/
    └── {Name}Demo-Square.mp4    # 1080x1080 1:1 (optional)
```
