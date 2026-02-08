// AUTO-GENERATED barrel — re-exports from split modules for backward compatibility.
// DO NOT EDIT MANUALLY — your changes will be overwritten.
// Run: npm run build (or node scripts/generate-playground-data.js)
//
// For new code, import directly from @/lib/generated/* for better tree-shaking.

export type { SkillDetail, SkillMeta, Plugin, AgentSummary, Composition, CategoryMeta, Totals } from "./generated/types";

export { TOTALS, AGENTS, CATEGORIES, SKILLS_SUMMARY } from "./generated/shared-data";
export { PLUGINS } from "./generated/plugins-data";
export { COMPOSITIONS } from "./generated/compositions-data";

// Full SKILLS with content — backward compat merge of meta + content
import { SKILLS as SKILLS_META } from "./generated/skills-data";
import { SKILL_CONTENT } from "./generated/skill-content-data";
import type { SkillDetail } from "./generated/types";

export const SKILLS: Record<string, SkillDetail> = Object.fromEntries(
  Object.entries(SKILLS_META).map(([key, meta]) => [
    key,
    { ...meta, ...(SKILL_CONTENT[key] ?? { content: "", contentTruncated: false }) },
  ]),
);
