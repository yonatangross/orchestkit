"use client";

import { useEffect } from "react";

// WebMCP — exposes site tools to in-browser AI agents via
// navigator.modelContext.provideContext(). Feature-detected, so it is a no-op in
// browsers without the API (currently a Chrome origin trial).
// Spec: https://webmachinelearning.github.io/webmcp/

interface WebMcpToolResult {
	content: Array<{ type: "text"; text: string }>;
}

interface WebMcpTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (args: Record<string, unknown>) => Promise<WebMcpToolResult>;
}

interface ModelContext {
	provideContext: (context: { tools: WebMcpTool[] }) => void;
}

function text(value: string): WebMcpToolResult {
	return { content: [{ type: "text", text: value }] };
}

const TOOLS: WebMcpTool[] = [
	{
		name: "search_docs",
		description:
			"Full-text search across ALL OrchestKit content (docs, skills, agents, hooks, compositions) via the unified index. Returns matching results with titles and URLs. Optionally filter by content type with `tag`.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", description: "Search term" },
				tag: {
					type: "string",
					enum: ["docs", "skill", "agent", "hook", "composition"],
					description:
						"Restrict results to one content type (e.g. 'skill' or 'agent'). Omit to search everything.",
				},
			},
			required: ["query"],
		},
		execute: async (args) => {
			const query = String(args.query ?? "").trim();
			if (!query) return text("Provide a non-empty query.");
			const params = new URLSearchParams({ query });
			const tag = String(args.tag ?? "").trim();
			if (tag) params.set("tag", tag);
			const res = await fetch(`/api/search?${params.toString()}`);
			if (!res.ok) return text(`Search failed (${res.status}).`);
			return text(await res.text());
		},
	},
	{
		name: "list_skills",
		description:
			"List all OrchestKit skills (name + description) from the agent-skills discovery index.",
		inputSchema: { type: "object", properties: {} },
		execute: async () => {
			const res = await fetch("/.well-known/agent-skills/index.json");
			if (!res.ok) return text(`Could not load skills index (${res.status}).`);
			const data: unknown = await res.json();
			const skills =
				data && typeof data === "object" && "skills" in data
					? (data as { skills: Array<{ name: string; description: string }> })
							.skills
					: [];
			return text(
				skills.map((s) => `- ${s.name}: ${s.description}`).join("\n"),
			);
		},
	},
	{
		name: "get_skill",
		description:
			"Fetch a single OrchestKit skill's documentation as Markdown by skill name.",
		inputSchema: {
			type: "object",
			properties: {
				name: { type: "string", description: "Skill name, e.g. 'assess'" },
			},
			required: ["name"],
		},
		execute: async (args) => {
			const name = String(args.name ?? "")
				.trim()
				.toLowerCase();
			if (!name) return text("Provide a skill name.");
			const res = await fetch(`/docs/reference/skills/${name}`, {
				headers: { Accept: "text/markdown" },
			});
			if (!res.ok) return text(`Skill '${name}' not found (${res.status}).`);
			return text(await res.text());
		},
	},
];

export function WebMcpProvider() {
	useEffect(() => {
		const ctx = (navigator as Navigator & { modelContext?: ModelContext })
			.modelContext;
		if (!ctx?.provideContext) return;
		ctx.provideContext({ tools: TOOLS });
	}, []);

	return null;
}
