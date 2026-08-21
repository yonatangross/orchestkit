// Preloaded with `node --import` so the built CLI runs against fixtures instead
// of the network. Preferred over a real localhost server: it needs no listening
// socket (blocked in some sandboxed CI runners), and it lets a test assert on
// header handling, RateLimit-*, Retry-After, deterministically.
const RATE_LIMIT = {
	"ratelimit-limit": "120",
	"ratelimit-remaining": "118",
	"ratelimit-reset": "60",
};

globalThis.fetch = async (input) => {
	const url = new URL(String(input));
	const json = (body, status = 200, extra = {}) =>
		new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json", ...RATE_LIMIT, ...extra },
		});

	if (url.hostname === "unreachable.test") throw new TypeError("fetch failed");
	if (url.pathname === "/api/health") return json({ status: "ok" });
	if (url.pathname === "/api/search") {
		if (url.searchParams.get("query") === "over-limit") {
			return json(
				{ title: "Too Many Requests", status: 429, detail: "Rate limit exceeded." },
				429,
				{ "retry-after": "42" },
			);
		}
		return json({ results: [{ id: "1", url: "/docs/x", title: "A doc" }] });
	}
	if (url.pathname.endsWith(".md")) {
		return new Response("# A doc\n", {
			headers: { "content-type": "text/markdown", ...RATE_LIMIT },
		});
	}
	return json({ title: "Resource not found", status: 404 }, 404);
};
