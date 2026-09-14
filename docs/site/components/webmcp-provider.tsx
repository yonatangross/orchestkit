"use client";

import { useEffect } from "react";
import { registerWebMcpTools } from "@/lib/webmcp-tools";

// WebMCP: exposes site tools to in-browser AI agents. Mounted once in the root
// layout, so every route registers the same tool set on load. Registration
// prefers document.modelContext.registerTool() and falls back to the older
// navigator.modelContext surfaces; see lib/webmcp-tools.ts for the order.
// Feature-detected, so it is a no-op in browsers without the API (Chrome
// origin trial 149 to 156, shipping targeted for 157).
// Spec: https://webmachinelearning.github.io/webmcp/
//
// The homepage also carries a declarative <form toolname="search_docs"> (see
// components/webmcp-search-form.tsx) so a crawler that does not execute JS
// still finds server-rendered evidence of the tool surface.

export function WebMcpProvider() {
	useEffect(() => {
		registerWebMcpTools(document, navigator);
	}, []);

	return null;
}
