import { HOOK_EVENT_PAGES, type HookEventPage } from "@/lib/hook-events";

export type HookPhaseId =
	| "session"
	| "prompt"
	| "tools"
	| "files"
	| "agents"
	| "tasks"
	| "model";

export type HookPhase = {
	id: HookPhaseId;
	label: string;
	blurb: string;
	slugs: readonly string[];
};

/** Lifecycle order. Every hook event page (except index/spotlights) lands in one phase. */
export const HOOK_PHASES: readonly HookPhase[] = [
	{
		id: "session",
		label: "Session",
		blurb: "Start, cwd, setup, config, end.",
		slugs: [
			"session-start",
			"cwd-changed",
			"setup",
			"config-change",
			"instructions-loaded",
			"session-end",
		],
	},
	{
		id: "prompt",
		label: "Prompt",
		blurb: "The user message, before tools run.",
		slugs: ["user-prompt-submit", "user-prompt-expansion"],
	},
	{
		id: "tools",
		label: "Tools",
		blurb: "Pre/post tool use, batches, permissions.",
		slugs: [
			"pre-tool-use",
			"post-tool-use",
			"post-tool-batch",
			"post-tool-use-failure",
			"permission-request",
			"permission-denied",
		],
	},
	{
		id: "files",
		label: "Files",
		blurb: "Edits, new directories, worktree teardown.",
		slugs: ["file-changed", "directory-added", "worktree-remove"],
	},
	{
		id: "agents",
		label: "Agents",
		blurb: "Subagents and idle teammates.",
		slugs: ["subagent-start", "subagent-stop", "teammate-idle"],
	},
	{
		id: "tasks",
		label: "Tasks",
		blurb: "TaskCreate and TaskComplete.",
		slugs: ["task-created", "task-completed"],
	},
	{
		id: "model",
		label: "Model",
		blurb: "Switch, compact, stop, display, elicit.",
		slugs: [
			"pre-model-switch",
			"post-model-switch",
			"pre-compact",
			"post-compact",
			"stop",
			"stop-failure",
			"message-display",
			"notification",
			"elicitation",
			"elicitation-result",
		],
	},
];

export type HookPhaseGroup = HookPhase & { events: HookEventPage[] };

export function groupedHookEvents(): HookPhaseGroup[] {
	const bySlug = new Map(HOOK_EVENT_PAGES.map((event) => [event.slug, event]));
	return HOOK_PHASES.map((phase) => ({
		...phase,
		events: phase.slugs
			.map((slug) => bySlug.get(slug))
			.filter((event): event is HookEventPage => Boolean(event)),
	}));
}

/** Compact lifecycle. Six nodes, not one box per hook. */
export const HOOK_LIFECYCLE_CHART = `flowchart LR
  Session --> Prompt
  Prompt --> Tools
  Tools --> Files
  Tools --> Agents
  Tools --> Tasks
  Tools --> Model
`;
