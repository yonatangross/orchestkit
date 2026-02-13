/**
 * Scrapbook Motion showcase configuration
 * Demonstrates OrchestKit with Anthropic-inspired warm paper style
 */

import type { z } from "zod";
import type { scrapbookDemoSchema } from "../ScrapbookDemo";
import type { scrapbookDemoSquareSchema } from "../ScrapbookDemo-Square";

export const scrapbookShowcaseConfig: z.infer<typeof scrapbookDemoSchema> = {
  title: "OrchestKit",
  tagline: "60 skills. 36 agents. One plugin.",
  socialCards: [
    {
      author: "Sarah Chen",
      text: "Replaced our entire review workflow. 6 agents catch what we missed for months.",
      handle: "@sarahchendev",
    },
    {
      author: "Marcus Rivera",
      text: "The memory system is insane. Claude remembers every architecture decision across sessions.",
      handle: "@marcusdev",
    },
    {
      author: "Priya Kapoor",
      text: "/ork:implement turned a 4-hour feature into a 10-minute conversation.",
      handle: "@priyak_eng",
    },
  ],
  terminalContent: [
    "$ /ork:implement add OAuth2 login with Google provider",
    "",
    "◆ Activating skill: implement",
    "  ├─ Loading 5 references: auth-patterns, oauth2-flow, ...",
    "  ├─ Spawning backend-system-architect",
    "  ├─ Spawning security-auditor",
    "  └─ Spawning test-generator",
    "",
    "✓ Created src/auth/oauth2.ts (124 lines)",
    "✓ Created src/auth/google-provider.ts (67 lines)",
    "✓ Created tests/auth/oauth2.test.ts (89 lines)",
    "✓ Security audit passed (8/8 checks)",
    "",
    "Done in 47s — 3 agents, 280 lines, 0 issues",
  ].join("\n"),
  stats: {
    skills: 60,
    agents: 36,
    hooks: 86,
  },
  ctaCommand: "/plugin install ork",
  accentColor: "#2A9D8F",
};

export const scrapbookShowcaseSquareConfig: z.infer<
  typeof scrapbookDemoSquareSchema
> = {
  title: "OrchestKit",
  tagline: "60 skills. 36 agents. One plugin.",
  socialCards: [
    {
      author: "Sarah Chen",
      text: "Replaced our entire review workflow. 6 agents catch what we missed for months.",
      handle: "@sarahchendev",
    },
    {
      author: "Marcus Rivera",
      text: "The memory system is insane. Claude remembers every decision across sessions.",
      handle: "@marcusdev",
    },
  ],
  stats: {
    skills: 60,
    agents: 36,
    hooks: 86,
  },
  ctaCommand: "/plugin install ork",
  accentColor: "#2A9D8F",
};
