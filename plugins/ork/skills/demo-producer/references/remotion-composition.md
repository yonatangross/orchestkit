---
title: Remotion Folder Structure and Composition Guide
description: How compositions are organized in the orchestkit-demos Remotion project.
---

# Remotion Folder Structure

Compositions are organized in `orchestkit-demos/src/Root.tsx` using this hierarchy:

```
Production/                    # Ready-to-render videos
├── Landscape-16x9/           # YouTube, Website (1920x1080)
│   ├── Core-Skills/          # implement, verify, commit, explore
│   ├── Memory-Skills/        # remember, memory
│   ├── Review-Skills/        # review-pr, create-pr, fix-issue
│   ├── DevOps-Skills/        # doctor, configure, run-tests, feedback
│   ├── AI-Skills/            # brainstorming, assess, assess-complexity
│   ├── Advanced-Skills/      # skill-evolution, demo-producer, add-golden
│   └── Styles/               # Alternative visualizations (ProgressiveZoom, SplitMerge, etc.)
├── Vertical-9x16/            # TikTok, Reels, Shorts (1080x1920)
├── Square-1x1/               # Instagram, LinkedIn (1080x1080)
└── Marketing/                # Brand & intro videos
Templates/                    # Reference examples for each component style
Experiments/                  # Work in progress, testing new ideas
```

## Adding New Compositions

1. **Determine skill category** from the mapping in `references/skill-category-mapping.md`
2. **Add to correct folder** in Root.tsx:
   ```tsx
   <Folder name="Production">
     <Folder name="Landscape-16x9">
       <Folder name="{Category}-Skills">
         <Composition id="{SkillName}" ... />
       </Folder>
     </Folder>
   </Folder>
   ```
3. **Use unique composition IDs** — IDs must be globally unique across all folders
4. **Add vertical/square variants** in their respective format folders with prefixes (e.g., `V-TTR-`, `SQ-TTR-`)
