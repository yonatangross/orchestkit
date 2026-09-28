// Inline WebMCP registration: the same four tools as lib/webmcp-tools.ts,
// emitted as a self-contained <script> in the root layout HTML.
//
// Why a second copy exists: ora.ai scores the site webmcp 1/5 (declarative
// form only) even though the app/layout-*.js chunk carries a literal
// `document.modelContext.registerTool(`. ora.ai's own homepage registers its
// tools in an INLINE script. The hypothesis under test is that the scanner only
// credits registrations it can read in the served HTML, not in a fetched chunk.
// A `force:true` rescan after deploy measures it.
//
// Rules this script keeps:
//   - No imports and no bundler: the text below is what the browser runs. The
//     tool names, descriptions and input schemas are serialized from
//     WEBMCP_TOOLS, so metadata has one source; the execute bodies are mirrored
//     by hand and pinned against the chunk tools by a parity test.
//   - The literal `document.modelContext.registerTool(` is written out so a
//     text scanner sees it; `navigator.modelContext` is only the fallback.
//   - Every name it registers goes into window[WEBMCP_REGISTRY_KEY], which
//     registerWebMcpTools() reads, so the chunk path skips those names.
//     Whichever path runs first claims a name; the other skips it.
//   - A name the page already declares through `<form toolname>` is skipped,
//     the same rule as the chunk path (declaredToolNames).
//   - A throwing or rejecting registerTool is logged, never thrown, so a
//     browser quirk cannot break the page.

import { SAFE_SEGMENT, WEBMCP_REGISTRY_KEY, WEBMCP_TOOLS, type WebMcpTool } from "./webmcp-tools";

/** Execute bodies, one per tool name, as plain browser JS. Each mirrors the
 * execute function of the same tool in WEBMCP_TOOLS: same endpoint, same
 * request shape, same user-facing messages. */
const INLINE_EXECUTORS: Record<string, string> = {
	search_docs: `function (a) {
      var q = String((a && a.query) || "").trim();
      if (!q) return Promise.resolve(text("Provide a non-empty query."));
      var p = new URLSearchParams({ query: q });
      var tag = String((a && a.tag) || "").trim();
      if (tag) p.set("tag", tag);
      return fetch("/api/search?" + p.toString()).then(function (r) {
        return r.ok ? r.text().then(text) : text("Search failed (" + r.status + ").");
      });
    }`,
	get_page: `function (a) {
      var route = mdRoute(String((a && a.path) || ""));
      if (!route) return Promise.resolve(text("Provide a docs path such as '/docs/foundations/overview'."));
      return fetch(route, { headers: { Accept: "text/markdown" } }).then(function (r) {
        return r.ok ? r.text().then(text) : text("Page not found (" + r.status + ").");
      });
    }`,
	list_skills: `function () {
      return fetch("/.well-known/agent-skills/index.json").then(function (r) {
        if (!r.ok) return text("Could not load skills index (" + r.status + ").");
        return r.json().then(function (d) {
          var s = d && typeof d === "object" && Array.isArray(d.skills) ? d.skills : [];
          return text(s.map(function (x) { return "- " + x.name + ": " + x.description; }).join("\\n"));
        });
      });
    }`,
	get_skill: `function (a) {
      var name = String((a && a.name) || "").trim();
      if (!name) return Promise.resolve(text("Provide a skill name."));
      var route = skillRoute(name);
      if (!route) return Promise.resolve(text("Skill names are plain slugs such as 'assess'."));
      return fetch(route, { headers: { Accept: "text/markdown" } }).then(function (r) {
        return r.ok ? r.text().then(text) : text("Skill '" + name + "' not found (" + r.status + ").");
      });
    }`,
};

/** JSON for an inline <script> body: `<` is escaped so no string in the
 * data can close the script element early. */
function scriptJson(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Build the inline registration script. Throws when a tool has no inline
 * executor, so adding a tool to WEBMCP_TOOLS without mirroring it here fails
 * the build instead of shipping a silently smaller inline set. */
export function buildWebMcpInlineScript(tools: WebMcpTool[] = WEBMCP_TOOLS): string {
	const missing = tools.filter((t) => !(t.name in INLINE_EXECUTORS)).map((t) => t.name);
	if (missing.length) {
		throw new Error(`webmcp inline script: no inline executor for ${missing.join(", ")}`);
	}
	const meta = tools.map(({ name, description, inputSchema }) => ({
		name,
		description,
		inputSchema,
	}));
	const executors = tools
		.map((t) => `    ${JSON.stringify(t.name)}: ${INLINE_EXECUTORS[t.name]}`)
		.join(",\n");

	return `(function () {
  if (typeof document === "undefined" || typeof navigator === "undefined") return;
  var hasDoc = !!(document.modelContext && typeof document.modelContext.registerTool === "function");
  var hasNav = !!(navigator.modelContext && typeof navigator.modelContext.registerTool === "function");
  if (!hasDoc && !hasNav) return;
  var SAFE = new RegExp(${JSON.stringify(SAFE_SEGMENT.source)});
  function text(v) { return { content: [{ type: "text", text: v }] }; }
  function segs(raw) {
    var d;
    try { d = decodeURIComponent(raw); } catch (e) { return null; }
    var s = d.split("/").filter(function (x) { return x.length > 0; });
    for (var i = 0; i < s.length; i++) {
      if (s[i] === "." || s[i] === ".." || !SAFE.test(s[i])) return null;
    }
    return s;
  }
  function mdRoute(path) {
    var t = path.trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return null;
    var s = segs(t);
    if (s === null) return null;
    if (s[0] === "docs") s.shift();
    var last = s.length - 1;
    if (last >= 0 && s[last].slice(-3) === ".md") {
      s[last] = s[last].slice(0, -3);
      if (!SAFE.test(s[last])) return null;
    }
    if (s.length === 1 && s[0] === "index") s.pop();
    return s.length ? "/api/md/" + s.join("/") : "/api/md";
  }
  function skillRoute(name) {
    var s = segs(name.trim().toLowerCase());
    if (s === null || s.length !== 1) return null;
    return "/docs/reference/skills/" + s[0];
  }
  var run = {
${executors}
  };
  var meta = ${scriptJson(meta)};
  var registry = window[${JSON.stringify(WEBMCP_REGISTRY_KEY)}] || (window[${JSON.stringify(WEBMCP_REGISTRY_KEY)}] = {});
  var declared = {};
  var forms = document.querySelectorAll("form[toolname]");
  for (var f = 0; f < forms.length; f++) declared[forms[f].getAttribute("toolname")] = true;
  function warn(name, err) { console.warn("[webmcp] inline registerTool(" + name + ") failed", err); }
  function register(tool) {
    if (hasDoc) return document.modelContext.registerTool(tool);
    return navigator.modelContext.registerTool(tool);
  }
  meta.forEach(function (m) {
    if (declared[m.name] || registry[m.name]) return;
    registry[m.name] = "inline";
    var tool = { name: m.name, description: m.description, inputSchema: m.inputSchema, execute: run[m.name] };
    try {
      var result = register(tool);
      if (result && typeof result.then === "function") {
        result.then(null, function (err) { warn(m.name, err); });
      }
    } catch (err) {
      warn(m.name, err);
    }
  });
})();`;
}

/** Built once per server process; the layout renders this string. */
export const WEBMCP_INLINE_SCRIPT = buildWebMcpInlineScript();
