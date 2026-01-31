/**
 * Configuration for TriTerminalRace demo
 * Showcasing the /ork:demo-producer skill at 3 difficulty levels
 * META: A demo about making demos!
 */

import type { z } from "zod";
import type { triTerminalRaceSchema } from "../TriTerminalRace";

export const demoProducerDemoConfig: z.infer<typeof triTerminalRaceSchema> = {
  skillName: "demo-producer",
  skillCommand: "/ork:demo-producer",
  hook: "Professional demos in minutes, not days",
  primaryColor: "#ec4899",
  secondaryColor: "#8b5cf6",
  accentColor: "#f59e0b",

  phases: [
    { name: "Plan Story", shortName: "Story" },
    { name: "Write Script", shortName: "Script" },
    { name: "Record Content", shortName: "Record" },
    { name: "Compose Video", shortName: "Compose" },
    { name: "Export", shortName: "Export" },
  ],

  // SIMPLE LEVEL - Quick feature demo
  simple: {
    name: "Simple",
    description: "create 15s feature teaser",
    inputCount: 1,
    files: [
      {
        name: "demos/",
        status: "completed",
        children: [
          { name: "feature-teaser/", status: "completed", children: [
            { name: "script.md", status: "completed", lines: 24 },
            { name: "assets/", status: "completed", lines: 0 },
          ]},
        ],
      },
    ],
    references: [
      { name: "hook-formulas", status: "loaded", category: "marketing" },
      { name: "video-pacing", status: "loaded", category: "production" },
    ],
    claudeResponse: [
      "Producing 15s feature teaser:",
      "",
      "• Hook: Pattern interrupt",
      "• Duration: 15 seconds",
      "• Format: Square (1:1)",
      "• Platform: Twitter/X",
    ],
    codeSnippet: `DEMO PRODUCTION COMPLETE
────────────────────────
Project: auth-feature-teaser

Production Summary:
┌─ Script (15s)
│  ├─ 0-2s:  Hook - "Auth in 8 seconds?"
│  ├─ 2-10s: Demo - Terminal recording
│  └─ 10-15s: CTA - "/ork:implement"
│
├─ Assets Created
│  ✓ terminal-recording.mp4 (8s)
│  ✓ hook-overlay.png
│  ✓ cta-card.png
│
├─ Composition
│  ✓ Remotion project generated
│  ✓ Transitions: Fade + Slide
│  ✓ Music: ambient-tech.mp3
│
└─ Export
   ✓ auth-teaser-square.mp4 (1080x1080)
   ✓ Codec: H.264, 8Mbps
   ✓ Size: 2.4MB

Ready for upload: demos/feature-teaser/exports/`,
    completionTime: "45s",
    metrics: {
      Duration: "15s",
      Format: "1:1",
      Size: "2.4MB",
    },
  },

  // MEDIUM LEVEL - Tutorial demo with narration
  medium: {
    name: "Medium",
    description: "create 60s tutorial demo",
    inputCount: 5,
    files: [
      {
        name: "demos/",
        status: "completed",
        children: [
          { name: "tutorial-demo/", status: "completed", children: [
            { name: "script.md", status: "completed", lines: 89 },
            { name: "storyboard.json", status: "completed", lines: 156 },
            { name: "narration.txt", status: "completed", lines: 34 },
            { name: "assets/", status: "completed", lines: 0 },
            { name: "recordings/", status: "writing", lines: 0 },
          ]},
        ],
      },
    ],
    references: [
      { name: "hook-formulas", status: "loaded", category: "marketing" },
      { name: "video-pacing", status: "loaded", category: "production" },
      { name: "narration-scripting", status: "loaded", category: "audio" },
      { name: "scene-intro-cards", status: "loading", category: "design" },
    ],
    claudeResponse: [
      "Producing 60s tutorial demo:",
      "",
      "• Hook: Problem + Solution",
      "• Duration: 60 seconds",
      "• Scenes: 5",
      "• Narration: ElevenLabs TTS",
      "• Format: 16:9 (YouTube)",
      "• Background: Ambient music",
    ],
    codeSnippet: `DEMO PRODUCTION COMPLETE
────────────────────────
Project: verify-tutorial-demo

Production Summary:
┌─ Script & Storyboard (60s)
│  ├─ Scene 1 (0-8s): Hook
│  │   "Manual testing takes hours..."
│  │   Visual: Frustrated developer
│  │
│  ├─ Scene 2 (8-15s): Problem
│  │   "3 pain points with current workflow"
│  │   Visual: Problem bullets
│  │
│  ├─ Scene 3 (15-45s): Demo
│  │   "One command, 6 agents"
│  │   Visual: Terminal recording
│  │
│  ├─ Scene 4 (45-52s): Results
│  │   "2 minutes vs 3 hours"
│  │   Visual: Before/After comparison
│  │
│  └─ Scene 5 (52-60s): CTA
│      "/ork:verify - Try it now"
│      Visual: Command + branding
│
├─ Narration
│  ✓ Script: 145 words (2.4 wpm target)
│  ✓ Voice: ElevenLabs "Rachel"
│  ✓ Generated: narration.mp3 (58s)
│  ✓ Synced to scenes: Yes
│
├─ Assets Created
│  ✓ Terminal recordings: 3 clips
│  ✓ Intro cards: 5 scenes
│  ✓ Code snippets: 2 highlights
│  ✓ Transitions: 4 wipes
│
├─ Audio Mix
│  ✓ Narration: -3dB
│  ✓ Music: -18dB (ducked)
│  ✓ SFX: Terminal sounds
│
└─ Export
   ✓ verify-tutorial-16x9.mp4 (1920x1080)
   ✓ verify-tutorial-9x16.mp4 (1080x1920)
   ✓ Codec: H.264, 12Mbps
   ✓ Sizes: 8.2MB / 7.1MB

Ready for upload: demos/tutorial-demo/exports/`,
    completionTime: "2m 30s",
    metrics: {
      Duration: "60s",
      Scenes: "5",
      Narration: "TTS",
      Formats: "2",
    },
  },

  // ADVANCED LEVEL - Full product showcase
  advanced: {
    name: "Advanced",
    description: "create 3min product showcase",
    inputCount: 18,
    files: [
      {
        name: "demos/",
        status: "completed",
        children: [
          { name: "product-showcase/", status: "completed", children: [
            { name: "script.md", status: "completed", lines: 456 },
            { name: "storyboard.json", status: "completed", lines: 678 },
            { name: "narration.txt", status: "completed", lines: 234 },
            { name: "b-roll/", status: "completed", lines: 0 },
            { name: "recordings/", status: "completed", lines: 0 },
            { name: "music/", status: "completed", lines: 0 },
            { name: "exports/", status: "writing", lines: 0 },
          ]},
        ],
      },
    ],
    references: [
      { name: "hook-formulas", status: "loaded", category: "marketing" },
      { name: "video-pacing", status: "loaded", category: "production" },
      { name: "narration-scripting", status: "loaded", category: "audio" },
      { name: "scene-intro-cards", status: "loaded", category: "design" },
      { name: "content-type-recipes", status: "loaded", category: "formats" },
      { name: "audio-mixing-patterns", status: "loading", category: "audio" },
      { name: "thumbnail-first-frame", status: "pending", category: "design" },
    ],
    claudeResponse: [
      "Producing 3-minute product showcase:",
      "",
      "• Hook: Curiosity gap",
      "• Duration: 3 minutes",
      "• Scenes: 12",
      "• Narration: Pro voice talent",
      "• B-roll: Generated + Stock",
      "• Music: Licensed track",
      "• Formats: 16:9, 9:16, 1:1",
      "• Platforms: YT, TikTok, LinkedIn",
    ],
    codeSnippet: `DEMO PRODUCTION COMPLETE
────────────────────────
Project: orchestkit-product-showcase-v2

PRODUCTION SUMMARY:
╔════════════════════════════════════════════════════════════╗
║ PROFESSIONAL PRODUCT SHOWCASE RENDERED                     ║
╚════════════════════════════════════════════════════════════╝

┌─ Script & Storyboard (3:00)
│  ├─ ACT 1: HOOK (0:00-0:15)
│  │   ├─ Scene 1: Pattern interrupt
│  │   │   "What if your AI assistant..."
│  │   └─ Scene 2: Curiosity gap
│  │       "...knew your entire codebase?"
│  │
│  ├─ ACT 2: PROBLEM (0:15-0:45)
│  │   ├─ Scene 3: Pain point #1
│  │   │   "Repetitive tasks drain productivity"
│  │   ├─ Scene 4: Pain point #2
│  │   │   "Context switching kills flow"
│  │   └─ Scene 5: Pain point #3
│  │       "Knowledge silos slow teams"
│  │
│  ├─ ACT 3: SOLUTION (0:45-2:15)
│  │   ├─ Scene 6: Product intro
│  │   │   "OrchestKit: 185 skills, 35 agents"
│  │   ├─ Scene 7: Demo /explore
│  │   │   Terminal recording (30s)
│  │   ├─ Scene 8: Demo /verify
│  │   │   Terminal recording (25s)
│  │   ├─ Scene 9: Demo /implement
│  │   │   Terminal recording (30s)
│  │   └─ Scene 10: Demo /remember
│  │       Terminal recording (15s)
│  │
│  └─ ACT 4: CTA (2:15-3:00)
│      ├─ Scene 11: Social proof
│      │   "Used by 10K+ developers"
│      └─ Scene 12: Call to action
│          "/plugin install ork"
│
├─ Narration Production
│  ├─ Script: 420 words (2.3 wpm)
│  ├─ Voice: Professional VO talent
│  ├─ Takes: 3 (best selected)
│  ├─ Post-processing:
│  │   ✓ Noise reduction
│  │   ✓ EQ optimization
│  │   ✓ Compression
│  └─ Duration: 2:58
│
├─ Visual Assets
│  ├─ Terminal Recordings: 8 clips
│  │   ✓ explore-demo.mp4 (30s)
│  │   ✓ verify-demo.mp4 (25s)
│  │   ✓ implement-demo.mp4 (30s)
│  │   ✓ remember-demo.mp4 (15s)
│  │   ... +4 supporting clips
│  │
│  ├─ B-Roll: 12 clips
│  │   ✓ Developer working (stock)
│  │   ✓ Code scrolling (generated)
│  │   ✓ Team collaboration (stock)
│  │   ... +9 more
│  │
│  ├─ Graphics: 24 assets
│  │   ✓ Scene intro cards: 12
│  │   ✓ Lower thirds: 6
│  │   ✓ Data visualizations: 4
│  │   ✓ Logo animations: 2
│  │
│  └─ Transitions: 18
│      ✓ Fade: 6
│      ✓ Slide: 4
│      ✓ Zoom: 4
│      ✓ Wipe: 4
│
├─ Audio Mix
│  ├─ Narration
│  │   Level: -6dB (dialog standard)
│  │   Processing: De-ess, compress
│  │
│  ├─ Background Music
│  │   Track: "Tech Ambience" (licensed)
│  │   Level: -20dB (ducked under VO)
│  │   Ducking: -6dB on VO presence
│  │
│  ├─ Sound Effects
│  │   ✓ Typing sounds: 24 instances
│  │   ✓ Whoosh transitions: 18
│  │   ✓ UI clicks: 12
│  │   ✓ Success chimes: 4
│  │
│  └─ Master
│      Loudness: -14 LUFS (YouTube spec)
│      True peak: -1dB
│
├─ Color Grading
│  ✓ Brand color consistency
│  ✓ Terminal contrast boost
│  ✓ Skin tone correction
│  ✓ Look: Modern tech
│
├─ Exports
│  ├─ YouTube (16:9)
│  │   orchestkit-showcase-16x9.mp4
│  │   1920x1080, H.264, 15Mbps
│  │   Size: 34.2MB
│  │
│  ├─ TikTok/Reels (9:16)
│  │   orchestkit-showcase-9x16.mp4
│  │   1080x1920, H.264, 12Mbps
│  │   Size: 28.7MB
│  │
│  ├─ LinkedIn/Twitter (1:1)
│  │   orchestkit-showcase-1x1.mp4
│  │   1080x1080, H.264, 10Mbps
│  │   Size: 24.1MB
│  │
│  └─ Thumbnail
│      thumbnail.png (1280x720)
│      ✓ Click-bait optimized
│      ✓ Face + text formula
│
└─ Deliverables Checklist
   ✓ 3 aspect ratio exports
   ✓ Thumbnail generated
   ✓ Captions file (.srt)
   ✓ YouTube description
   ✓ Social media copy
   ✓ Hashtag suggestions

Total Production Time: 8m 45s
(vs. manual: ~2-3 days)

Ready for upload: demos/product-showcase/exports/`,
    completionTime: "8m 45s",
    metrics: {
      Duration: "3:00",
      Scenes: "12",
      Assets: "52",
      Formats: "3",
      Size: "87MB",
    },
  },

  summaryTitle: "PRODUCTION COMPLETE",
  summaryTagline: "Professional demos. Minutes not days. Ship it.",

  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.08,
};

export default demoProducerDemoConfig;
