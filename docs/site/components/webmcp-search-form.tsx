import { SEARCH_DOCS_DESCRIPTION } from "@/lib/webmcp-tools";

// Declarative WebMCP form: the server-rendered half of the tool surface. The
// `toolname` / `tooldescription` attributes are the spec's declarative API, so
// a crawler that reads raw HTML (no JS) finds a real tool here, not prose. The
// imperative registration in webmcp-provider.tsx stays the primary surface;
// this form is evidence plus a working fallback (GET /api/search?query=...).
//
// `hidden` keeps it out of the visual page and the accessibility tree while
// leaving it in the DOM, which is exactly what a non-executing reader needs.
export function WebMcpSearchForm() {
	return (
		<form
			action="/api/search"
			method="get"
			toolname="search_docs"
			tooldescription={SEARCH_DOCS_DESCRIPTION}
			hidden
			aria-hidden="true"
			data-webmcp="declarative"
		>
			<label htmlFor="webmcp-search-query">Search term</label>
			<input
				id="webmcp-search-query"
				name="query"
				type="search"
				required
				tabIndex={-1}
			/>
			<button type="submit" tabIndex={-1}>
				Search OrchestKit docs
			</button>
		</form>
	);
}
