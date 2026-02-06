/**
 * Release Notes configuration for OrchestKit v6.0.2
 * Demonstrates the ReleaseNotes composition with real changelog data
 */

import type { z } from "zod";
import type { releaseNotesSchema } from "../ReleaseNotes";
import type { releaseNotesSquareSchema } from "../ReleaseNotes-Square";

export const releaseNotesV602Config: z.infer<typeof releaseNotesSchema> = {
  version: "6.0.2",
  date: "February 6, 2026",
  highlights: [
    {
      category: "added",
      title: "Adaptive Thinking",
      description:
        "All 199 skills now include complexity hints for Opus 4.6 native reasoning.",
    },
    {
      category: "added",
      title: "Upgrade Assessment",
      description:
        "New /ork:upgrade-assessment skill with 6-phase readiness evaluation.",
    },
    {
      category: "changed",
      title: "Agent Memory",
      description:
        "31 agents with project-scoped memory, 5 with local scope. CC 2.1.33.",
    },
    {
      category: "added",
      title: "New Hook Events",
      description:
        "TeammateIdle and TaskCompleted hooks for agent coordination.",
    },
    {
      category: "changed",
      title: "Dynamic Token Budgets",
      description:
        "Skill budgets now scale to 2% of context window automatically.",
    },
  ],
  statsBefore: { skills: 197, agents: 36, hooks: 117 },
  statsAfter: { skills: 199, agents: 36, hooks: 119 },
  ctaCommand: "/plugin install ork@latest",
  accentColor: "#2A9D8F",
};

export const releaseNotesV602SquareConfig: z.infer<
  typeof releaseNotesSquareSchema
> = {
  version: "6.0.2",
  date: "February 6, 2026",
  highlights: [
    {
      category: "added",
      title: "Adaptive Thinking",
      description:
        "All 199 skills now include complexity hints for Opus 4.6.",
    },
    {
      category: "added",
      title: "Upgrade Assessment",
      description: "6-phase readiness evaluation for platform upgrades.",
    },
    {
      category: "changed",
      title: "Agent Memory",
      description: "31 agents with project-scoped memory, 5 with local scope. CC 2.1.33.",
    },
  ],
  statsBefore: { skills: 197, agents: 36, hooks: 117 },
  statsAfter: { skills: 199, agents: 36, hooks: 119 },
  ctaCommand: "/plugin install ork@latest",
  accentColor: "#2A9D8F",
};
