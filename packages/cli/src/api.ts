// Thin client for the public OrchestKit docs API. The API is read-only,
// unauthenticated and rate-limited (120 req/min per IP per endpoint), so the
// whole client is fetch + JSON with no dependencies and no credential handling.
//
// Contract we rely on and therefore surface honestly:
//   - errors use RFC 9457 Problem Details, served as application/json
//   - every response carries IETF RateLimit-* headers
//   - a 429 carries Retry-After
// See https://orchestkit.yonyon.ai/api-policy

export const DEFAULT_BASE_URL = "https://orchestkit.yonyon.ai";

export type Problem = {
	type?: string;
	title?: string;
	status?: number;
	detail?: string;
	instance?: string;
	links?: { href: string; title: string; description?: string }[];
};

export type RateLimit = {
	limit: number | null;
	remaining: number | null;
	reset: number | null;
};

export class ApiError extends Error {
	readonly status: number;
	readonly problem: Problem;
	readonly retryAfter: number | null;

	constructor(status: number, problem: Problem, retryAfter: number | null) {
		// Prefer the server's own words: a Problem Details `detail` is written for
		// exactly this purpose and is more useful than a synthesized message.
		super(problem.detail ?? problem.title ?? `HTTP ${status}`);
		this.name = "ApiError";
		this.status = status;
		this.problem = problem;
		this.retryAfter = retryAfter;
	}
}

export type SearchHit = {
	id: string;
	url: string;
	type?: string;
	title?: string;
	description?: string;
	content?: string;
};

function intHeader(res: Response, name: string): number | null {
	const raw = res.headers.get(name);
	if (raw === null) return null;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : null;
}

export function readRateLimit(res: Response): RateLimit {
	return {
		limit: intHeader(res, "ratelimit-limit"),
		remaining: intHeader(res, "ratelimit-remaining"),
		reset: intHeader(res, "ratelimit-reset"),
	};
}

export type Client = {
	baseUrl: string;
	timeoutMs: number;
};

/**
 * Drop trailing slashes without a regex. `/\/+$/` looks harmless but is an
 * anchored repetition over attacker-influenced input (the base URL comes from
 * --base-url or ORCHESTKIT_BASE_URL), so a string of many slashes makes the
 * engine backtrack quadratically. CodeQL flagged it as js/polynomial-redos on
 * this exact line. A reverse scan is linear and obviously terminating.
 */
function stripTrailingSlashes(url: string): string {
	let end = url.length;
	while (end > 0 && url.charCodeAt(end - 1) === 47 /* "/" */) end -= 1;
	return url.slice(0, end);
}

export function createClient(overrides: Partial<Client> = {}): Client {
	return {
		// ORCHESTKIT_BASE_URL lets the same CLI drive a preview deployment or a
		// local `next dev`, which is what makes it usable in this repo's own CI.
		baseUrl: stripTrailingSlashes(
			overrides.baseUrl ?? process.env.ORCHESTKIT_BASE_URL ?? DEFAULT_BASE_URL,
		),
		timeoutMs: overrides.timeoutMs ?? 15_000,
	};
}

async function request(
	client: Client,
	path: string,
	accept: string,
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), client.timeoutMs);
	try {
		const res = await fetch(`${client.baseUrl}${path}`, {
			headers: { Accept: accept, "User-Agent": "orchestkit-cli" },
			signal: controller.signal,
		});
		if (res.ok) return res;

		const retryAfter = intHeader(res, "retry-after");
		let problem: Problem = { status: res.status, title: res.statusText };
		try {
			const body: unknown = await res.json();
			if (body && typeof body === "object") problem = body as Problem;
		} catch {
			// Non-JSON error body. The site's own contract says agents get JSON, so
			// this only happens against a different origin or an edge/CDN error page.
		}
		throw new ApiError(res.status, problem, retryAfter);
	} finally {
		clearTimeout(timer);
	}
}

export async function getJson<T>(
	client: Client,
	path: string,
): Promise<{ data: T; rateLimit: RateLimit }> {
	const res = await request(client, path, "application/json");
	return { data: (await res.json()) as T, rateLimit: readRateLimit(res) };
}

export async function getMarkdown(
	client: Client,
	path: string,
): Promise<{ text: string; rateLimit: RateLimit }> {
	const res = await request(client, path, "text/markdown");
	return { text: await res.text(), rateLimit: readRateLimit(res) };
}

export async function search(
	client: Client,
	query: string,
	limit: number,
): Promise<{ results: SearchHit[]; rateLimit: RateLimit }> {
	const qs = new URLSearchParams({ query, limit: String(limit) });
	const { data, rateLimit } = await getJson<{ results?: SearchHit[] }>(
		client,
		`/api/search?${qs}`,
	);
	return { results: data.results ?? [], rateLimit };
}

export async function ask(
	client: Client,
	query: string,
): Promise<{ data: unknown; rateLimit: RateLimit }> {
	const qs = new URLSearchParams({ query });
	return getJson<unknown>(client, `/ask?${qs}`);
}

/**
 * Fetch a documentation page as raw Markdown. Accepts a bare slug
 * ("foundations/overview"), a site path ("/docs/foundations/overview") or the
 * `.md` form, all three are the same page, and making the CLI accept whichever
 * one a user pasted is cheaper than making them normalize it.
 */
export async function readDoc(
	client: Client,
	slug: string,
): Promise<{ text: string; rateLimit: RateLimit }> {
	let clean = slug.trim().replace(/\.md$/, "");
	if (!clean.startsWith("/")) clean = `/docs/${clean}`;
	if (!clean.startsWith("/docs")) clean = `/docs${clean}`;
	return getMarkdown(client, `${clean}.md`);
}
