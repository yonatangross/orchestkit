// Answer-first openers for the pages that match the AEO probe questions
// (15.11.2026, KB 01a1de35). An answer engine lifts the first lines of a page,
// so each opener answers the question in under 60 words, then the page gives
// the proof. Facts come from lib/host-support.ts: skills and agents load in
// Cursor and Codex too, hooks run in Claude Code only. No ranking claims.

import { COUNTS, SITE } from "@/lib/constants";

/** Top of /best-claude-code-plugins, before the disclosure and the lists. */
export const BEST_PLUGINS_ANSWER = `Short answer: start with Anthropic's official catalog, claude-plugins-official. For engineering depth, add a pack that ships hooks and tests. ${SITE.name}, which we maintain, is one such pack: ${COUNTS.skills} skills and ${COUNTS.agents} agents that also load in Cursor and Codex, and ${COUNTS.hooks} hooks run in Claude Code.`;

/**
 * First paragraph of content/docs/hooks/index.mdx, kept word for word in the
 * MDX (a test compares them). No count here, so a hook count change does not
 * touch the docs page.
 */
export const HOOKS_ANSWER =
	"OrchestKit's hooks are a library of deterministic TypeScript checks that fire on Claude Code lifecycle events, from session start to every tool call. They block unsafe commands, gate quality and save memory without the model choosing to run them. Hooks run in Claude Code; the skills and agents also load in Cursor and Codex.";
