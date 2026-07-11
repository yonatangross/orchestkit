// OrchestKit CLI Demo (15-second ScrapbookDemo for YouTube/Twitter)
// Showcases: Skills invocation, agent orchestration, plugin system

import { ScrapbookDemoProps } from "./plugins/ork/skills/demo-producer/components/ScrapbookDemo";

export const orchestkitCliDemoConfig: ScrapbookDemoProps = {
  // Hero Section (0-3s)
  title: "OrchestKit",
  tagline: "92 skills. 33 agents. 1 plugin.",

  // Social Proof Cards (3-5.5s)
  socialCards: [
    {
      author: "Sarah Chen",
      handle: "@sarahcodes",
      text: "Reduced code review time from 30min to 5min with /ork:review-pr",
    },
    {
      author: "Marcus Rodriguez",
      handle: "@buildwithm",
      text: "Automated our entire backend scaffolding with /ork:implement",
    },
    {
      author: "Priya Patel",
      handle: "@priya_ships",
      text: "Cut refactoring bugs by 90% using /ork:verify",
    },
  ],

  // Terminal Content (5.5-9.5s)
  terminalContent: `$ /ork:implement
✓ Created 5 files
✓ Added tests
✓ Updated docs
✓ Ready for review

$ /ork:review-pr #42
✓ 3 issues found
✓ Security scan passed
✓ Performance OK

$ /ork:verify
✓ All tests pass
✓ Coverage: 94%
✓ No regressions`,

  // Stats Section (9.5-11.5s)
  stats: {
    skills: 92,
    agents: 33,
    hooks: 101,
  },

  // CTA Section (11.5-15s)
  ctaCommand: "/plugin install ork",
  accentColor: "#8b5cf6", // OrchestKit brand purple
};

/**
 * Production Commands:
 *
 * 1. Generate Remotion composition:
 *    npx ts-node scripts/add-composition.ts \
 *      --name=orchestkit-cli \
 *      --type=scrapbook \
 *      --formats=horizontal
 *
 * 2. Render horizontal (16:9 for YouTube/Twitter):
 *    npx remotion render Root OrchestKitCliDemo \
 *      out/horizontal/OrchestKitCliDemo.mp4 \
 *      --width=1920 --height=1080
 *
 * 3. Add audio (optional music + SFX):
 *    ffmpeg -i out/horizontal/OrchestKitCliDemo.mp4 \
 *      -i audio/upbeat-tech-music.mp3 \
 *      -c:v copy -c:a aac \
 *      out/horizontal/OrchestKitCliDemo-with-audio.mp4
 *
 * 4. Optimize for social:
 *    ffmpeg -i out/horizontal/OrchestKitCliDemo-with-audio.mp4 \
 *      -c:v libx264 -preset fast -crf 23 \
 *      -b:a 128k \
 *      out/horizontal/OrchestKitCliDemo-final.mp4
 *
 * Output specs:
 *   - YouTube: 1920x1080 (16:9), H.264, AAC audio, under 50MB
 *   - Twitter/X: 1920x1080 (16:9), H.264, under 10 seconds recommended but ≤15s OK
 *   - LinkedIn: 1920x1080 (16:9), H.264, AAC audio
 */

/**
 * Composition Registration (add to Root.tsx):
 *
 * <Composition
 *   id="OrchestKitCliDemo"
 *   component={ScrapbookDemo}
 *   durationInFrames={15 * 30}  // 15 seconds at 30fps
 *   fps={30}
 *   width={1920}
 *   height={1080}
 *   defaultProps={orchestkitCliDemoConfig}
 * />
 */
